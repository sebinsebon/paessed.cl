import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import catalog from "../lib/default-catalog.json" with { type: "json" };
import { createSyncService, operationDigest } from "../lib/server/sync-service.ts";
import { CATALOG_REVISION, batchSchema } from "../lib/sync/contracts.ts";
import { consume, ipKey, enforceIpRequestLimit } from "../lib/server/limits.ts";
import { expectedAccount, readJson } from "../lib/server/http.ts";
import { createLearningState, planLearning, reduceLearning } from "../lib/learning/engine.ts";

const migration = await readFile(new URL("../supabase/migrations/20261111230120_account_sync_mvp.sql", import.meta.url), "utf8");
const q = catalog.questions.find(q => q.eligible);
async function fixture() {
  const pg = new PGlite();
  await pg.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now());");
  await pg.exec(migration);
  const owner = randomUUID(), other = randomUUID(), device = randomUUID();
  await pg.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  const query = async (text, params=[]) => (await pg.query(text, params)).rows;
  const driver = { query, transaction: work => pg.transaction(tx => work(async (text,params=[]) => (await tx.query(text,params)).rows)) };
  const service = createSyncService(driver);
  await service.pull(owner);
  const op = (sequence, action, overrides={}) => ({id:randomUUID(),deviceId:device,sequence,baseRevision:1,generation:0,contractVersion:1,catalogRevision:CATALOG_REVISION,at:new Date().toISOString(),action,...overrides});
  return { pg, owner, other, device, query, driver, service, op };
}
async function withFixture(work) { const f=await fixture();try {await work(f);}finally{await f.pg.close();} }

test("migration blocks direct tables/functions for public roles and enables RLS", () => withFixture(async f => {
  const rows=await f.query("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='paessed' and relkind='r'");
  assert.ok(rows.length>=13);assert.ok(rows.every(r=>r.relrowsecurity));
  for(const role of ["anon","authenticated"]){
    const r=await f.query("select has_schema_privilege($1,'paessed','USAGE') as schema,has_table_privilege($1,'paessed.learning_states','SELECT') as read,has_function_privilege($1,'paessed.consume_limit(text,integer,integer,integer)','EXECUTE') as rpc",[role]);
    assert.deepEqual(r[0],{schema:false,read:false,rpc:false});
  }
  const perms=await f.query("select has_table_privilege('paessed_server','paessed.original_answers','UPDATE') as update,has_table_privilege('paessed_server','paessed.original_answers','DELETE') as delete");
  assert.deepEqual(perms[0],{update:false,delete:false});
}));
test("stable retry is acknowledged after detail retention without duplicating evidence", () => withFixture(async f => {
  const session=randomUUID();const operation=f.op(1,{type:"learning",action:{type:"external-attempt",questionId:q.id,answer:q.correct,mode:"exam",sessionId:session}});
  const first=await f.service.push(f.owner,[operation]);assert.equal(first.acknowledgements[0].status,"accepted");
  await f.query("update paessed.sync_operations set confirmed_at=now()-interval '31 days'");
  await f.query("select paessed.cleanup_batch(1000)");
  assert.equal((await f.query("select payload from paessed.sync_operations"))[0].payload,null);
  const retry=await f.service.push(f.owner,[operation]);assert.equal(retry.revision,first.revision);
  assert.equal(Number((await f.query("select count(*) as n from paessed.original_answers"))[0].n),1);
  await assert.rejects(f.service.push(f.owner,[{...operation,action:{...operation.action,action:{...operation.action.action,answer:q.correct==="A"?"B":"A"}}}]),e=>e.status===400);
  await assert.rejects(f.service.push(f.other,[operation]),e=>e.status===400);
}));
test("account ownership, sequence gaps, strict contracts and digest canonicalization", () => withFixture(async f => {
  const operation=f.op(1,{type:"saved-question",questionId:q.id,deleted:false});
  assert.equal(batchSchema.safeParse({operations:[{...operation,ownerId:f.other}]}).success,false);
  assert.equal(batchSchema.safeParse({operations:[{...operation,action:{...operation.action,document:"data:base64,private"}}]}).success,false);
  assert.equal(operationDigest(operation),operationDigest(Object.fromEntries(Object.entries(operation).reverse())));
  await assert.rejects(f.service.push(f.owner,[{...operation,sequence:2}]),e=>e.status===400);
  await f.service.push(f.owner,[operation]);
  assert.equal((await f.service.pull(f.other)).changes.some(c=>c.kind==="saved-question"),false);
}));

test("future base revisions and nonexistent current nodes are invalid contracts, not conflicts",()=>withFixture(async f=>{
  await assert.rejects(f.service.push(f.owner,[f.op(1,{type:"saved-question",questionId:q.id,deleted:false},{baseRevision:2})]),e=>e.status===400);
  await assert.rejects(f.service.push(f.owner,[f.op(1,{type:"learning",action:{type:"start-node",nodeId:randomUUID()}})]),e=>e.status===400);
  assert.equal(Number((await f.query("select count(*) as n from paessed.sync_operations"))[0].n),0);
  assert.equal(Number((await f.query("select count(*) as n from paessed.sync_conflicts"))[0].n),0);
}));
test("educational quota rollback preserves state and confirmed retries consume no creation quota", () => withFixture(async f => {
  process.env.LIMIT_EDUCATION_MINUTE="1";
  try {
    const one=f.op(1,{type:"saved-question",questionId:q.id,deleted:false});await f.service.push(f.owner,[one]);
    await f.service.push(f.owner,[one]);
    await assert.rejects(f.service.push(f.owner,[f.op(2,{type:"saved-question",questionId:q.id,deleted:true})]),e=>e.status===429);
    assert.equal((await f.query("select deleted from paessed.saved_questions"))[0].deleted,false);
  } finally {delete process.env.LIMIT_EDUCATION_MINUTE;}
}));
test("capacity pause preserves reads and acknowledgements while rejecting new writes", () => withFixture(async f => {
  const one=f.op(1,{type:"saved-question",questionId:q.id,deleted:false});await f.service.push(f.owner,[one]);
  await f.query("update paessed.capacity_state set egress_bytes=4563402752,egress_measured_at=now()");
  assert.equal((await f.service.pull(f.owner)).capacity.writesPaused,true);
  await f.service.push(f.owner,[one]);
  await assert.rejects(f.service.push(f.owner,[f.op(2,{type:"saved-question",questionId:q.id,deleted:true})]),e=>e.status===429);
}));

test("bookmarks and session drafts do not transfer unchanged learning projections",()=>withFixture(async f=>{
  const bootstrap=await f.service.pull(f.owner);
  const bookmark=await f.service.push(f.owner,[f.op(1,{type:"saved-question",questionId:q.id,deleted:false})],bootstrap.cursor);
  assert.equal(bookmark.changes.some(c=>c.kind==="learning"),false);
  const draft=await f.service.push(f.owner,[f.op(2,{type:"session",mode:"exam",sourceId:`default:${q.examId}`,session:{id:randomUUID(),index:0,answers:{[q.id]:"A"}}})],bookmark.cursor);
  assert.equal(draft.changes.some(c=>c.kind==="learning"),false);
  assert.equal(draft.changes.some(c=>c.kind==="session"),true);
}));
test("shared PostgreSQL limiter is atomic and recovers after expiration", () => withFixture(async f => {
  const outcomes=await Promise.all(Array.from({length:12},()=>f.driver.transaction(async query=>{try{await consume(query,"shared",5,60);return true;}catch(e){if(e.status===429)return false;throw e;}})));
  assert.equal(outcomes.filter(Boolean).length,5);
  await f.query("update paessed.rate_limit_counters set expires_at=now()-interval '1 second' where key='shared'");
  await f.driver.transaction(query=>consume(query,"shared",5,60));
}));
test("body parser counts actual bytes, rejects compressed/deep/malformed payloads", async()=>{
  const request=body=>new Request("http://localhost/api/sync",{method:"POST",headers:{"Content-Type":"application/json"},body});
  await assert.rejects(readJson(request(JSON.stringify({x:"é".repeat(100)})),128),e=>e.status===413);
  await assert.rejects(readJson(request("[".repeat(20)+"]".repeat(20))),e=>e.status===400);
  await assert.rejects(readJson(request("{broken")),e=>e.status===400);
  await assert.rejects(readJson(new Request("http://localhost",{method:"POST",headers:{"Content-Type":"application/json","Content-Encoding":"gzip"},body:"{}"})),e=>e.status===400);
  assert.deepEqual(await readJson(request('{"valid":true}')),{valid:true});
});
test("expected account assertion prevents cookie-switched queue ownership and IP storage is HMAC",()=>{
  assert.throws(()=>expectedAccount(new Request("http://localhost",{headers:{"x-paessed-account":"one"}}),"two"),e=>e.status===409);
  expectedAccount(new Request("http://localhost",{headers:{"x-paessed-account":"one"}}),"one");
  process.env.IP_HMAC_SECRET="x".repeat(32);
  const key=ipKey(new Request("http://localhost"));assert.match(key,/^[a-f\d]{64}$/);assert.ok(!key.includes("127.0.0.1"));delete process.env.IP_HMAC_SECRET;
});
test("conflicting originals keep both versions and selecting incoming activates one branch only",()=>withFixture(async f=>{
  const sessionId=randomUUID(),wrong=q.correct==="A"?"B":"A";
  await f.service.push(f.owner,[f.op(1,{type:"learning",action:{type:"external-attempt",questionId:q.id,answer:q.correct,mode:"exam",sessionId}})]);
  const conflicting=await f.service.push(f.owner,[f.op(2,{type:"learning",action:{type:"external-attempt",questionId:q.id,answer:wrong,mode:"exam",sessionId}})]);
  assert.equal(conflicting.acknowledgements[0].status,"conflict");assert.equal(conflicting.conflicts.length,1);
  const resolved=await f.service.resolve(f.owner,conflicting.conflicts[0].id,"incoming");
  const learning=resolved.changes.find(c=>c.kind==="learning").value;
  assert.equal(learning.attempts.length,1);assert.equal(learning.attempts[0].answer,wrong);assert.equal(learning.attempts[0].correct,false);
  const originals=await f.query("select answer,route_id from paessed.original_answers order by created_at");assert.equal(originals.length,2);assert.notEqual(originals[0].route_id,originals[1].route_id);
  const kept=await f.query("select current_value from paessed.sync_conflicts where id=$1",[conflicting.conflicts[0].id]);assert.equal(kept[0].current_value.attempts[0].answer,q.correct);
}));
test("different devices merge compatible session questions and preserve divergent drafts",()=>withFixture(async f=>{
  const ids=catalog.questions.filter(x=>x.examId===q.examId).map(x=>x.id),sessionId=randomUUID();
  const action=answers=>({type:"session",mode:"exam",sourceId:`default:${q.examId}`,session:{id:sessionId,index:0,questionIds:ids,answers}});
  await f.service.push(f.owner,[f.op(1,action({[ids[0]]:"A"}))]);
  const second=randomUUID();await f.service.push(f.owner,[f.op(1,action({[ids[1]]:"B"}),{deviceId:second})]);
  assert.deepEqual((await f.query("select state from paessed.practice_sessions"))[0].state.answers,{[ids[0]]:"A",[ids[1]]:"B"});
  const conflict=await f.service.push(f.owner,[f.op(2,action({[ids[0]]:"C"}),{deviceId:second})]);
  assert.equal(conflict.acknowledgements[0].status,"conflict");
}));

test("resolution preserves work accepted after the conflict and archives the latest branch",()=>withFixture(async f=>{
  const sessionId=randomUUID(),otherQuestion=catalog.questions.find(x=>x.eligible&&x.id!==q.id),wrong=q.correct==="A"?"B":"A";
  const answer=(question,answer)=>({type:"learning",action:{type:"external-attempt",questionId:question.id,answer,mode:"playground",sessionId}});
  await f.service.push(f.owner,[f.op(1,answer(q,q.correct))]);
  const conflict=await f.service.push(f.owner,[f.op(2,answer(q,wrong))]);
  await f.service.push(f.owner,[f.op(3,answer(otherQuestion,otherQuestion.correct))]);
  const selected=await f.service.resolve(f.owner,conflict.conflicts[0].id,"incoming");
  const state=selected.changes.find(c=>c.kind==="learning").value;
  assert.equal(state.attempts.length,2);
  assert.equal(state.attempts.find(a=>a.questionId===q.id).answer,wrong);
  assert.equal(state.attempts.find(a=>a.questionId===otherQuestion.id).answer,otherQuestion.correct);
  const archive=(await f.query("select current_value from paessed.sync_conflicts where kind='preserved-before-resolution'"))[0].current_value;
  assert.equal(archive.learning.attempts.length,2);
  assert.equal(archive.learning.attempts.find(a=>a.questionId===q.id).answer,q.correct);
}));

test("bootstrap pages fifty imported historical sessions without a repeated revision boundary",()=>withFixture(async f=>{
  const trusted=catalog.questions.filter(x=>x.eligible);let state=planLearning(createLearningState(),trusted);
  for(let i=0;i<50;i++) state=reduceLearning(state,{type:"external-attempt",questionId:q.id,answer:q.correct,mode:"exam",sessionId:randomUUID()},trusted);
  await f.service.push(f.owner,[f.op(1,{type:"restore-learning",state})],0,true);
  let cursor=0, count=0, pages=0;
  do { const response=await f.service.pull(f.owner,cursor); assert.ok(response.cursor>cursor); count+=response.changes.filter(c=>c.kind==="session").length; cursor=response.cursor; pages++; if(!response.hasMore)break; assert.ok(pages<5); } while(true);
  assert.equal(count,50);assert.ok(pages>=2);
}));
test("closed Playground sessions count confirmed originals and keep unchecked drafts unscored",()=>withFixture(async f=>{
  const ids=catalog.questions.filter(x=>x.eligible).slice(0,2).map(x=>x.id);
  const action={type:"session",mode:"playground",sourceId:"playground",session:{id:randomUUID(),index:0,questionIds:ids,answers:{[ids[0]]:"A",[ids[1]]:"B"},confirmed:[ids[0]],completedAt:new Date().toISOString()}};
  const response=await f.service.push(f.owner,[f.op(1,action)]);
  assert.equal(response.changes.find(c=>c.kind==="learning").value.attempts.length,1);
}));

test("personal source revisions remain separate conflicts instead of overwriting progress",()=>withFixture(async f=>{
  const hash="a".repeat(64),questionId=`personal:${hash}:4`,sessionId=randomUUID();
  const action=revision=>({type:"session",mode:"exam",sourceId:`sha256:${hash}`,session:{id:sessionId,index:0,questionIds:[questionId],answers:{[questionId]:"A"},sourceRevision:revision}});
  await f.service.push(f.owner,[f.op(1,action("b".repeat(64)))]);
  const response=await f.service.push(f.owner,[f.op(2,action("c".repeat(64)))]);
  assert.equal(response.acknowledgements[0].status,"conflict");
  assert.equal(response.conflicts[0].kind,"source-revision");
  assert.equal((await f.query("select state from paessed.practice_sessions"))[0].state.sourceRevision,"b".repeat(64));
}));
test("generation reset cannot resurrect stale saved questions",()=>withFixture(async f=>{
  const saved=f.op(1,{type:"saved-question",questionId:q.id,deleted:false});await f.service.push(f.owner,[saved]);
  await f.service.push(f.owner,[f.op(2,{type:"reset"},{baseRevision:2})]);
  const stale=await f.service.push(f.owner,[f.op(3,{type:"saved-question",questionId:q.id,deleted:false})]);
  assert.equal(stale.generation,1);assert.equal(stale.acknowledgements[0].status,"conflict");
  assert.equal(stale.changes.some(c=>c.kind==="saved-question"),false);
}));

test("offline reset follows its own queued changes and preserves concurrent work for explicit choice",()=>withFixture(async f=>{
  const queued=await f.service.push(f.owner,[f.op(1,{type:"saved-question",questionId:q.id,deleted:false}),f.op(2,{type:"reset"}),f.op(3,{type:"learning",action:{type:"set-goal",goal:3}},{generation:1})]);
  assert.equal(queued.generation,1);assert.ok(queued.acknowledgements.every(ack=>ack.status==="accepted"));
  const otherDevice=randomUUID();await f.service.push(f.other,[f.op(1,{type:"saved-question",questionId:q.id,deleted:false},{deviceId:otherDevice})]);
  const conflict=await f.service.push(f.other,[f.op(1,{type:"reset"},{deviceId:randomUUID()})]);
  assert.equal(conflict.acknowledgements[0].status,"conflict");
  const selected=await f.service.resolve(f.other,conflict.conflicts[0].id,"incoming");
  assert.equal(selected.generation,1);
  assert.equal(selected.changes.some(c=>c.kind==="saved-question"),false);
}));
test("imports recalculate Gold XP and enforce historical session creation quotas",()=>withFixture(async f=>{
  const trusted=catalog.questions.filter(x=>x.eligible);let state=planLearning(createLearningState(),trusted);
  const node=state.nodes[0];state=reduceLearning(state,{type:"start-node",nodeId:node.id},trusted);
  for(const id of node.questionIds)state=reduceLearning(state,{type:"answer",nodeId:node.id,questionId:id,answer:trusted.find(q=>q.id===id).correct},trusted);
  for(const a of state.attempts){a.eligible=false;a.assisted=true;}
  state.nodes.find(n=>n.id===node.id).xp=25;
  const response=await f.service.push(f.owner,[f.op(1,{type:"restore-learning",state})],0,true);
  assert.equal(response.changes.find(c=>c.kind==="learning").value.nodes.find(n=>n.id===node.id).xp,0);
  process.env.LIMIT_SESSIONS_DAY="1";
  try{
    let fresh=planLearning(createLearningState(),trusted);
    for(let i=0;i<2;i++)fresh=reduceLearning(fresh,{type:"external-attempt",questionId:q.id,answer:q.correct,mode:"exam",sessionId:randomUUID()},trusted);
    await assert.rejects(f.service.push(f.other,[f.op(1,{type:"restore-learning",state:fresh},{deviceId:randomUUID()})],0,true),e=>e.status===429);
    assert.equal(Number((await f.query("select count(*) as n from paessed.practice_sessions where owner_id=$1",[f.other]))[0].n),0);
  }finally{delete process.env.LIMIT_SESSIONS_DAY;}
}));
test("unauthenticated requests consume the aggregate IP quota before identity lookup",()=>withFixture(async f=>{
  process.env.IP_HMAC_SECRET="s".repeat(32);process.env.LIMIT_PROGRESS_IP_MINUTE="2";
  try{
    const request=new Request("http://localhost/api/sync");
    await enforceIpRequestLimit(request,"progress",f.driver);await enforceIpRequestLimit(request,"progress",f.driver);
    await assert.rejects(enforceIpRequestLimit(request,"progress",f.driver),e=>e.status===429);
    assert.equal(Number((await f.query("select count from paessed.rate_limit_counters where key like 'progress:%'"))[0].count),3);
  }finally{delete process.env.IP_HMAC_SECRET;delete process.env.LIMIT_PROGRESS_IP_MINUTE;}
}));

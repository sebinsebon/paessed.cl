import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url), ts = require("typescript"), root = resolve(import.meta.dirname, "..");

async function harness(work) {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Account sync test</title>"); return; }
      const path = resolve(root, `.${req.url}`);
      if (!path.startsWith(`${root}${sep}lib${sep}`) || !path.endsWith(".ts")) { res.statusCode = 404; res.end(); return; }
      const source = await readFile(path, "utf8");
      res.setHeader("Content-Type", "application/javascript");
      res.end(ts.transpileModule(source, { compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext} }).outputText);
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      window.local = await import("/lib/sync/local.ts");
      window.client = await import("/lib/sync/client.ts");
      window.repo = await import("/lib/learning/repository.ts");
      window.A = "11111111-1111-4111-8111-111111111111";
      window.B = "22222222-2222-4222-8222-222222222222";
      window.q = `personal:${"a".repeat(64)}:1`;
      window.reply = (patch = {}) => ({revision:0,generation:0,catalogRevision:"gold-0.7-sync-1",acknowledgements:[],changes:[],conflicts:[],hasMore:false,cursor:0,...patch});
    });
    await work(page, context);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

test("IndexedDB keeps ordered atomic operations, account isolation, shadows and reset tombstones", async () => harness(async (page, context) => {
  const first = await page.evaluate(async () => {
    window.local.setSyncOwner(window.A);
    const db = await window.local.openLocalDatabase();
    await new Promise((resolve,reject) => { const tx=db.transaction(["meta","outbox"],"readwrite"); for(let i=1;i<=3;i++) window.local.enqueueOperation(tx,{type:"saved-question",questionId:`personal:${"a".repeat(64)}:${i}`,deleted:false}); tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error); });
    return window.local.listPendingOperations();
  });
  assert.deepEqual(first.map(o => o.sequence), [1,2,3]);
  const second = await context.newPage(); await second.goto(page.url());
  await second.evaluate(async () => { window.local=await import("/lib/sync/local.ts");window.local.setSyncOwner("11111111-1111-4111-8111-111111111111"); });
  await Promise.all([page,second].map((p,i) => p.evaluate(async i => { for(let n=0;n<8;n++) await window.local.saveQuestion(`personal:${"b".repeat(64)}:${i*8+n+1}`,true); },i)));
  assert.deepEqual(await page.evaluate(async () => (await window.local.listPendingOperations()).map(o=>o.sequence)), Array.from({length:19},(_,i)=>i+1));
  const state = await page.evaluate(async () => {
    const before=await window.local.listPendingOperations();
    try { await window.client.persistSyncResponse(window.A,window.reply({revision:1,cursor:1,acknowledgements:[{...before[0],status:"accepted"}],changes:[{revision:1,kind:"learning",key:"current",value:{broken:true}}]})); } catch {}
    const after=await window.local.listPendingOperations();
    await window.client.persistSyncResponse(window.A,window.reply({revision:1,cursor:1,acknowledgements:[{id:crypto.randomUUID(),sequence:1,status:"accepted"}]}));
    return {before:before.map(o=>o.id),after:after.map(o=>o.id),remaining:(await window.local.listPendingOperations()).length};
  });
  assert.deepEqual(state.before,state.after,"a failed projection rolls back acknowledgements"); assert.equal(state.remaining,19,"a mismatched receipt cannot remove work");
  const projection = await page.evaluate(async () => {
    const session={id:crypto.randomUUID(),index:0,questionIds:[window.q],answers:{[window.q]:"A"}};
    await window.local.savePracticeSession("exam",`sha256:${"a".repeat(64)}`,session);
    const operations=await window.local.listPendingOperations(),queued=operations.at(-1);
    await window.client.persistSyncResponse(window.A,window.reply({revision:2,cursor:2,changes:[{revision:2,kind:"session",key:"one",value:{mode:"exam",sourceId:`sha256:${"a".repeat(64)}`,session:{...session,answers:{[window.q]:"B"}}}}]}));
    const pending=(await window.local.readPracticeSession("exam",`sha256:${"a".repeat(64)}`)).answers[window.q];
    await window.client.persistSyncResponse(window.A,window.reply({revision:2,cursor:2,acknowledgements:operations.map(o=>({id:o.id,sequence:o.sequence,status:"accepted"}))}));
    const acknowledged=(await window.local.readPracticeSession("exam",`sha256:${"a".repeat(64)}`)).answers[window.q];
    await window.client.persistSyncResponse(window.A,window.reply({revision:3,generation:1,cursor:3,changes:[{revision:3,kind:"reset",key:"current",value:null}]}));
    const reset=await window.local.readPracticeSession("exam",`sha256:${"a".repeat(64)}`);
    await window.local.saveQuestion(window.q,true);
    const original=await window.repo.readLearningState();
    window.local.setSyncOwner(window.B);const b=await window.repo.readLearningState();const bPending=await window.local.listPendingOperations();
    window.local.setSyncOwner(null);const guest=await window.repo.readLearningState();
    return {pending,acknowledged,reset,a:original.learnerId,b:b.learnerId,guest:guest.learnerId,bPending:bPending.length};
  });
  assert.equal(projection.pending,"A");assert.equal(projection.acknowledged,"B");assert.equal(projection.reset,null);
  assert.notEqual(projection.a,projection.b);assert.notEqual(projection.guest,projection.a);assert.notEqual(projection.guest,projection.b);assert.equal(projection.bPending,0);
}));

test("guest import includes practice and saved references and partitions a large valid state", async () => harness(async page => {
  const result=await page.evaluate(async () => {
    const guest=await window.repo.readLearningState();
    await window.local.saveQuestion(window.q,true);
    await window.local.savePracticeSession("playground","playground",{id:crypto.randomUUID(),index:0,questionIds:[window.q],answers:{[window.q]:"C"}});
    const summary=await window.client.guestProgressSummary();window.local.setSyncOwner(window.A);await window.client.importGuestProgress();
    const operations=await window.local.listPendingOperations();
    const big={...guest,attempts:Array.from({length:700},(_,i)=>({id:`a${i}`,questionId:`personal:${i.toString(16).padStart(64,"0")}:1`,sessionId:`session${i}`,mode:"exam",axisId:"numeros",unitId:"numeros-enteros-racionales",revision:"1",answer:"A",correct:false,eligible:false,assisted:false,at:"2026-11-11T12:00:00Z"}))};
    window.repo.validateLearningState(big);
    const parts=window.local.partitionLearningRestore(big);parts.forEach(part=>window.repo.validateLearningState(part));
    window.local.setSyncOwner(null);const preserved=await window.repo.readLearningState();
    return {summary,kinds:operations.map(o=>o.action.type),sequences:operations.map(o=>o.sequence),parts:parts.length,total:parts.reduce((n,p)=>n+p.attempts.length,0),max:Math.max(...parts.map(p=>new TextEncoder().encode(JSON.stringify(p)).byteLength)),sameGuest:preserved.learnerId===guest.learnerId};
  });
  assert.equal(result.summary.savedQuestions,1);assert.equal(result.summary.sessions,1);
  assert.ok(result.kinds.includes("restore-learning")&&result.kinds.includes("session")&&result.kinds.includes("saved-question"));
  assert.deepEqual(result.sequences,Array.from({length:result.sequences.length},(_,i)=>i+1));
  assert.ok(result.parts>1);assert.equal(result.total,700);assert.ok(result.max<200000);assert.equal(result.sameGuest,true);
}));

test("lost HTTP acknowledgements retry stable operations with account assertion and cursor", async () => harness(async page => {
  const result=await page.evaluate(async () => {
    window.local.setSyncOwner(window.A);await window.local.saveQuestion(window.q,true);
    window.sent=[];let fail=true;
    const base=window.reply({revision:5,cursor:5});
    window.fetch=async (url,init={}) => {
      if(url==="/api/auth/session")return Response.json({user:{id:window.A}});
      if(init.method!=="POST")return Response.json(base);
      const body=JSON.parse(init.body);window.sent.push({account:new Headers(init.headers).get("X-PAESSED-Account"),body});
      if(fail){fail=false;throw new Error("The server committed, but the connection dropped");}
      return Response.json({...base,acknowledgements:body.operations.map(o=>({id:o.id,sequence:o.sequence,status:"accepted"}))});
    };
    await window.client.initializeSyncIdentity();const retained=(await window.local.listPendingOperations()).length;
    await window.client.synchronize();const drained=(await window.local.listPendingOperations()).length;
    window.fetch=async()=>new Response("",{status:401});await window.client.initializeSyncIdentity();
    return {retained,drained,sent:window.sent,owner:window.local.getSyncOwner(),paused:window.client.getSyncStatus().state};
  });
  assert.equal(result.retained,1);assert.equal(result.drained,0);assert.equal(result.sent[0].body.operations[0].id,result.sent[1].body.operations[0].id);
  assert.equal(result.sent[0].account,"11111111-1111-4111-8111-111111111111");assert.equal(result.sent[0].body.cursor,5);
  assert.equal(result.owner,"11111111-1111-4111-8111-111111111111");assert.equal(result.paused,"paused");
}));

test("capacity pauses writes, explicit logout preserves account queues, and legacy marks respect tombstones", async () => harness(async page => {
  const result = await page.evaluate(async () => {
    localStorage.setItem("paessed-playground-saved-questions",JSON.stringify([window.q]));
    await window.local.saveQuestion(window.q,false);const legacy=await window.local.listSavedQuestions();
    window.local.setSyncOwner(window.A);await window.local.saveQuestion(window.q,true);await window.local.saveQuestion(window.q,true);
    let posts=0;window.fetch=async(url,init={})=> {
      if(url==="/api/auth/session")return Response.json({user:{id:window.A}});
      if(init.method==="POST")posts++;
      return Response.json(window.reply({capacity:{warning:true,writesPaused:true}}));
    };
    await window.client.initializeSyncIdentity();
    const paused=window.client.getSyncStatus(),before=(await window.local.listPendingOperations()).length;
    const stop=window.client.startSync();localStorage.removeItem("paessed-sync-owner");window.dispatchEvent(new Event("paessed-auth-signed-out"));stop();
    return {legacy,posts,paused:paused.state,before,owner:window.local.getSyncOwner(),after:(await window.local.listPendingOperations(window.A)).length};
  });
  assert.deepEqual(result.legacy,[]);assert.equal(result.posts,0);assert.equal(result.paused,"paused");assert.equal(result.before,1);
  assert.equal(result.owner,null);assert.equal(result.after,1);
}));

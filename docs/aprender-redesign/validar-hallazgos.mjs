// Read-only reproductions of audit findings, separate from application tests.
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {createLearningState,planLearning,getProfile} from "../../lib/learning/engine.ts";
import {M1_UNITS} from "../../lib/m1-curriculum.ts";
const now="2026-11-07T16:00:00.000Z";
const catalog=M1_UNITS.flatMap(u=>Array.from({length:15},(_,i)=>({id:`${u.id}:${i}`,examId:"audit",number:i+1,axisId:u.axisId,unitId:u.id,revision:"audit",correct:"A",eligible:true})));
const state=createLearningState(now);state.learnerId="audit-read-only";state.seed=42;
state.attempts=catalog.map((q,i)=>({id:`audit:${i}`,questionId:q.id,sessionId:"audit",mode:"exam",axisId:q.axisId,unitId:q.unitId,revision:q.revision,answer:q.unitId==="expresiones-algebraicas"?"B":"A",correct:q.unitId!=="expresiones-algebraicas",eligible:true,assisted:false,at:now}));
const profile=getProfile(state);
let planned=planLearning(state,catalog,now);
const algebraReinforcement=[];
for(let block=0;block<2;block++){
  algebraReinforcement.push(...planned.nodes.filter(n=>n.state==="future"&&n.type==="R"&&n.axisId==="algebra").map(n=>({position:n.position,unitId:n.unitId,percent:profile.units.find(u=>u.unitId===n.unitId)?.percent})));
  planned.nodes=planned.nodes.map(n=>({...n,state:"completed",index:5,answers:Object.fromEntries(n.questionIds.map(id=>[id,"A"])),originalCorrect:5,xp:0,startedAt:now,completedAt:now}));
  planned=planLearning(planned,catalog,now);
}
assert(algebraReinforcement.some(n=>n.percent===0));
assert(algebraReinforcement.some(n=>n.percent>99.9));
const sparseCatalog=catalog.filter(q=>q.unitId!=="numeros-enteros-racionales"||q.number<=3);
const empty=createLearningState(now);empty.learnerId="audit-sparse";empty.seed=42;
const sparsePlan=planLearning(empty,sparseCatalog,now);
const mixed=sparsePlan.nodes.find(n=>n.unitId==="numeros-enteros-racionales");
const contents=mixed.questionIds.map(id=>sparseCatalog.find(q=>q.id===id).unitId);
assert(new Set(contents).size>1);
const result={mode:"reproductions-only-no-application-changes",reinforcementWeakGroupMissing:{confirmed:true,algebraReinforcement},sparseNodeMixedUnits:{confirmed:true,labelUnit:mixed.unitId,contents}};
writeFileSync(new URL("validacion-auditoria.json",import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));

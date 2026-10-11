// Observable contract/edit/export regressions. All content is fictional.
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const {inspectQuestion,applyQuestionPatch,answerCount}=require('../lib/exam-editing.ts');
const {buildPaessedPackage}=require('../lib/paessed-export.ts');const {readPaessed,validatePaessed}=require('../lib/paessed-package.ts');
function fixture(version='0.2.0'){
 const q={id:'fiction-q1',source_id:'fiction',number:'1',regions:[{page:1,bbox:[0,0,100,100]}],stem:[{type:'text',text:'Fictional question: choose 4.'}],options:[{label:'A',blocks:[{type:'text',text:'3'}]},{label:'B',blocks:[{type:'text',text:'4'}]}],answer:{label:'B',status:'verified',origin:'answer-key',source_ref:'fixture-key'},explanation:{blocks:[{type:'math',latex:'2+2=4',display:true}],status:'verified'},fidelity:{status:'reviewed',review_ref:'fixture-review'},issues:[]};
 if(version==='0.2.0')q.curriculum={eje:'Números',subeje:'Conjunto de los números enteros y racionales',en_temario:'si'};
 return {format:'paessed-benchmark',schema_version:version,pipeline:'demo',run:{id:'fixture',cli:'test',model:'none',created_at:'2026-01-01',certification:'old'},exam:{id:'fixture',title:'Fictional fixture',scope:'demo',expected_questions:[{id:q.id,source_id:q.source_id,number:q.number}]},sources:[{id:'fiction',name:'fiction.pdf',sha256:'a'.repeat(64),page_count:1,role:'exam'}],questions:[q],assets:[],evidence:[]};
}
(async()=>{
 for(const version of ['0.1.0','0.2.0']){
  const original=fixture(version);validatePaessed(original);
  const view=inspectQuestion(original,0);assert.equal(view.number,'1');assert.deepEqual(view.answerPath,['answer','label']);
  const patch={number:'2',stem:'Fictional changed question.',options:['3','4'],answer:'B'};
  const edited=applyQuestionPatch(original,0,patch);assert.equal(original.questions[0].number,'1');assert.equal(edited.questions[0].id,'fiction-q1');assert.equal(edited.exam.expected_questions[0].number,'2');assert.equal(edited.questions[0].fidelity.status,'pending');assert.equal(edited.questions[0].answer.status,'provisional');assert.equal(edited.run.certification,undefined);assert.equal(edited.run.eligible,false);
  if(version==='0.2.0'){assert.equal(edited.questions[0].curriculum.eje,null);assert(edited.questions[0].issues.includes('CURRICULUM_PENDING'));}
  const blob=await buildPaessedPackage({finalJson:edited});const roundtrip=await readPaessed(blob);assert.deepEqual(roundtrip.data,edited);
  const missing=fixture(version);missing.questions[0].answer={label:null,status:'missing',origin:'none',source_ref:null};assert.equal(answerCount(missing),0);
  const answerEdited=applyQuestionPatch(original,0,{number:'1',stem:view.stem,options:view.options.map(x=>x.text),answer:'A'});assert.equal(answerEdited.questions[0].fidelity.status,'reviewed');assert.equal(answerEdited.questions[0].answer.status,'provisional');if(version==='0.2.0')assert.deepEqual(answerEdited.questions[0].curriculum,original.questions[0].curriculum);
 }
 // A packaged image must survive a number edit byte-for-byte, with a new final hash.
 const pixels=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3X8AAAAASUVORK5CYII=','base64');
 const digest=require('node:crypto').createHash('sha256').update(pixels).digest('hex');
 const withImage=fixture();withImage.assets=[{id:'fig',path:'assets/fig.png',sha256:digest,mime:'image/png',source_id:'fiction',page:1,bbox:[0,0,20,20]}];withImage.questions[0].stem.push({type:'image',asset_id:'fig',alt:'Fictional one pixel'});
 const imageZip=new(require('jszip'))();const finalBytes=Buffer.from(JSON.stringify(withImage));imageZip.file('final.json',finalBytes);imageZip.file('assets/fig.png',pixels);imageZip.file('manifest.json',JSON.stringify({format:'paessed-package',schema_version:'0.1.0',files:[{path:'final.json',bytes:finalBytes.length,sha256:require('node:crypto').createHash('sha256').update(finalBytes).digest('hex')},{path:'assets/fig.png',bytes:pixels.length,sha256:digest}]}));
 const archive=new Blob([await imageZip.generateAsync({type:'uint8array'})]);const imageView=inspectQuestion(withImage,0);const imageEdited=applyQuestionPatch(withImage,0,{number:'2',stem:imageView.stem,options:imageView.options.map(x=>x.text),answer:imageView.answer});const imageRoundtrip=await readPaessed(await buildPaessedPackage({finalJson:imageEdited,archive}));assert.deepEqual(Buffer.from(await imageRoundtrip.blobs.get('fig').arrayBuffer()),pixels);assert.equal(imageRoundtrip.data.questions[0].id,'fiction-q1');
 const invalid=fixture();invalid.questions[0].curriculum.subeje='Unknown';assert.throws(()=>validatePaessed(invalid));
 const zip=require('jszip');const badArchive=new zip();badArchive.file('final.json','{}');await assert.rejects(readPaessed(await badArchive.generateAsync({type:'uint8array'})));
 console.log('PASS web compatibility, safe editing, null answers, manifest export and strict archive validation');
})().catch(error=>{console.error(error);process.exitCode=1});

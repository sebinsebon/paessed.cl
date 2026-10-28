const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const JSZip=require('jszip');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const exportsForTest={};
const code=ts.transpileModule(fs.readFileSync(__dirname+'/../lib/playground-imports.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
new Function('require','exports',code)(name=>name.includes('local-imports')?{}:name.includes('m1-curriculum')?require('../lib/m1-curriculum.ts'):require(name.startsWith('./')?'../lib/'+name.slice(2):name.replace('@/lib/','../lib/')),exportsForTest);
const {convertImportedExamQuestions}=exportsForTest;

test('all TESLA questions retain exact stem, option blocks, labels and verified answers',async()=>{
 const zip=await JSZip.loadAsync(fs.readFileSync(__dirname+'/fixtures/tesla-renderer.paessed'));
 const data=JSON.parse(await zip.file('final.json').async('string'));
 const original=JSON.stringify(data);
 const bank=convertImportedExamQuestions('tesla','TESLA',data);
 assert.equal(bank.length,65);
 for(let i=0;i<65;i++){
  const raw=data.questions[i],question=bank[i];
  assert.deepEqual(question.stemBlocks,raw.stem);
  assert.deepEqual(question.optionBlocks,raw.options.map(o=>o.blocks));
  assert.deepEqual(question.optionLabels,raw.options.map(o=>o.label));
  assert.equal(question.correct,raw.answer.status==='verified'?raw.answer.label:null);
  assert.deepEqual(question.explanationBlocks,raw.explanation.status==='verified'?raw.explanation.blocks:undefined);
 }
 assert.equal(JSON.stringify(data),original);
 assert.equal(bank[40].optionBlocks.flat().filter(b=>b.type==='image').length,4);
});

test('0.2.0 curriculum maps to filters, provisional answers cannot correct, and nonsequential labels survive',()=>{
 const stem=[{type:'text',text:'Pregunta'}];
 const question={number:8,stem,options:[{label:'B',blocks:[{type:'math',latex:'-2',display:false}]},{label:'D',blocks:[{type:'text',text:'4'}]}],answer:{label:'D',status:'verified'},explanation:{status:'verified',blocks:stem},curriculum:{eje:'Números',subeje:'Porcentaje',en_temario:'si'}};
 const data={format:'paessed-benchmark',schema_version:'0.2.0',questions:[question]};
 const converted=convertImportedExamQuestions('x','X',data)[0];
 assert.equal(converted.unitId,'porcentaje');assert.equal(converted.axis,'Números');assert.equal(converted.correct,'D');assert.deepEqual(converted.optionLabels,['B','D']);
 assert.deepEqual(converted.explanationBlocks,stem);
 question.answer.status='provisional';question.explanation.status='provisional';question.curriculum={eje:null,subeje:null,en_temario:'dudoso'};
 const pending=convertImportedExamQuestions('x','X',data)[0];assert.equal(pending.correct,null);assert.equal(pending.explanationBlocks,undefined);assert.equal(pending.explanation,'');assert.equal(pending.unitId,null);
});

test('generic and demo text remain supported without fake structured content',()=>{
 const bank=convertImportedExamQuestions('x','X',{year:2026,questions:[{prompt:'Texto',options:['Uno','Dos'],correct_answer:'B',explanation:'Porque',unitId:'porcentaje'}]});
 assert.equal(bank[0].stem,'Texto');assert.deepEqual(bank[0].options,['Uno','Dos']);assert.equal(bank[0].correct,'B');assert.equal(bank[0].year,2026);assert.equal(bank[0].unitId,'porcentaje');assert.equal(bank[0].stemBlocks,undefined);
});

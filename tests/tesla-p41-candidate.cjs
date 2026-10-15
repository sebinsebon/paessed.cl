const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const ts=require('typescript');
const JSZip=require('jszip');
const Reader=require('../lib/paessed-runtime/package-reader.js');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const {buildPaessedPackage}=require('../lib/paessed-export.ts');
const candidate=fs.readFileSync(__dirname+'/fixtures/tesla-p41-gold-rc1.paessed');
const original=fs.readFileSync(__dirname+'/fixtures/tesla-renderer.paessed');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const corrections={
 'crop-q41-opt-a':{bbox:[50,130,290,310],hash:'985a8d78973fd10c84e78c5853cf2c23fc07eb0116db605b8a67500073dad915'},
 'crop-q41-opt-b':{bbox:[330,130,570,310],hash:'7b88df4b8945fc1361e0d8c63b733a3ef8fb500bcc00aa95da94df3e7e640e4a'},
 'crop-q41-opt-c':{bbox:[50,310,290,500],hash:'7c324c70a9ac5e47c9539295d57f2fcf3c0bf8f150990bc0b29fb86307f8c8f3'},
 'crop-q41-opt-d':{bbox:[330,310,570,500],hash:'67917d6b8556f50605b315909b6f2029319a2640ef03627186651d3c29e5cb80'},
};
test('P41 candidate changes only four crop rectangles/hashes; all 65 questions and 14 other images stay exact',async()=>{
 assert.equal(hash(original),'1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4');
 assert.equal(hash(candidate),'d011d81d3a464f7f1755661af67cb8e70dee3ab2910550f769b977053519f30c');
 const before=await Reader.readPackage(original,{JSZip}),after=await Reader.readPackage(candidate,{JSZip});
 const expected=structuredClone(before.data);
 for(const asset of expected.assets){
  const correction=corrections[asset.id];
  if(correction){asset.bbox=correction.bbox;asset.sha256=correction.hash;}
  else assert.deepEqual(Buffer.from(await after.blobs.get(asset.id).arrayBuffer()),Buffer.from(await before.blobs.get(asset.id).arrayBuffer()));
 }
 assert.deepEqual(after.data,expected);assert.equal(after.blobs.size,18);assert.equal(after.data.questions.length,65);
 for(const asset of after.data.assets){
  const bytes=Buffer.from(await after.blobs.get(asset.id).arrayBuffer());assert.equal(hash(bytes),asset.sha256);
  if(corrections[asset.id]){
   assert.equal(bytes.readUInt32BE(16),480);
   assert.equal(bytes.readUInt32BE(20),asset.id.endsWith('-a')||asset.id.endsWith('-b')?360:380);
  }
 }
 assert.deepEqual([...after.blobs.keys()].sort(),[...before.blobs.keys()].sort());
});
for(const sourceKind of ['zip','paessed'])test(`P41 candidate ${sourceKind} export and strict reimport retain all PNG bytes, IDs and metadata`,async()=>{
 const input=await Reader.readPackage(candidate,{JSZip});
 const exported=await buildPaessedPackage({finalJson:input.data,archive:new Blob([candidate]),summary:{sourceKind}});
 const output=await Reader.readPackage(new Uint8Array(await exported.arrayBuffer()),{JSZip});
 assert.deepEqual(output.data,input.data);assert.equal(output.blobs.size,18);
 for(const[id,blob]of input.blobs)assert.deepEqual(Buffer.from(await output.blobs.get(id).arrayBuffer()),Buffer.from(await blob.arrayBuffer()));
});

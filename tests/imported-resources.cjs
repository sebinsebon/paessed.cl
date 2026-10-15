const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const JSZip=require('jszip');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const{resolveImportedResources}=require('../lib/imported-resources.ts');const{buildPaessedPackage}=require('../lib/paessed-export.ts');const{readPaessed}=require('../lib/paessed-package.ts');const{openResourceZip}=require('../lib/resource-zip.ts');
const strictBytes=fs.readFileSync(__dirname+'/fixtures/tesla-renderer.paessed'),auditBytes=fs.readFileSync(__dirname+'/fixtures/tesla-audit.zip');
const record=(data,bytes,sourceKind='zip')=>({finalJson:data,archive:bytes?new Blob([bytes]):undefined,summary:{sourceKind}});
test('one resource resolver covers strict, audit ZIP, nested ZIP and JSON attachments without changing data',async()=>{
 const strict=await readPaessed(strictBytes);const data=strict.data;
 const original=await JSZip.loadAsync(auditBytes);assert.deepEqual(JSON.parse(await original.file('final.json').async('string')),data);
 const nested=new JSZip();for(const[name,file]of Object.entries(original.files))if(!file.dir)nested.file('legacy/'+name,await file.async('uint8array'));const nestedBytes=await nested.generateAsync({type:'uint8array'});
 for(const[kind,bytes]of [['paessed',strictBytes],['zip',auditBytes],['zip',nestedBytes],['json',strictBytes]]){
  const frozen=JSON.stringify(data);const resources=await resolveImportedResources(record(data,bytes,kind));
  assert.equal(resources.byId.size,18);assert.equal(resources.byPath.size,18);assert.deepEqual(resources.errors,[]);assert.equal(JSON.stringify(data),frozen);
  for(const asset of data.assets){assert.deepEqual(Buffer.from(await resources.byId.get(asset.id).arrayBuffer()),Buffer.from(await strict.blobs.get(asset.id).arrayBuffer()));assert.equal(resources.byId.get(asset.id),resources.byPath.get(asset.path));}
  const exported=await readPaessed(await buildPaessedPackage(record(data,bytes,kind)));assert.deepEqual(exported.data,data);for(const[id,blob]of strict.blobs)assert.deepEqual(Buffer.from(await exported.blobs.get(id).arrayBuffer()),Buffer.from(await blob.arrayBuffer()));
 }
 // Audit files remain invalid in .paessed; only the separate generic container
 // resolver accepts extras and emits a freshly validated package on export.
 await assert.rejects(readPaessed(auditBytes));await assert.rejects(resolveImportedResources(record(data,auditBytes,'paessed')));
 const json=await resolveImportedResources(record(data,null,'json'));assert.equal(json.byId.size,0);assert.equal(json.errors.length,18);assert(json.errors.every(e=>e.includes('Sin archivo de imágenes adjunto')));await assert.rejects(buildPaessedPackage(record(data,null,'json')));
});
test('missing and corrupt resources are isolated; no invented or unverified image is returned',async()=>{
 const data=(await readPaessed(strictBytes)).data;const asset=data.assets[0];
 const missing=await JSZip.loadAsync(auditBytes);missing.remove(asset.path);
 const missingResult=await resolveImportedResources(record(data,await missing.generateAsync({type:'uint8array'})));
 assert.equal(missingResult.byId.size,17);assert.equal(missingResult.coverage.find(r=>r.id===asset.id).found,false);assert.equal(missingResult.errors.length,1);await assert.rejects(buildPaessedPackage(record(data,await missing.generateAsync({type:'uint8array'}))));
 const bad=await JSZip.loadAsync(auditBytes);const pixels=await bad.file(asset.path).async('uint8array');pixels[pixels.length-10]^=1;bad.file(asset.path,pixels);
 const badResult=await resolveImportedResources(record(data,await bad.generateAsync({type:'uint8array'})));assert.equal(badResult.byId.size,17);assert(badResult.errors[0].includes('SHA-256 incorrecto'));assert.equal(badResult.coverage.find(r=>r.id===asset.id).loaded,false);
});
test('unsafe ZIP paths, duplicate names, corruption, limits and cancellation fail safely',async()=>{
 const unsafe=new JSZip();unsafe.file('../evil.png','x');await assert.rejects(openResourceZip(new Blob([await unsafe.generateAsync({type:'uint8array'})])));
 const duplicate=new JSZip();duplicate.file('assets/a.png','x');duplicate.file('assets/A.png','x');await assert.rejects(openResourceZip(new Blob([await duplicate.generateAsync({type:'uint8array'})])));
 const stored=new JSZip();stored.file('final.json','{}');stored.file('assets/a.png','pixels');const bytes=await stored.generateAsync({type:'uint8array',compression:'STORE'});const bad=new Uint8Array(bytes);bad[Buffer.from(bad).indexOf('pixels')]^=1;
 const reader=await openResourceZip(new Blob([bad]));await assert.rejects(reader.read('assets/a.png'));
 const oversized=new Uint8Array(bytes);const view=new DataView(oversized.buffer);for(let i=0;i<oversized.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,300*1024*1024,true);break;}
 await assert.rejects(openResourceZip(new Blob([oversized])));await assert.rejects(openResourceZip(new Blob([strictBytes]),()=>true));
 const safe=await openResourceZip(new Blob([strictBytes]));assert.throws(()=>safe.locate('../assets/a.png'));assert.equal(safe.locate('assets/not-present.png'),undefined);
});
test('0.2.0 curriculum and images survive generic ZIP export unchanged',async()=>{
 const source=(await readPaessed(strictBytes)).data;const data=structuredClone(source);data.schema_version='0.2.0';for(const q of data.questions)q.curriculum={eje:'Números',subeje:'Conjunto de los números enteros y racionales',en_temario:'si'};
 const exported=await readPaessed(await buildPaessedPackage(record(data,auditBytes)));assert.deepEqual(exported.data,data);assert.equal(exported.blobs.size,18);
});

test('legacy path references and typed table image IDs resolve through the same registry',async()=>{
 const data=(await readPaessed(strictBytes)).data;const asset=data.assets[0];
 const legacy={assets:[asset],questions:[{text:`![imagen](${asset.path})`}]};
 const resolved=await resolveImportedResources(record(legacy,auditBytes));
 assert.equal(resolved.byId.size,1);assert.equal(resolved.byId.get(asset.id),resolved.byPath.get(asset.path));assert.deepEqual(resolved.errors,[]);
 const {imageReferences,blockAssetIds}=require('../lib/imported-resources.ts');
 assert.deepEqual(imageReferences(legacy),[asset.path]);
 assert.deepEqual(blockAssetIds([{type:'table',rows:[[[{type:'image',asset_id:asset.id}]]]}]),[asset.id]);
});

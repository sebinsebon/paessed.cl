const{test,expect}=require('@playwright/test');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const JSZip=require('jszip');const Reader=require('../lib/paessed-runtime/package-reader.js');
const strictBytes=fs.readFileSync(path.join(__dirname,'fixtures/tesla-renderer.paessed'));const auditBytes=fs.readFileSync(path.join(__dirname,'fixtures/tesla-audit.zip'));
let data,finalBytes;
test.beforeAll(async()=>{const zip=await JSZip.loadAsync(auditBytes);finalBytes=await zip.file('final.json').async('nodebuffer');data=JSON.parse(finalBytes);expect((await Reader.readPackage(strictBytes,{JSZip})).data).toEqual(data);});
async function importTesla(page,mode,number=25){
 await page.goto('/app/ensayos/importar');const buffer=mode==='json'?finalBytes:mode==='paessed'?strictBytes:auditBytes;const name=mode==='json'?'final.json':mode==='paessed'?'TESLA.paessed':'package_corregido.zip';
 await page.locator('input[type=file]').setInputFiles({name,mimeType:mode==='json'?'application/json':'application/zip',buffer});await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('paessed-local');r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onsuccess=()=>{const v=q.result.sort((a,b)=>b.summary.importedAt.localeCompare(a.summary.importedAt))[0];resolve({id:v.summary.id,kind:v.summary.sourceKind,data:v.finalJson,title:v.summary.title});db.close()}}}));
 expect(saved.kind).toBe(mode);expect(saved.data).toEqual(data);
 await page.evaluate(({id,number})=>localStorage.setItem('paessed-imported-essay-progress-v1-'+id,JSON.stringify({index:number-1,answers:{},bookmarks:[],strokes:{}})),{id:saved.id,number});await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();return saved;
}
async function question(page,n){await page.getByRole('button',{name:'Abrir mapa de preguntas',exact:true}).click();await page.getByRole('dialog').locator('button[aria-label^="Pregunta "]').nth(n-1).click();await expect(page.getByText(`${n} de 65 preguntas`,{exact:true})).toBeVisible();}
function refs(blocks){return blocks.flatMap(b=>b.type==='image'?[b.asset_id]:b.type==='table'?b.rows.flatMap(row=>row.flatMap(refs)):[]);}
function questionRefs(q){return [...refs(q.stem),...q.options.flatMap(o=>refs(o.blocks))];}
async function loaded(page,q){
 const expected=questionRefs(q);await expect(page.locator('.paessed-blocks img')).toHaveCount(expected.length);
 await expect.poll(()=>page.locator('.paessed-blocks img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 await expect(page.locator('.paessed-blocks [role="alert"]')).toHaveCount(0);
 const hashes=await page.locator('.paessed-blocks img').evaluateAll(async images=>Promise.all(images.map(async i=>{const bytes=await(await fetch(i.src)).arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')})));
 expect(hashes).toEqual(expected.map(id=>data.assets.find(a=>a.id===id).sha256));
}
for(const mode of ['zip','paessed','json'])test(`all 65 TESLA questions and alternatives: resource coverage ${mode}`,async({page},testInfo)=>{
 test.setTimeout(120000);await importTesla(page,mode,1);const coverage=[];
 for(const q of data.questions){
  await question(page,Number(q.number));const expected=questionRefs(q);
  await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(q.options.length);
  if(mode==='json'){
   await expect(page.locator('.paessed-blocks img')).toHaveCount(0);
   await expect(page.locator('.paessed-blocks [role="alert"]')).toHaveCount(expected.length);
   if(expected.length)await expect(page.locator('[role="alert"]').filter({hasText:'Sin archivo de imágenes adjunto'})).toBeVisible();
  }else await loaded(page,q);
  coverage.push({question:q.number,resourceIds:expected,expected:expected.length,found:mode==='json'?0:expected.length,loaded:mode==='json'?0:expected.length,errors:mode==='json'?expected.map(id=>`${id}: sin archivo adjunto`):[]});
 }
 await testInfo.attach('coverage-'+mode+'.json',{body:Buffer.from(JSON.stringify(coverage,null,2)),contentType:'application/json'});
 if(process.env.PAESSED_COVERAGE_DIR){fs.mkdirSync(process.env.PAESSED_COVERAGE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.PAESSED_COVERAGE_DIR,`coverage-${mode}.json`),JSON.stringify(coverage,null,2));}
});
for(const mode of ['zip','paessed'])for(const n of [25,38,41,42,43])test(`TESLA images P${n} ${mode} render and match snapshot`,async({page})=>{
 await importTesla(page,mode,n);await loaded(page,data.questions.find(q=>Number(q.number)===n));await page.evaluate(()=>document.fonts.ready);
 // Each option is captured separately when its graph exceeds the scroll viewport.
 if(n===41){const choices=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');for(let i=0;i<4;i++)await expect(choices.nth(i)).toHaveScreenshot(`tesla-p41-option-${i}.png`);}
 else await expect(page.locator('.paessed-blocks img')).toHaveScreenshot(`tesla-p${n}-image.png`);
});
test('audit ZIP export and real reimport preserve every image and the original JSON',async({page},testInfo)=>{
 const saved=await importTesla(page,'zip',41);await loaded(page,data.questions[40]);await page.getByRole('link',{name:'Volver a Ensayos',exact:true}).click();
 const card=page.locator('article').filter({has:page.getByRole('link',{name:/Practicar: ENSAYO TESLA/})});await card.getByRole('button',{name:'Detalles',exact:true}).click();await page.getByRole('button',{name:'Abrir ajustes del ensayo '+saved.title,exact:true}).click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar .paessed',exact:true}).click();const downloaded=await downloading;const target=testInfo.outputPath('exported.paessed');await downloaded.saveAs(target);const bytes=fs.readFileSync(target);const exported=await Reader.readPackage(bytes,{JSZip});expect(exported.data).toEqual(data);expect(exported.blobs.size).toBe(18);
 for(const asset of data.assets)expect(crypto.createHash('sha256').update(Buffer.from(await exported.blobs.get(asset.id).arrayBuffer())).digest('hex')).toBe(asset.sha256);
 await page.goto('/app/ensayos/importar');await page.locator('input[type=file]').setInputFiles(target);await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const reimported=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('paessed-local');r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onsuccess=()=>{resolve(q.result.find(v=>v.summary.fileName==='exported.paessed')?.summary);db.close()}}}));
 expect(reimported.sourceKind).toBe('paessed');expect(reimported.id).not.toBe(saved.id);
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).and(page.locator(`a[href$="/${reimported.id}"]`)).click();await question(page,41);await loaded(page,data.questions[40]);
});

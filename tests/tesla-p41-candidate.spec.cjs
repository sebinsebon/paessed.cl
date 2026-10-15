const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const JSZip=require('jszip');
const Reader=require('../lib/paessed-runtime/package-reader.js');
const bytes=fs.readFileSync(path.join(__dirname,'fixtures/tesla-p41-gold-rc1.paessed'));
let data;
test.beforeAll(async()=>{
 expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('d011d81d3a464f7f1755661af67cb8e70dee3ab2910550f769b977053519f30c');
 data=(await Reader.readPackage(bytes,{JSZip})).data;
});
async function records(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const r=indexedDB.open('paessed-local');r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=()=>reject(q.error);q.onsuccess=()=>{resolve(q.result);db.close();}};
 }));
}
async function importCandidate(page,mode){
 await page.goto('/app/ensayos/importar');
 await page.locator('input[type=file]').setInputFiles({name:`TESLA-P41-rc1.${mode}`,mimeType:'application/zip',buffer:bytes});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const saved=(await records(page))[0];expect(saved.summary.sourceKind).toBe(mode);expect(saved.finalJson).toEqual(data);
 await page.evaluate(id=>localStorage.setItem('paessed-imported-essay-progress-v1-'+id,JSON.stringify({index:40,answers:{},bookmarks:[],strokes:{}})),saved.summary.id);
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();await openRecord(page,saved.summary.id);return saved.summary;
}
async function openRecord(page,id){await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).and(page.locator(`a[href$="/${id}"]`)).click();}
async function question(page,n){
 await page.getByRole('button',{name:'Abrir mapa de preguntas',exact:true}).click();
 await page.getByRole('dialog').locator('button[aria-label^="Pregunta "]').nth(n-1).click();
 await expect(page.getByText(`${n} de 65 preguntas`,{exact:true})).toBeVisible();
}
function refs(blocks){return blocks.flatMap(b=>b.type==='image'?[b.asset_id]:b.type==='table'?b.rows.flatMap(row=>row.flatMap(refs)):[]);}
async function imagesMatch(page,q){
 const ids=[...refs(q.stem),...q.options.flatMap(o=>refs(o.blocks))];const images=page.locator('.paessed-blocks img');
 await expect(images).toHaveCount(ids.length);
 await expect.poll(()=>images.evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 await expect(page.locator('.paessed-blocks [role="alert"]')).toHaveCount(0);
 const actual=await images.evaluateAll(async imgs=>Promise.all(imgs.map(async i=>{
  const hash=await crypto.subtle.digest('SHA-256',await(await fetch(i.src)).arrayBuffer());
  const rect=i.getBoundingClientRect();
  return {hash:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''),width:i.naturalWidth,height:i.naturalHeight,ratio:rect.width/rect.height};
 })));
 expect(actual.map(i=>i.hash)).toEqual(ids.map(id=>data.assets.find(a=>a.id===id).sha256));
 for(let i=0;i<ids.length;i++){
  expect(Math.abs(actual[i].ratio-actual[i].width/actual[i].height)).toBeLessThan(.01);
  if(ids[i].startsWith('crop-q41-')){expect(actual[i].width).toBe(480);expect(actual[i].height).toBe(/-opt-[ab]$/.test(ids[i])?360:380);}
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
for(const mode of ['zip','paessed'])for(const mobile of [false,true])for(const theme of ['light','dark'])test(`P41 Gold candidate ${mode} — ${mobile?'mobile':'desktop'} ${theme}: four complete graphs`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.addInitScript(theme=>localStorage.setItem('paessed-imported-paper-theme',theme),theme);
 await importCandidate(page,mode);await imagesMatch(page,data.questions[40]);await page.evaluate(()=>document.fonts.ready);
 const choices=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');await expect(choices).toHaveCount(4);
 for(let i=0;i<4;i++)await expect(choices.nth(i)).toHaveScreenshot(`candidate-p41-${i}-${mobile?'mobile':'desktop'}-${theme}.png`);
});
for(const mode of ['zip','paessed'])test(`P41 Gold candidate ${mode}: all 65 questions and 18 resources remain available`,async({page})=>{
 test.setTimeout(120000);await importCandidate(page,mode);
 for(const q of data.questions){await question(page,Number(q.number));await imagesMatch(page,q);await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(q.options.length);}
});
for(const mode of ['zip','paessed'])test(`P41 Gold candidate ${mode}: UI export and explicit reimport preserve 18 PNGs and display complete labels`,async({page},testInfo)=>{
 const saved=await importCandidate(page,mode);await imagesMatch(page,data.questions[40]);
 await page.getByRole('link',{name:'Volver a Ensayos',exact:true}).click();
 const card=page.locator('article').filter({has:page.locator(`a[href$="/${saved.id}"]`)});
 await card.getByRole('button',{name:'Detalles',exact:true}).click();await page.getByRole('button',{name:'Abrir ajustes del ensayo '+saved.title,exact:true}).click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar .paessed',exact:true}).click();
 const download=await downloading;const target=testInfo.outputPath('candidate-exported.paessed');await download.saveAs(target);
 const exported=await Reader.readPackage(fs.readFileSync(target),{JSZip});expect(exported.data).toEqual(data);expect(exported.blobs.size).toBe(18);
 for(const asset of data.assets)expect(crypto.createHash('sha256').update(Buffer.from(await exported.blobs.get(asset.id).arrayBuffer())).digest('hex')).toBe(asset.sha256);
 await page.goto('/app/ensayos/importar');await page.locator('input[type=file]').setInputFiles(target);
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const imported=(await records(page)).find(r=>r.summary.fileName==='candidate-exported.paessed');
 expect(imported.summary.sourceKind).toBe('paessed');expect(imported.summary.id).not.toBe(saved.id);expect(imported.finalJson).toEqual(data);
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();await openRecord(page,imported.summary.id);await question(page,41);await imagesMatch(page,data.questions[40]);
 const choices=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');await page.evaluate(()=>document.fonts.ready);
 for(let i=0;i<4;i++)await expect(choices.nth(i)).toHaveScreenshot(`candidate-p41-${i}-desktop-light.png`);
 await testInfo.attach('candidate-exported.paessed',{path:target,contentType:'application/zip'});
});

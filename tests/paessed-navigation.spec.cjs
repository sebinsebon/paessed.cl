const{test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const reader=require('../lib/paessed-runtime/package-reader.js');
const JSZip=require('jszip');
const assert=require('node:assert/strict');
const fixture=path.join(__dirname,'fixtures/tesla-renderer.paessed');
let expectedFinal,fixtureBytes,finalBytes,genericZipBytes;
test.beforeAll(async()=>{
 const bytes=fixtureBytes=fs.readFileSync(fixture);
 expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4');
 expectedFinal=(await reader.readPackage(bytes,{JSZip})).data;
 const zip=await JSZip.loadAsync(bytes);
 finalBytes=await zip.file('final.json').async('nodebuffer');
 expect(crypto.createHash('sha256').update(finalBytes).digest('hex')).toBe('9186ec0950ffd5bbcb278a145f67fac5dda32b2e8d63bacfde1e0eb5739a5d97');
 const generic=new JSZip();
 generic.file('legacy/final.json',finalBytes);
 generic.file('audit.txt','Generic import regression: outside strict inventory.');
 genericZipBytes=await generic.generateAsync({type:'nodebuffer'});
 await assert.rejects(reader.readPackage(genericZipBytes,{JSZip}));
});
async function importTesla(page,{mode='paessed',number=3}={}){
 await page.goto('/app/ensayos/importar');
 const buffer=mode==='json'?finalBytes:mode==='generic-zip'?genericZipBytes:fixtureBytes;
 const name=mode==='json'?'final.json':mode==='paessed'?'TESLA.paessed':mode==='zip'?'TESLA.zip':'TESLA-generic.zip';
 await page.locator('input[type=file]').setInputFiles({name,mimeType:mode==='json'?'application/json':'application/zip',buffer});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();
 await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const {id,data,kind}=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{
   const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=reject;
   q.onsuccess=()=>{resolve({id:q.result[0].summary.id,data:q.result[0].finalJson,kind:q.result[0].summary.sourceKind});db.close()};
  };
 }));
 expect(data).toEqual(expectedFinal);
 expect(kind).toBe(mode==='generic-zip'?'zip':mode);
 await page.evaluate(({id,number})=>localStorage.setItem('paessed-imported-essay-progress-v1-'+id,JSON.stringify({index:number-1,answers:{},bookmarks:[],strokes:{}})),{id,number});
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();
 return id;
}
async function styledMath(page){
 const mathml=page.locator('.paessed-blocks .katex-mathml');
 await expect(mathml.first()).toBeAttached();
 let states;
 // Resource loading can replace a block between locator resolution and this
 // evaluation. Detached nodes have empty styles, but are never visible. Retry
 // only that stale sample; keep the actual clipping checks strict below.
 await expect.poll(async()=>{
  states=await mathml.evaluateAll(nodes=>nodes.map(e=>{
   if(!e.isConnected)return {connected:false};
   const s=getComputedStyle(e);const r=e.getBoundingClientRect();
   return {connected:true,position:s.position,overflow:s.overflow,width:r.width,height:r.height};
  }));
  return states.length>0&&states.every(s=>s.connected);
 }).toBe(true);
 expect(states.every(s=>s.position==='absolute'&&s.overflow==='hidden'&&s.width<=1&&s.height<=1),JSON.stringify(states)).toBe(true);
 expect(await page.locator('.paessed-blocks .katex-html').evaluateAll(nodes=>nodes.every(e=>e.getAttribute('aria-hidden')==='true'))).toBe(true);
 await expect(page.locator('.paessed-blocks [role="alert"]')).toHaveCount(0);
}

for(const mode of ['paessed','zip','json','generic-zip'])test(`cold client navigation ${mode} never exposes duplicate MathML while KaTeX CSS loads`,async({page})=>{
 await importTesla(page,{mode});
 let release;let requested;
 const requestArrived=new Promise(resolve=>{requested=resolve});
 const held=new Promise(resolve=>{release=resolve});
 await page.route('**/paessed/katex/katex.min.css',async route=>{requested();await held;await route.continue()});
 const opening=page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
 try{
  await requestArrived;
  // Allow client effects/layout to commit while the required stylesheet is held.
  await page.waitForTimeout(250);
  const exposed=await page.locator('.paessed-blocks .katex-mathml').evaluateAll(nodes=>nodes.some(e=>getComputedStyle(e).position!=='absolute'));
  expect(exposed).toBe(false);
 }finally{release();}
 await opening;
 await expect(page.getByText('3 de 65 preguntas',{exact:true})).toBeVisible();
 await styledMath(page);
 // A reader-only stylesheet must stay available after leaving and re-entering.
 await page.getByRole('link',{name:'Volver a Ensayos',exact:true}).click();
 await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
 await styledMath(page);
 await page.reload();await styledMath(page);
});

for(const mode of ['paessed','zip','json','generic-zip'])for(const mobile of [false,true])for(const theme of ['light','dark']){
 test(`TESLA P2 ${mode} and all four options — ${mobile?'mobile':'desktop'} ${theme}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await importTesla(page,{mode,number:2});
  await page.evaluate(theme=>localStorage.setItem('paessed-imported-paper-theme',theme),theme);
  await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
  await styledMath(page);
  // Resource declarations are deduplicated across stem and four option hosts.
  await expect(page.locator('link[rel="stylesheet"][href="/paessed/katex/katex.min.css"]')).toHaveCount(1);
  await expect(page.locator('link[rel="stylesheet"][href="/paessed/block-renderer.css"]')).toHaveCount(1);
  const hosts=page.locator('.paessed-blocks');
  await expect(hosts.first().locator('.katex')).toHaveCount(7);
  expect(await hosts.first().locator('annotation').allTextContents()).toEqual(['m','n','m','n','-9','m','n']);
  const choices=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');
  await expect(choices).toHaveCount(4);
  for(const choice of await choices.all())await expect(choice).toBeVisible();
  expect(await choices.locator('annotation').allTextContents()).toEqual(['-4','-2','2','4']);
  await page.evaluate(()=>document.fonts.ready);
  // ZIP and JSON have the same generic UI and must produce the same snapshot.
  await expect(page).toHaveScreenshot(`tesla-p2-${mode==='paessed'?'paessed':'generic'}-${mobile?'mobile':'desktop'}-${theme}.png`);
 });
}

for(const mode of ['paessed','zip','json','generic-zip'])test(`inline math stays styled across question changes — ${mode}`,async({page})=>{
 await importTesla(page,{mode,number:2});await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
 for(const n of [2,6,19]){
  await page.getByRole('button',{name:'Abrir mapa de preguntas',exact:true}).click();
  await page.getByRole('dialog',{name:'Mapa del ensayo importado'}).locator('button[aria-label^="Pregunta "]').nth(n-1).click();
  await expect(page.getByText(`${n} de 65 preguntas`,{exact:true})).toBeVisible();
  await styledMath(page);
  await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(4);
 }
});

for(const mobile of [false,true])for(const theme of ['light','dark']){
 test(`TESLA P3 and all four options — ${mobile?'mobile':'desktop'} ${theme}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await importTesla(page);
  await page.evaluate(theme=>localStorage.setItem('paessed-imported-paper-theme',theme),theme);
  await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
  await styledMath(page);
  const choices=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');
  await expect(choices).toHaveCount(4);for(const choice of await choices.all())await expect(choice).toBeVisible();
  await expect(page.locator('.paessed-blocks').first().locator('mfrac')).toHaveCount(3);
  await expect(page.locator('.paessed-math-display .paessed-math-punctuation')).toHaveText('?');
  await expect(page.locator('.paessed-paragraph').filter({hasText:/^\?$/})).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
  await expect(page).toHaveScreenshot(`tesla-p3-${mobile?'mobile':'desktop'}-${theme}.png`);
 });
}

test('fraction/radical questions keep one visual representation across question navigation',async({page})=>{
 await importTesla(page);await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
 for(const n of [3,15,19,20,50]){
  await page.getByRole('button',{name:'Abrir mapa de preguntas',exact:true}).click();
  await page.getByRole('dialog',{name:'Mapa del ensayo importado'}).locator('button[aria-label^="Pregunta "]').nth(n-1).click();
  await expect(page.getByText(`${n} de 65 preguntas`,{exact:true})).toBeVisible();
  await styledMath(page);
  await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

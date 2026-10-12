const{test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const reader=require('../lib/paessed-runtime/package-reader.js');
const fixture=path.join(__dirname,'fixtures/tesla-renderer.paessed');
let expectedFinal;
test.beforeAll(async()=>{
 const bytes=fs.readFileSync(fixture);
 expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4');
 expectedFinal=(await reader.readPackage(bytes,{JSZip:require('jszip')})).data;
});
async function importTesla(page){
 await page.goto('/app/ensayos/importar');
 await page.locator('input[type=file]').setInputFiles(fixture);
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();
 await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const {id,data}=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{
   const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=reject;
   q.onsuccess=()=>{resolve({id:q.result[0].summary.id,data:q.result[0].finalJson});db.close()};
  };
 }));
 expect(data).toEqual(expectedFinal);
 await page.evaluate(id=>localStorage.setItem('paessed-imported-essay-progress-v1-'+id,JSON.stringify({index:2,answers:{},bookmarks:[],strokes:{}})),id);
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();
 return id;
}
async function styledMath(page){
 const mathml=page.locator('.paessed-blocks .katex-mathml');
 await expect(mathml.first()).toBeAttached();
 expect(await mathml.evaluateAll(nodes=>nodes.every(e=>{
  const s=getComputedStyle(e);const r=e.getBoundingClientRect();
  return s.position==='absolute'&&s.overflow==='hidden'&&r.width<=1&&r.height<=1;
 }))).toBe(true);
 expect(await page.locator('.paessed-blocks .katex-html').evaluateAll(nodes=>nodes.every(e=>e.getAttribute('aria-hidden')==='true'))).toBe(true);
 await expect(page.locator('.paessed-blocks [role="alert"]')).toHaveCount(0);
}

test('cold client navigation never exposes duplicate MathML while KaTeX CSS loads',async({page})=>{
 await importTesla(page);
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

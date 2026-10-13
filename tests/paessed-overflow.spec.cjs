const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const JSZip=require('jszip');
const Reader=require('../lib/paessed-runtime/package-reader.js');
const root=path.resolve(__dirname,'..');
const bytes=fs.readFileSync(path.join(__dirname,'fixtures/tesla-renderer.paessed'));
let data,images;
test.beforeAll(async()=>{
 const parsed=await Reader.readPackage(bytes,{JSZip});data=parsed.data;
 images=await Promise.all(['crop-q47-triangulo','crop-q38-grafico-precios'].map(async id=>[id,'data:image/png;base64,'+Buffer.from(await parsed.blobs.get(id).arrayBuffer()).toString('base64')]));
});
async function metrics(locator){return locator.evaluate(e=>{
 const style=getComputedStyle(e);e.scrollTop=100;const top=e.scrollTop;e.scrollTop=0;
 return {x:style.overflowX,y:style.overflowY,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight],top,tabindex:e.getAttribute('tabindex'),role:e.getAttribute('role'),className:e.className};
});}
async function importP47(page,mode,theme){
 await page.goto('/app/ensayos/importar');await page.evaluate(theme=>localStorage.setItem('paessed-imported-paper-theme',theme),theme);
 await page.locator('input[type=file]').setInputFiles({name:`TESLA.${mode}`,mimeType:'application/zip',buffer:bytes});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('paessed-local');r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onsuccess=()=>{resolve(q.result[0]);db.close();}}}));
 expect(saved.summary.sourceKind).toBe(mode);expect(saved.finalJson).toEqual(data);
 await page.evaluate(id=>localStorage.setItem('paessed-imported-essay-progress-v1-'+id,JSON.stringify({index:46,answers:{},bookmarks:[],strokes:{}})),saved.summary.id);
 await page.getByRole('link',{name:'Ver en Mis ensayos',exact:true}).click();await page.getByRole('link',{name:/Practicar: ENSAYO TESLA/}).click();
 await expect(page.getByText('47 de 65 preguntas',{exact:true})).toBeVisible();
 const image=page.locator('.paessed-blocks img');await expect(image).toHaveCount(1);await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await page.evaluate(()=>document.fonts.ready);
}
async function noScroll(locator){
 const state=await metrics(locator);expect(state.x).toBe('visible');expect(state.y).toBe('visible');expect(state.top).toBe(0);expect(state.tabindex).toBeNull();
}
async function horizontalOnly(locator){
 const state=await metrics(locator);expect(state.x).toBe('auto');expect(state.y).toBe('hidden');expect(state.top).toBe(0);
 expect(state.scroll[0]).toBeGreaterThan(state.client[0]+1);expect(state.scroll[1]).toBeLessThanOrEqual(state.client[1]);expect(state.tabindex).toBe('0');expect(state.role).toBe('region');
 const bounds=await locator.evaluate(e=>{
  const top=e.getBoundingClientRect().top+e.clientTop,bottom=top+e.clientHeight;
  return [...e.querySelectorAll('.katex-html, .katex-html span, .katex-html svg')].every(node=>{const r=node.getBoundingClientRect();return !r.width||!r.height||(r.top>=top-1&&r.bottom<=bottom+1);});
 });expect(bounds).toBe(true);
 const reachable=await locator.evaluate(e=>{
  const content=e.querySelector('.katex')||e.querySelector('table');e.scrollLeft=0;
  const start=content.getBoundingClientRect().left>=e.getBoundingClientRect().left-1;
  e.scrollLeft=100000;const end=content.getBoundingClientRect().right<=e.getBoundingClientRect().left+e.clientWidth+1;
  const moved=e.scrollLeft>0;e.scrollLeft=0;return{start,end,moved};
 });expect(reachable).toEqual({start:true,end:true,moved:true});
}
async function keyboardScroll(locator){await locator.focus();await locator.press('ArrowRight');await expect.poll(()=>locator.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);}
for(const mode of ['zip','paessed'])for(const mobile of [false,true])for(const theme of ['light','dark'])test(`TESLA P47 ${mode}: fitting formulas and image have no internal scroll — ${mobile?'mobile':'desktop'} ${theme}`,async({page},testInfo)=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await importP47(page,mode,theme);
 const display=page.locator('.paessed-math-display');await expect(display).toHaveCount(1);
 await testInfo.attach('p47-overflow.json',{body:Buffer.from(JSON.stringify(await metrics(display))),contentType:'application/json'});
 await noScroll(display);for(const inline of await page.locator('.paessed-math-inline').all())await noScroll(inline);
 expect(await page.locator('.paessed-math-overflow').count()).toBe(0);await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(4);
 const image=page.locator('.paessed-image');const ratio=await image.evaluate(i=>{const r=i.getBoundingClientRect();return Math.abs(r.width/r.height-i.naturalWidth/i.naturalHeight);});expect(ratio).toBeLessThan(.01);
 await page.mouse.move(0,0);
 await expect(display).toHaveScreenshot(`p47-formula-${mobile?'mobile':'desktop'}-${theme}.png`);await expect(image).toHaveScreenshot(`p47-image-${mobile?'mobile':'desktop'}-${theme}.png`);
});
async function fixture(page,mobile,theme){
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.goto('/app/inicio');
 await page.addStyleTag({url:new URL('/paessed/katex/katex.min.css',page.url()).href});await page.addStyleTag({url:new URL('/paessed/block-renderer.css',page.url()).href});
 await page.addScriptTag({path:path.join(root,'lib/paessed-runtime/katex.js')});await page.addScriptTag({path:path.join(root,'lib/paessed-runtime/block-renderer.js')});
 await page.evaluate(({mobile,theme})=>{
  const section=document.createElement('section');section.id='overflow-fixture';section.style.cssText=`position:fixed;inset:0;z-index:99999;padding:24px;overflow:auto;background:${theme==='dark'?'#111827':'white'};color:${theme==='dark'?'#f8fafc':'#111827'}`;
  const content=document.createElement('div');content.id='overflow-content';content.className='paessed-blocks';content.style.cssText=`width:min(100%,960px);font: ${mobile?18:21}px Georgia,serif;--pg-border:${theme==='dark'?'#334155':'#e2e8f0'}`;
  section.append(content);document.body.append(section);
 },{mobile,theme});
}
test('P47 resize adds and removes its horizontal viewport without stale padding or observer errors',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:390,height:844});await importP47(page,'zip','light');
 const display=page.locator('.paessed-math-display');await noScroll(display);
 await page.setViewportSize({width:320,height:844});await expect.poll(()=>display.evaluate(e=>getComputedStyle(e).overflowX)).toBe('auto');await horizontalOnly(display);await keyboardScroll(display);
 await page.setViewportSize({width:1440,height:1000});await expect.poll(()=>display.evaluate(e=>getComputedStyle(e).overflowX)).toBe('visible');await noScroll(display);
 expect(await display.evaluate(e=>e.style.getPropertyValue('--paessed-overflow-pad-end'))).toBe('');
 expect(errors).toEqual([]);
});
async function render(page,blocks){
 await page.evaluate(({blocks,images})=>window.PaessedBlocks.renderBlocks(document.getElementById('overflow-content'),blocks,{katex:window.katex,assetUrls:new Map(images)}),{blocks,images});
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.PaessedBlocks.fitMath(document.getElementById('overflow-content')));
}
for(const mobile of [false,true])for(const theme of ['light','dark'])test(`short/tall/long math, tables and proportional images — ${mobile?'mobile':'desktop'} ${theme}`,async({page})=>{
 await fixture(page,mobile,theme);
 const rich='\\frac{\\sqrt[4]{x_1^{12}+y^2}}{\\sqrt{\\frac{1}{1+x_1}}}';
 for(const display of [false,true]){
  await render(page,[{type:'math',latex:rich,display}]);await noScroll(page.locator('#overflow-content .paessed-math'));await expect(page.locator('#overflow-content mroot')).toHaveCount(1);await expect(page.locator('#overflow-content mfrac')).toHaveCount(2);
  await render(page,[{type:'math',latex:Array(24).fill(rich).join('+'),display}]);const math=page.locator('#overflow-content .paessed-math');await horizontalOnly(math);
  if(display)await expect(math).toHaveScreenshot(`long-formula-${mobile?'mobile':'desktop'}-${theme}.png`);
  // Native keyboard scrolling animates independently of CSS animations. Test
  // it after the screenshot so capture timing cannot change the scroll offset.
  await keyboardScroll(math);
 }
 await render(page,[{type:'table',rows:[[[{type:'text',text:'A'}],[{type:'text',text:'B'}]]]}]);await noScroll(page.locator('.paessed-table-wrap'));
 await render(page,[{type:'table',rows:[Array.from({length:16},(_,i)=>[{type:'text',text:String(i)},{type:'math',latex:rich,display:false}])]}]);const table=page.locator('.paessed-table-wrap');await horizontalOnly(table);
 await expect(table).toHaveScreenshot(`wide-table-${mobile?'mobile':'desktop'}-${theme}.png`);
 await keyboardScroll(table);
 await render(page,[{type:'image',asset_id:'crop-q47-triangulo',alt:'Triángulo original'},{type:'image',asset_id:'crop-q38-grafico-precios',alt:'Gráfico original'}]);
 for(const image of await page.locator('#overflow-content img').all()){
  await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  const fits=await image.evaluate(i=>{const r=i.getBoundingClientRect(),c=i.parentElement.getBoundingClientRect();return r.width<=c.width+1&&r.height<=470&&Math.abs(r.width/r.height-i.naturalWidth/i.naturalHeight)<.01;});expect(fits).toBe(true);
 }
 await noScroll(page.locator('#overflow-content'));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

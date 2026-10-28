// Real browser layout and DOM regressions, using fictional contract blocks.
// Install the browser with `npx playwright install chromium`.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const browsers=require('playwright');
const root=path.resolve(__dirname,'..');

test('structured question content stays readable and safe in a real browser',async t=>{
 const browserName=process.env.PAESSED_BROWSER||'chromium';
 const browser=await browsers[browserName].launch({headless:true,...(browserName==='chromium'&&process.env.PAESSED_BROWSER_CHANNEL?{channel:process.env.PAESSED_BROWSER_CHANNEL}:{})});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.setDefaultTimeout(5000);
 await page.setContent('<!doctype html><style>body{margin:0}#content{width:300px;font-size:21px}</style><div id="content" class="paessed-blocks"></div>');
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'public/paessed/katex/katex.min.css'),'utf8')});
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'public/paessed/block-renderer.css'),'utf8')});
 await page.addScriptTag({path:path.join(root,'lib/paessed-runtime/katex.js')});
 await page.addScriptTag({path:path.join(root,'lib/paessed-runtime/block-renderer.js')});
 async function render(blocks){await page.evaluate(blocks=>{
  const container=document.getElementById('content');
  window.PaessedBlocks.renderBlocks(container,blocks,{katex:window.katex,assetUrls:new Map([['pixel','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3X8AAAAASUVORK5CYII=']])});
 },blocks);}
 await t.test('only balanced b/i create formatted DOM; math, cells and literal hostile HTML stay intact',async()=>{
  await render([{type:'text',text:'Una <b>negrita</b> y <i>cursiva</i> <b><i>ambas</i></b>.\n<script>window.injected=true</script>'},{type:'math',latex:'x^2',display:false},{type:'table',rows:[[[{type:'text',text:'<b>Encabezado</b>'}],[{type:'math',latex:'\\frac{1}{2}',display:false}]]]}]);
  assert.equal(await page.locator('.paessed-text b').count(),3);
  assert.equal(await page.locator('.paessed-text i').count(),2);
  assert.equal(await page.locator('.paessed-text b i').textContent(),'ambas');
  assert.equal(await page.locator('td b').textContent(),'Encabezado');
  assert.equal(await page.locator('mfrac').count(),1);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await page.locator('#content script').count(),0);
  for(const text of ['<b>sin cierre','<b><i>cruzadas</b></i>','<b onclick="alert(1)">atributos</b>']){
   await render([{type:'text',text}]);
   assert.equal(await page.locator('.paessed-text').textContent(),text);
   assert.equal(await page.locator('#content b,#content i').count(),0);
  }
  await render([{type:'text',text:'<b>Primera.</b>'},{type:'text',text:'<i>Otra frase.</i>'}]);
  assert.equal(await page.locator('.paessed-paragraph').count(),2);
 });
 await t.test('text and inline mathematics share paragraphs; sentence blocks remain separate',async()=>{
  await render([{type:'text',text:'Valor '},{type:'math',latex:'\\sqrt[3]{x_1^2}',display:false},{type:'text',text:'.'},{type:'text',text:'Otra frase.'}]);
  assert.equal(await page.locator('.paessed-paragraph').count(),2);
  assert.equal(await page.locator('.paessed-paragraph').first().locator('math').count(),1);
  assert.equal(await page.locator('.paessed-math-inline').evaluate(e=>e.tagName),'SPAN');
  assert.equal(await page.locator('mroot').count(),1);
  assert.equal(await page.locator('msubsup').count(),1);
 });
 await t.test('display fractions and following text have separate layout',async()=>{
  await render([{type:'text',text:'Expresión:'},{type:'math',latex:'\\frac{4\\sqrt{3}-\\sqrt[3]{2}+\\sqrt[4]{5}}{\\sqrt[4]{27}}',display:true},{type:'text',text:'Seleccione.'}]);
  assert.equal(await page.locator('.paessed-math-display').count(),1);
  assert.equal(await page.locator('.paessed-paragraph .paessed-math-display').count(),0);
  assert.equal(await page.locator('mfrac').count(),1);
  assert.equal(await page.locator('.paessed-math-display').evaluate(e=>getComputedStyle(e).textAlign),'center');
 });
 await t.test('closing punctuation stays with a display formula without changing its math mode',async()=>{
  await render([{type:'text',text:'¿Cuál es el valor de la expresión '},{type:'math',latex:'\\frac{0,5-\\frac{1}{4}}{0,25+\\frac{1}{2}}',display:true},{type:'text',text:'?'}]);
  assert.equal(await page.locator('.paessed-math-display .paessed-math-punctuation').count(),1);
  assert.equal(await page.locator('.paessed-math-punctuation').textContent(),'?');
  assert.equal(await page.locator('.paessed-paragraph').count(),1);
  assert.equal(await page.locator('.paessed-math-display math').getAttribute('display'),'block');
  assert.equal(await page.locator('mfrac').count(),3);
 });
 await t.test('inline fractions and radicals do not use clipping scrollboxes',async()=>{
  await render([{type:'math',latex:'\\left(\\frac{3}{2},\\frac{5}{2}\\right)+\\sqrt[4]{5^3}',display:false}]);
  const state=await page.locator('.paessed-math').evaluate(e=>({x:getComputedStyle(e).overflowX,y:getComputedStyle(e).overflowY}));
  assert.equal(state.x,'visible');assert.equal(state.y,'visible');
 });
 await t.test('newlines, literal text, nested cell math and images keep their structure',async()=>{
  await render([{type:'text',text:'$11 000\n<svg onload=alert(1)>'},{type:'table',rows:[[[{type:'text',text:'Costo '},{type:'math',latex:'x^2',display:false}],[{type:'image',asset_id:'pixel',alt:'Pixel de prueba'}]]]}]);
  assert.equal(await page.locator('.paessed-table').getAttribute('aria-label'),'Tabla incluida en la pregunta');
  assert.equal(await page.locator('td').first().locator('.paessed-paragraph math').count(),1);
  assert.equal(await page.locator('img').getAttribute('alt'),'Pixel de prueba');
  assert.equal(await page.locator('svg').count(),0);
  assert((await page.locator('.paessed-text').first().textContent()).includes('\n'));
 });
 await t.test('bad math, missing/undecodable images and unresolved blocks leave other content usable',async()=>{
  await render([{type:'math',latex:'\\unknownCommand{',display:false},{type:'image',asset_id:'missing',alt:'Ausente'},{type:'unresolved',reason:'Revisar fuente'},{type:'text',text:'Todavía legible.'}]);
  assert.equal(await page.locator('[role=alert]').count(),2);
  assert.equal(await page.locator('[role=status]').count(),1);
  assert((await page.locator('#content').textContent()).includes('Todavía legible.'));
  await render([{type:'image',asset_id:'pixel',alt:'Imagen rota'},{type:'text',text:'Después.'}]);
  await page.locator('img').evaluate(e=>e.dispatchEvent(new Event('error')));
  assert((await page.locator('[role=alert]').textContent()).includes('Imagen rota'));
 });
 await t.test('pending resource loads report status and retain a real missing-resource error afterwards',async()=>{
  await page.evaluate(()=>window.PaessedBlocks.renderBlocks(document.getElementById('content'),[{type:'image',asset_id:'pending',alt:'Pendiente'}],{assetUrls:new Map(),loadingAssets:true}));
  assert.equal(await page.locator('[role=alert]').count(),0);
  assert.equal(await page.locator('[role=status]').textContent(),'Cargando recurso: pending');
  await render([{type:'image',asset_id:'pending',alt:'Pendiente'}]);
  assert.equal(await page.locator('[role=status]').count(),0);
  assert.equal(await page.locator('[role=alert]').textContent(),'Recurso no disponible: pending');
 });
 await t.test('one malformed block cannot leave the previous question visible',async()=>{
  await render([{type:'text',text:'Anterior.'}]);
  await render([{type:'unsupported'},{type:'text',text:'Actual.'}]);
  assert.equal(await page.locator('[role=alert]').count(),1);
  assert(!(await page.locator('#content').textContent()).includes('Anterior.'));
  assert((await page.locator('#content').textContent()).includes('Actual.'));
 });
 await t.test('long display and inline formulas scroll locally without widening the page',async()=>{
  const latex=Array.from({length:45},(_,i)=>`x_{${i}}`).join('+');
  for(const display of [true,false]){
   await render([{type:'text',text:'Inicio '},{type:'math',latex,display},{type:'text',text:' fin.'}]);
   await page.evaluate(()=>window.PaessedBlocks.fitMath(document.getElementById('content')));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('.paessed-math').evaluate(e=>e.scrollWidth>e.clientWidth),true);
  }
 });
 await t.test('wide nested radicals/fractions retain all vertical boxes and cannot scroll vertically',async()=>{
  const rich='\\frac{\\sqrt[4]{x_1^{12}+y^2}}{\\sqrt{\\frac{1}{1+x_1}}}';
  for(const display of [false,true]){
   await render([{type:'math',latex:Array(24).fill(rich).join('+'),display}]);
   const before=await page.locator('.paessed-math').evaluate(e=>{
    const s=getComputedStyle(e);e.scrollTop=100;const top=e.scrollTop;e.scrollTop=0;
    return{x:s.overflowX,y:s.overflowY,top,height:e.clientHeight,scrollHeight:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth};
   });
   assert.equal(before.x,'auto');assert.equal(before.y,'hidden');assert.equal(before.top,0);assert(before.scrollHeight<=before.height);assert(before.scrollWidth>before.width);
   await page.evaluate(()=>window.PaessedBlocks.fitMath(document.getElementById('content')));
   assert.equal(await page.locator('.paessed-math').evaluate(e=>e.clientHeight),before.height);
   assert.equal(await page.locator('mroot').count(),24);assert.equal(await page.locator('mfrac').count(),48);
  }
 });
 await t.test('resize removes overflow geometry and focus regions when the formula fits',async()=>{
  await render([{type:'math',latex:Array(30).fill('x^2').join('+'),display:true}]);
  assert.equal(await page.locator('.paessed-math').getAttribute('tabindex'),'0');
  try{
   await page.setViewportSize({width:9000,height:844});
   await page.locator('#content').evaluate(e=>{e.style.width='9000px';window.PaessedBlocks.fitMath(e);});
   assert.equal(await page.locator('.paessed-math-overflow').count(),0);
   assert.equal(await page.locator('.paessed-math').getAttribute('tabindex'),null);
   assert.equal(await page.locator('.paessed-math').evaluate(e=>getComputedStyle(e).overflowY),'visible');
  }finally{await page.setViewportSize({width:390,height:844});await page.locator('#content').evaluate(e=>e.style.width='300px');}
 });
 await t.test('wide structured tables preserve horizontal scrolling and grow for tall cell math',async()=>{
  const latex='\\frac{\\sqrt[4]{x_1^{12}+y^2}}{\\sqrt{\\frac{1}{1+x_1}}}';
  await render([{type:'table',rows:[Array.from({length:10},()=>[{type:'math',latex,display:false}])]}]);
  assert.equal(await page.locator('.paessed-table-wrap').getAttribute('aria-label'),'Tabla desplazable');
  const state=await page.locator('.paessed-table-wrap').evaluate(e=>{e.scrollTop=100;return{x:getComputedStyle(e).overflowX,y:getComputedStyle(e).overflowY,top:e.scrollTop,height:e.clientHeight,scrollHeight:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth};});
  assert.equal(state.x,'auto');assert.equal(state.y,'hidden');assert.equal(state.top,0);assert(state.scrollHeight<=state.height);assert(state.scrollWidth>state.width);
 });
});

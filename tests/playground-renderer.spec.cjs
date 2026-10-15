const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const JSZip=require('jszip');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/tesla-p41-gold-rc1.paessed'));
let data;
test.beforeAll(async()=>{const zip=await JSZip.loadAsync(fixture);data=JSON.parse(await zip.file('final.json').async('string'));});
async function importPackage(page,mode='paessed',document){
 await page.goto('/app/ensayos/importar');
 const zip=mode==='json'?await JSZip.loadAsync(fixture):null;
 await page.locator('input[type=file]').setInputFiles({name:mode==='json'?'final.json':`TESLA.${mode}`,mimeType:mode==='json'?'application/json':'application/zip',buffer:document?Buffer.from(JSON.stringify(document)):zip?await zip.file('final.json').async('nodebuffer'):fixture});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=reject;q.onsuccess=()=>{resolve(q.result[0].summary.id);db.close();};};}));
}
async function openQuestion(page,id,number){
 await page.goto('/app/playground');
 const select=page.locator('select').filter({has:page.locator(`option[value="imported:${id}:${number-1}"]`)});
 await expect(select).toHaveCount(1);await select.selectOption(`imported:${id}:${number-1}`);
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();
 await expect(page.getByRole('main',{name:'Pregunta de práctica'})).toBeVisible();
}
async function mathIsStyled(page){
 await expect(page.locator('.katex-mathml').first()).toBeAttached();
 await expect.poll(()=>page.locator('.katex-mathml').evaluateAll(nodes=>nodes.length>0&&nodes.every(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.position==='absolute'&&s.overflow==='hidden'&&r.width<=1&&r.height<=1;}))).toBe(true);
}
for(const mobile of [false,true])for(const theme of ['light','dark'])test(`Playground TESLA structured content and Arial — ${mobile?'mobile':'desktop'} ${theme}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 const id=await importPackage(page);
 await page.evaluate(theme=>localStorage.setItem('paessed-playground-paper-theme',theme),theme);
 for(const number of [1,2,3,25,41,47]){
  await openQuestion(page,id,number);
  const main=page.getByRole('main',{name:'Pregunta de práctica'});
  if(process.env.PAESSED_CAPTURE_BEFORE){await main.screenshot({path:path.join(process.env.PAESSED_CAPTURE_BEFORE,`playground-p${number}-${mobile?'mobile':'desktop'}-${theme}.png`)});continue;}
  const hosts=main.locator('.paessed-blocks');await expect(hosts).toHaveCount(5);
  if([2,3,47].includes(number))await mathIsStyled(page);
  const choices=main.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button');await expect(choices).toHaveCount(4);
  const math=data.questions[number-1].stem.filter(b=>b.type==='math').map(b=>b.latex);
  expect(await hosts.first().locator('annotation').allTextContents()).toEqual(math);
  expect(await hosts.first().evaluate(e=>getComputedStyle(e).fontFamily)).toMatch(/^Arial/);
  if(number===1)await expect(hosts.first().locator('table')).toHaveCount(1);
  if(number===25||number===41){const imgs=main.locator('img');await expect(imgs).toHaveCount(number===41?4:1);await expect.poll(()=>imgs.evaluateAll(nodes=>nodes.every(e=>e.complete&&e.naturalWidth>0))).toBe(true);await expect(main.locator('[role=alert]')).toHaveCount(0);if(number===41)for(const choice of await choices.all())await expect(choice.locator('img')).toHaveCount(1);}
  if(number===47)expect(await hosts.first().locator('.paessed-math').evaluateAll(nodes=>nodes.every(e=>{const s=getComputedStyle(e);e.scrollTop=999;return s.overflowY==='visible'&&e.scrollTop===0;}))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.fonts.ready);
  await expect(main).toHaveScreenshot(`playground-p${number}-${mobile?'mobile':'desktop'}-${theme}.png`);
  if(number===41)for(let i=0;i<4;i++){
   const choice=choices.nth(i);await choice.scrollIntoViewIfNeeded();await expect(choice).toHaveScreenshot(`playground-p41-option-${i}-${mobile?'mobile':'desktop'}-${theme}.png`);
  }
  if(number===47){
   const formula=main.locator('.paessed-math-display');await formula.scrollIntoViewIfNeeded();await expect(formula).toHaveScreenshot(`playground-p47-formula-${mobile?'mobile':'desktop'}-${theme}.png`);
   const options=main.getByRole('group',{name:'Alternativas de respuesta'});await options.scrollIntoViewIfNeeded();await expect(options).toHaveScreenshot(`playground-p47-options-${mobile?'mobile':'desktop'}-${theme}.png`);
  }
 }
});

test('Playground 0.2.0 curriculum filters retain structured content and pending classification',async({page})=>{
 const curriculum=structuredClone(data);curriculum.schema_version='0.2.0';
 for(const q of curriculum.questions)q.curriculum={eje:'Números',subeje:'Porcentaje',en_temario:'si'};
 curriculum.questions[2].curriculum={eje:null,subeje:null,en_temario:'dudoso'};curriculum.questions[2].issues.push('CURRICULUM_PENDING');
 const id=await importPackage(page,'json',curriculum);await page.goto('/app/playground');
 await expect(page.locator('#playground-start-question option')).toHaveCount(70);
 await page.getByRole('button',{name:'Limpiar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Comenzar práctica',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:/^Números \d+ preguntas en el banco$/}).click();
 const percentage=page.getByRole('checkbox',{name:/^Porcentaje,/});await percentage.focus();await percentage.press('Space');await expect(percentage).toBeChecked();
 await expect(page.locator('#playground-start-question option')).toHaveCount(66);
 await expect(page.locator(`#playground-start-question option[value="imported:${id}:2"]`)).toHaveCount(0);
 await page.locator('#playground-start-question').selectOption(`imported:${id}:1`);await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();
 await mathIsStyled(page);await expect(page.getByText('Números · Porcentaje',{exact:true})).toBeVisible();
});

test('Playground keeps favorites, history, verified correction, retry, navigation and queued filters',async({page})=>{
 const id=await importPackage(page);await openQuestion(page,id,2);
 await page.getByRole('button',{name:'Guardar esta pregunta',exact:true}).click();
 const group=page.getByRole('group',{name:'Alternativas de respuesta'});
 const correct=data.questions[1].answer.label;const index=data.questions[1].options.findIndex(o=>o.label===correct);
 await group.getByRole('button').nth(index).click();await page.getByRole('button',{name:'Comprobar respuesta',exact:true}).click();await page.getByRole('button',{name:'Confirmar respuesta',exact:true}).click();
 await expect(page.getByText('¡Respuesta correcta!',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(group.getByRole('button').first()).toBeEnabled();
 await group.getByRole('button').nth(index).click();await page.getByRole('button',{name:'Comprobar respuesta',exact:true}).click();await page.getByRole('button',{name:'Confirmar respuesta',exact:true}).click();
 await page.getByRole('button',{name:'Ajustes de apariencia y filtros de preguntas',exact:true}).click();
 await page.locator('#playground-practice-question').selectOption(`imported:${id}:2`);
 await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByRole('button',{name:'En la próxima pregunta',exact:true}).click();
 await expect(page.getByText('Filtros nuevos en la próxima pregunta',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.getByText('N.º 3',{exact:true})).toBeVisible();await mathIsStyled(page);
 await page.goto('/app/playground');
 await page.getByRole('button',{name:/^Solo guardadas/}).click();await expect(page.locator('#playground-start-question option')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Volver a practicar pregunta número 2',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Volver a practicar pregunta número 2',exact:true}).click();await mathIsStyled(page);await expect(page.getByRole('button',{name:'Quitar pregunta de guardadas',exact:true})).toBeVisible();
 // Apply a new starting question immediately, preserving the practice controls.
 await page.getByRole('button',{name:'Ajustes de apariencia y filtros de preguntas',exact:true}).click();
 await page.getByRole('checkbox',{name:'Solo preguntas guardadas',exact:true}).uncheck();await page.locator('#playground-practice-question').selectOption(`imported:${id}:2`);
 await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByRole('button',{name:'Aplicar ahora',exact:true}).click();await expect(page.getByText('N.º 3',{exact:true})).toBeVisible();
});
for(const mode of ['zip','json'])test(`Playground ${mode} keeps structured math and reports missing resources`,async({page})=>{
 const id=await importPackage(page,mode);await openQuestion(page,id,2);await mathIsStyled(page);
 await openQuestion(page,id,41);
 const main=page.getByRole('main',{name:'Pregunta de práctica'});
 if(mode==='zip'){await expect(main.locator('img')).toHaveCount(4);await expect.poll(()=>main.locator('img').evaluateAll(nodes=>nodes.every(e=>e.complete&&e.naturalWidth>0))).toBe(true);}
 else {await expect(main.getByRole('alert').first()).toContainText('Sin archivo de imágenes adjunto');await expect(main.locator('img')).toHaveCount(0);await expect(main.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button')).toHaveCount(4);}
});
async function draw(page,touch=false){
 const canvas=page.locator('canvas');const box=await canvas.boundingBox();
 const x=box.x+25,y=box.y+Math.min(90,box.height/2);
 if(touch){const session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+40,y:y+20}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();}
 else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y+20,{steps:8});await page.mouse.up();}
}
for(const mode of ['playground','imported','demo'])for(const touch of [false,true])test(`pencil hides tools without interrupting ink and returns to answers — ${mode} ${touch?'touch':'mouse'}`,async({page})=>{
 if(touch){await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{for(const key of ['paessed-playground-paper-theme','paessed-imported-paper-theme','paessed-essay-paper-theme'])localStorage.setItem(key,'dark');});}
 if(mode==='demo')await page.goto('/app/ensayos/nuevo');
 else {const id=await importPackage(page);if(mode==='playground')await openQuestion(page,id,2);else await page.goto(`/app/ensayos/importado/${id}`);}
 const pencil=page.getByRole('button',{name:/^Activar lápiz/});await pencil.click();
 const color=page.getByRole('button',{name:'Color de tinta #e11d48',exact:true});await expect(color).toBeVisible();await color.click();
 const canvas=page.locator('canvas');const before=await canvas.boundingBox();await draw(page,touch);
 await expect(color).toHaveCount(0);expect(await canvas.boundingBox()).toEqual(before);
 const inkPixels=()=>canvas.evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]&&pixels[i]>pixels[i+1]*2)count++;return count;});
 expect(await inkPixels()).toBeGreaterThan(50);
 await page.getByRole('button',{name:'Abrir herramientas del lápiz',exact:true}).click();await expect(color).toBeVisible();await expect(color).toHaveAttribute('aria-pressed','true');
 const undo=page.getByRole('button',{name:/^Deshacer/});await expect(undo).toBeEnabled();
 await page.getByRole('button',{name:/^Borrar trazo$/,exact:true}).click();await draw(page,touch);
 await expect(color).toHaveCount(0);await page.getByRole('button',{name:'Abrir herramientas del lápiz',exact:true}).click();await expect(undo).toBeDisabled();
 expect(await inkPixels()).toBe(0);
 await page.getByRole('button',{name:'Desactivar lápiz',exact:true}).click();await expect(color).toHaveCount(0);
 const choice=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button').first();await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
});

test('Playground releases source URLs and reopening the same source loads fresh images',async({page})=>{
 const id=await importPackage(page);
 await page.addInitScript(()=>{
  window.resourceLifetime={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=create(blob);window.resourceLifetime.created.push(url);return url;};
  URL.revokeObjectURL=url=>{window.resourceLifetime.revoked.push(url);revoke(url);};
 });
 await openQuestion(page,id,41);const images=page.getByRole('main',{name:'Pregunta de práctica'}).locator('img');
 await expect.poll(()=>images.evaluateAll(nodes=>nodes.length===4&&nodes.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 const oldUrls=await images.evaluateAll(nodes=>nodes.map(i=>i.src));
 await page.getByRole('button',{name:'Volver a configuración',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.resourceLifetime.created.length===18&&window.resourceLifetime.revoked.length===18)).toBe(true);
 await page.locator('#playground-start-question').selectOption(`imported:${id}:40`);await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();
 await expect.poll(()=>images.evaluateAll(nodes=>nodes.length===4&&nodes.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 const nextUrls=await images.evaluateAll(nodes=>nodes.map(i=>i.src));expect(nextUrls.every(url=>!oldUrls.includes(url))).toBe(true);
 await expect(page.getByRole('main',{name:'Pregunta de práctica'}).getByRole('alert')).toHaveCount(0);
});

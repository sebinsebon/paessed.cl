const {test,expect}=require('playwright/test');

function fixture(){
 const q={id:'fiction-q1',source_id:'fiction',number:'1',regions:[{page:1,bbox:[0,0,100,100]}],stem:[{type:'text',text:'Fictional question: choose 4.'}],options:[{label:'A',blocks:[{type:'text',text:'3'}]},{label:'B',blocks:[{type:'text',text:'4'}]}],answer:{label:'B',status:'provisional',origin:'model',source_ref:null},explanation:{blocks:[{type:'text',text:'Fictional unverified explanation.'},{type:'math',latex:'2+2=4',display:true}],status:'provisional'},fidelity:{status:'reviewed',review_ref:'fixture-review'},issues:['Fictional assumption requires review.'],curriculum:{eje:'Números',subeje:'Conjunto de los números enteros y racionales',en_temario:'si'}};
 return {format:'paessed-benchmark',schema_version:'0.2.0',pipeline:'demo',run:{id:'fixture',cli:'test',model:'none',created_at:'2026-01-01'},exam:{id:'fixture',title:'Fictional review fixture',scope:'demo',expected_questions:[{id:q.id,source_id:q.source_id,number:q.number}]},sources:[{id:'fiction',name:'fiction.pdf',sha256:'a'.repeat(64),page_count:1,role:'exam'}],questions:[q],assets:[],evidence:[]};
}
async function stored(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=reject;q.onsuccess=()=>{resolve(q.result[0]);db.close();};};}));
}
async function importFixture(page,data,file){
 await page.goto('/app/ensayos/importar');
 await page.locator('input[type=file]').setInputFiles(file||{name:'fiction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();
 await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 return stored(page);
}
const progressKey=id=>'paessed-imported-essay-progress-v1-'+id;
const review=page=>page.getByRole('region',{name:'Revisión del contenido del paquete'});
const choice=page=>page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button').first();

test('legacy essay only displays question images, excluding solution and review images',async({page})=>{
 const zip=new(require('jszip'))();
 const data={questions:[{id:'legacy',prompt:'Legacy question',image:'assets/question.png',options:['A','B'],
  answer:{image:'assets/answer.png'},explanation:{image:'assets/explanation.png'},issues:['assets/review.png']}]};
 zip.file('final.json',JSON.stringify(data));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3X8AAAAASUVORK5CYII=','base64');
 for(const name of ['question','answer','explanation','review'])zip.file(`assets/${name}.png`,png);
 const record=await importFixture(page,data,{name:'legacy.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
 await page.goto(`/app/ensayos/importado/${record.summary.id}`);
 await expect(page.locator('main img')).toHaveCount(1);
 expect((await stored(page)).finalJson).toEqual(data);
});

test('normal essay never exposes package review and preserves selection through reload and navigation',async({page})=>{
 const data=fixture();
 data.questions.push({...structuredClone(data.questions[0]),id:'fiction-q2',number:'2'});
 data.exam.expected_questions.push({id:'fiction-q2',source_id:'fiction',number:'2'});
 const record=await importFixture(page,data);
 const url=`/app/ensayos/importado/${record.summary.id}?reviewMode=1&audit=1&PAESSED_AUDIT_MODE=1`;
 await page.evaluate(()=>{localStorage.setItem('reviewMode','true');localStorage.setItem('PAESSED_AUDIT_MODE','1');});
 await page.goto(url);
 await choice(page).click();await expect(choice(page)).toHaveAttribute('aria-pressed','true');
 const hidden=async()=>{
  await expect(page.getByRole('button',{name:/Revisar contenido del paquete|Cerrar revisión/})).toHaveCount(0);
  await expect(review(page)).toHaveCount(0);
  await expect(page.getByText('Fictional unverified explanation.')).toHaveCount(0);
  await expect(page.getByText('Fictional assumption requires review.')).toHaveCount(0);
 };
 await hidden();await page.reload();await expect(choice(page)).toHaveAttribute('aria-pressed','true');await hidden();
 await page.getByRole('button',{name:/Siguiente/}).click();await hidden();
 await page.getByRole('button',{name:/Anterior/}).click();await expect(choice(page)).toHaveAttribute('aria-pressed','true');await hidden();
 expect((await stored(page)).finalJson).toEqual(data);
});

if(process.env.PAESSED_TEST_AUDIT_ENABLED==='1'){
 for(const status of ['verified','provisional','missing'])test(`local audit displays ${status} without reading or changing student state or package`,async({page})=>{
  const data=fixture();const q=data.questions[0];
  q.answer=status==='missing'?{label:null,status,origin:'none',source_ref:null}:{...q.answer,status,...(status==='verified'?{origin:'answer-key',source_ref:'fixture-key'}:{})};
  q.explanation={status,blocks:status==='missing'?[]:q.explanation.blocks};
  data.questions.push({...structuredClone(q),id:'fiction-q2',number:'2'});
  data.exam.expected_questions.push({id:'fiction-q2',source_id:'fiction',number:'2'});
  const record=await importFixture(page,data);const key=progressKey(record.summary.id);
  const progress=JSON.stringify({index:1,answers:{0:'A',1:'B'},bookmarks:[1],strokes:{1:[{points:[{x:1,y:1}],color:'#000',width:2}]}});
  await page.evaluate(({key,progress})=>localStorage.setItem(key,progress),{key,progress});
  // Record attempts, including reads, rather than relying only on final equality.
  await page.addInitScript(()=>{
   window.__progressAccess=[];window.__packageWrites=[];
   for(const method of ['getItem','setItem','removeItem','clear']){
    const original=Storage.prototype[method];Storage.prototype[method]=function(...args){
     if(method==='clear'||String(args[0]).startsWith('paessed-imported-essay-progress'))window.__progressAccess.push(method);
     return original.apply(this,args);
    };
   }
   const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){
    if(this.name==='paessed-local'&&mode==='readwrite')window.__packageWrites.push(String(stores));
    return original.call(this,stores,mode,...rest);
   };
  });
  const assertAudit=async()=>{
   await expect(review(page)).toBeVisible();
   await expect(page.getByRole('button',{name:/Marcar|Dibujar|Borrar|Guardar/})).toHaveCount(0);
   await expect(page.getByRole('group',{name:'Alternativas de respuesta'})).toHaveCount(0);
   await expect(review(page)).toContainText(`Estado: ${status==='verified'?'verificada':status==='missing'?'ausente':'provisional'}`);
   if(status==='verified')await expect(review(page).getByRole('alert')).toHaveCount(0);
   else await expect(review(page).getByRole('alert')).toContainText('Contenido pendiente de verificación');
   if(status==='missing')await expect(review(page)).toContainText('El archivo no contiene una explicación.');
   else {await expect(review(page)).toContainText('Fictional unverified explanation.');await expect(review(page).locator('annotation')).toHaveText('2+2=4');}
   await expect(review(page)).toContainText('Fictional assumption requires review.');
   expect(await page.evaluate(()=>window.__progressAccess)).toEqual([]);
   expect(await page.evaluate(()=>window.__packageWrites)).toEqual([]);
   expect(await stored(page)).toEqual(record);
   expect(await page.evaluate(key=>localStorage[key],key)).toBe(progress);
  };
  await page.goto(`/app/auditoria/paquetes/${record.summary.id}`);await assertAudit();
  await expect(page.getByRole('heading',{name:'Pregunta fiction-q1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pregunta fiction-q2',exact:true})).toBeVisible();await assertAudit();
  await page.reload();await assertAudit();
  // Returning to the essay restores the original student's question and selection.
  await page.goto(`/app/ensayos/importado/${record.summary.id}`);
  await expect(choice(page)).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button').nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(review(page)).toHaveCount(0);
 });
}else{
 test('audit is a 404 regardless of URL flags and local storage',async({page})=>{
  await page.goto('/app/ensayos');
  await page.evaluate(()=>localStorage.setItem('PAESSED_AUDIT_MODE','1'));
  const response=await page.goto('/app/auditoria/paquetes/fiction?audit=1&PAESSED_AUDIT_MODE=1');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading',{name:'Auditoría local del paquete'})).toHaveCount(0);
  await expect(review(page)).toHaveCount(0);
 });
}

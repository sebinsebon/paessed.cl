const {test,expect}=require('playwright/test');

function fixture(){
 const q={id:'fiction-q1',source_id:'fiction',number:'1',regions:[{page:1,bbox:[0,0,100,100]}],stem:[{type:'text',text:'Fictional question: choose 4.'}],options:[{label:'A',blocks:[{type:'text',text:'3'}]},{label:'B',blocks:[{type:'text',text:'4'}]}],answer:{label:'B',status:'provisional',origin:'model',source_ref:null},explanation:{blocks:[{type:'text',text:'Fictional unverified explanation.'},{type:'math',latex:'2+2=4',display:true}],status:'provisional'},fidelity:{status:'reviewed',review_ref:'fixture-review'},issues:['Fictional assumption requires review.'],curriculum:{eje:'Números',subeje:'Conjunto de los números enteros y racionales',en_temario:'si'}};
 return {format:'paessed-benchmark',schema_version:'0.2.0',pipeline:'demo',run:{id:'fixture',cli:'test',model:'none',created_at:'2026-01-01'},exam:{id:'fixture',title:'Fictional review fixture',scope:'demo',expected_questions:[{id:q.id,source_id:q.source_id,number:q.number}]},sources:[{id:'fiction',name:'fiction.pdf',sha256:'a'.repeat(64),page_count:1,role:'exam'}],questions:[q],assets:[],evidence:[]};
}
async function stored(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onerror=reject;q.onsuccess=()=>{resolve(q.result[0]);db.close();};};}));
}
for(const missing of [false,true])test(`opt-in package review preserves ${missing?'missing':'provisional'} states, original content and student selection`,async({page})=>{
 const data=fixture();
 if(missing){data.questions[0].answer={label:null,status:'missing',origin:'none',source_ref:null};data.questions[0].explanation={status:'missing',blocks:[]};}
 await page.goto('/app/ensayos/importar');
 await page.locator('input[type=file]').setInputFiles({name:'fiction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const record=await stored(page);expect(record.finalJson).toEqual(data);
 await page.goto(`/app/ensayos/importado/${record.summary.id}`);
 const review=page.getByRole('region',{name:'Revisión del contenido del paquete'});
 await expect(review).toHaveCount(0);
 const choice=page.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button').first();await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Revisar contenido del paquete',exact:true}).click();
 await expect(review).toBeVisible();await expect(review.getByRole('alert')).toContainText('Contenido pendiente de verificación');
 await expect(review).toContainText('Fictional assumption requires review.');
 if(missing)await expect(review).toContainText('El archivo no contiene una explicación.');
 else {await expect(review).toContainText('Fictional unverified explanation.');await expect(review.locator('annotation')).toHaveText('2+2=4');await expect(review).toContainText('Respuesta del archivo: B · Estado: provisional');}
 await expect(choice).toHaveAttribute('aria-pressed','true');
 expect((await stored(page)).finalJson).toEqual(data);
 await page.reload();await expect(review).toHaveCount(0);await expect(choice).toHaveAttribute('aria-pressed','true');
 expect((await stored(page)).finalJson).toEqual(data);
});

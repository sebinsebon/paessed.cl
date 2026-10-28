const {test,expect}=require('@playwright/test');
const fixture=require('./inline-emphasis-fixture.cjs');

for(const mobile of [false,true])for(const theme of ['light','dark'])test(`emphasis in Ensayos and Playground ${mobile?'mobile':'desktop'} ${theme}`,async({page},info)=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 const data=fixture();
 await page.goto('/app/ensayos/importar');
 await page.locator('input[type=file]').setInputFiles({name:'emphasis.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.getByRole('button',{name:'Importar ensayo',exact:true}).click();
 await page.getByRole('button',{name:'Importado',exact:true}).waitFor();
 const id=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('paessed-local');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const q=db.transaction('imported-exams').objectStore('imported-exams').getAll();q.onsuccess=()=>{resolve(q.result[0].summary.id);db.close();};q.onerror=reject;};}));
 await page.evaluate(theme=>{localStorage.setItem('paessed-playground-paper-theme',theme);localStorage.setItem('paessed-imported-paper-theme',theme);},theme);
 await page.goto(`/app/ensayos/importado/${id}`);
 await expect(page.locator('.paessed-text b').filter({hasText:'INCORRECTA'})).toBeVisible();
 await expect(page.locator('.paessed-text b i')).toHaveText('ambos estilos');
 await expect(page.locator('td b')).toHaveText('Valor');
 await expect(page.getByRole('group',{name:'Alternativas de respuesta'}).locator('i')).toHaveText('primera');
 await expect(page.locator('mfrac')).toHaveCount(1);
 for(const text of await page.locator('.paessed-blocks').allTextContents())expect(text).not.toMatch(/<\/?[bi]>/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`ensayos-${mobile?'mobile':'desktop'}-${theme}.png`),fullPage:true});
 // Search uses readable prose and never changes persisted source markup.
 await page.goto('/app/playground');
 await page.locator('#playground-start-question').selectOption(`imported:${id}:0`);
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();
 const main=page.getByRole('main',{name:'Pregunta de práctica'});
 await expect(main.locator('b').filter({hasText:'INCORRECTA'})).toBeVisible();
 await expect(main.locator('b i')).toHaveText('ambos estilos');
 await expect(main.locator('td b')).toHaveText('Valor');
 await expect(main.locator('mfrac')).toHaveCount(1);
 await main.screenshot({path:info.outputPath(`playground-${mobile?'mobile':'desktop'}-${theme}.png`)});
 // Verified states here belong only to a fictional UI fixture, never an import certification.
 await main.getByRole('group',{name:'Alternativas de respuesta'}).getByRole('button').first().click();
 const check=page.getByRole('button',{name:/Comprobar|Verificar|Revisar respuesta/});
 if(await check.count())await check.first().click();
 const confirm=page.getByRole('button',{name:'Confirmar respuesta',exact:true});
 if(await confirm.count())await confirm.click();
 await expect(main.locator('.paessed-text b').filter({hasText:'sintética'})).toBeVisible();
});

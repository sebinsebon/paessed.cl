// Review only the isolated design proposal; never opens or mutates the application.
const {chromium}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
(async()=>{
  const browser=await chromium.launch({headless:true});
  const errors=[];
  const missingAssets=[];
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:"reduce"});
    const inspectMobileControls=()=>page.evaluate(()=>{
      const frame=document.querySelector(".app-container").getBoundingClientRect();
      return [...document.querySelectorAll(".mobile-bottom-nav a, .top-stat-chip")].map(el=>{
        const r=el.getBoundingClientRect();
        return {label:el.textContent.trim(),fits:r.left>=frame.left-1&&r.right<=frame.right+1};
      });
    });
    page.on("pageerror",error=>errors.push(error.message));
    page.on("response",response=>{if(response.status()>=400&&!response.url().endsWith("favicon.ico"))missingAssets.push({url:response.url(),status:response.status()});});
    await page.goto("http://127.0.0.1:3110/propuesta.html",{waitUntil:"networkidle"});
    await page.evaluate(()=>document.fonts.ready);
    const images=await page.locator("img").evaluateAll(items=>items.map(img=>({src:img.getAttribute("src"),loaded:img.complete&&img.naturalWidth>0})));
    await page.screenshot({path:path.join(__dirname,"propuesta-desktop.png"),fullPage:true,animations:"disabled"});
    await page.evaluate(()=>toggleTheme());
    await page.screenshot({path:path.join(__dirname,"propuesta-desktop-dark.png"),fullPage:true,animations:"disabled"});
    await page.evaluate(()=>toggleTheme());
    const buttons=await page.locator("button").allTextContents();
    const nodes=await page.locator(".tactile-node").count();
    await page.locator(".tactile-node.active").click();
    const popover=await page.locator("#nodePopover").evaluate(el=>el.classList.contains("show"));
    await page.evaluate(()=>closeActiveNodePopover());
    await page.locator("#btnViewMobile").click();
    await page.setViewportSize({width:430,height:1100});
    await page.screenshot({path:path.join(__dirname,"propuesta-mobile.png"),fullPage:true,animations:"disabled"});
    const mobileOverflow=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
    const mobileControls=await inspectMobileControls();
    await page.evaluate(()=>toggleTheme());
    await page.screenshot({path:path.join(__dirname,"propuesta-mobile-dark.png"),fullPage:true,animations:"disabled"});
    await page.setViewportSize({width:390,height:844});
    const narrowOverflow=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
    const narrowControls=await inspectMobileControls();
    await page.evaluate(()=>openMasteryDrawer());
    const drawer=await page.locator("#masteryDrawer").evaluate(el=>({open:el.classList.contains("show"),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth}));
    await page.screenshot({path:path.join(__dirname,"propuesta-mobile-mapa.png"),fullPage:true,animations:"disabled"});
    const drawerCloseVisible=await page.locator('#masteryDrawer button').evaluate(button=>{
      const r=button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    });
    await page.keyboard.press('Escape');
    const drawerClosed=await page.locator('#masteryDrawer').evaluate(el=>!el.classList.contains('show'));
    await page.setViewportSize({width:768,height:1024});
    await page.locator("#btnViewDesktop").click();
    const tabletOverflow=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
    const result={nodes,popover,mobileOverflow,narrowOverflow,tabletOverflow,mobileControls,narrowControls,drawer,drawerCloseVisible,drawerClosed,images,missingAssets,errors,buttons};
    fs.writeFileSync(path.join(__dirname,"revision-visual.json"),JSON.stringify(result,null,2));
    console.log(JSON.stringify({...result,buttons:undefined}));
    assert.equal(nodes,7,"The block must preserve all seven sessions");
    assert(popover,"The current node must expose its session details");
    for(const screen of [mobileOverflow,narrowOverflow,tabletOverflow])assert(screen.content<=screen.width,"No horizontal page overflow");
    for(const controls of [mobileControls,narrowControls]){
      assert.equal(controls.length,9,"Four stats and all five navigation items must remain present");
      assert(controls.every(control=>control.fits),"Mobile controls must fit within the prototype frame");
    }
    assert(drawer.open && drawer.left>=-1 && drawer.right<=drawer.width+1,"Mastery drawer must fit mobile screen");
    assert(drawerCloseVisible && drawerClosed,"Map title and close control must stay above preview toolbar and support Escape");
    assert.deepEqual(errors,[],"No browser runtime errors");
    assert(images.every(img=>img.loaded),"Brand images must load locally");
    assert.deepEqual(missingAssets,[],"All prototype assets must be available");
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

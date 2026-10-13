const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:__dirname,
 testMatch:['paessed-navigation.spec.cjs','paessed-resources.spec.cjs'],
 fullyParallel:false,
 workers:1,
 reporter:'list',
 outputDir:process.env.PAESSED_VISUAL_OUTPUT||'test-results/renderer',
 use:{baseURL:process.env.PAESSED_BASE_URL||'http://127.0.0.1:3104',viewport:{width:1440,height:1000},reducedMotion:'reduce'},
 projects:[{name:'chromium',use:{browserName:'chromium',...(process.env.PAESSED_BROWSER_CHANNEL?{channel:process.env.PAESSED_BROWSER_CHANNEL}:{})}}],
 expect:{toHaveScreenshot:{animations:'disabled',maxDiffPixelRatio:0.001}},
});

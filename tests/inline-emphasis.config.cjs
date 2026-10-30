const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:__dirname,testMatch:'inline-emphasis.spec.cjs',workers:1,reporter:'list',outputDir:'test-results/emphasis',use:{baseURL:process.env.PAESSED_BASE_URL||'http://127.0.0.1:3118',reducedMotion:'reduce'}});

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['learning-mobile.spec.cjs', 'learning-mobile-bank.spec.cjs', 'learning-mobile-pen.spec.cjs'],
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/learning-mobile/results.json' }]],
  outputDir: 'test-results/learning-mobile/artifacts',
  use: { baseURL: process.env.PAESSED_BASE_URL || 'http://localhost:3100', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});

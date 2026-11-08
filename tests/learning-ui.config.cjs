const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "learning-ui.spec.cjs",
  timeout: 180000,
  expect: { timeout: 20000 },
  reporter: "list",
  outputDir: "test-results/learning-ui",
  workers: 1,
  use: { baseURL: process.env.PAESSED_BASE_URL || "http://127.0.0.1:3100", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

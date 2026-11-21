const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: __dirname, testMatch: ["inicio-cuentas.spec.cjs", "loading-states.spec.cjs", "account-isolation.spec.cjs"], workers: 1, timeout: 90000,
  expect: { timeout: 20000 }, reporter: "list", outputDir: "test-results/inicio-cuentas",
  use: { baseURL: process.env.PAESSED_BASE_URL || "http://127.0.0.1:3210", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

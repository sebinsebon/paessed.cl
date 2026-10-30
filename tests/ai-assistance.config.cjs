const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ["ai-assistance.spec.cjs"],
  reporter: "list",
  workers: 1,
  use: { baseURL: process.env.PAESSED_BASE_URL || "http://127.0.0.1:3104", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

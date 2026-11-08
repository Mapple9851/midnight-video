const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  reporter: [['list']],
  timeout: 60000,
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'python3 -m http.server 4173', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
});

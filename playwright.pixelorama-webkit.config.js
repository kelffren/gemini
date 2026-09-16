const { defineConfig, devices } = require('@playwright/test');

// Fast deterministic pre-gate for Pixelorama Pro. This uses Playwright WebKit
// with an iPhone descriptor, so it is intentionally NOT evidence of a physical
// iPhone. The BrowserStack workflow remains the certification gate for real iOS.
const iphone = devices['iPhone 14 Pro'] || devices['iPhone 14'] || {};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 180000,
  globalTimeout: 12 * 60 * 1000,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'playwright-pixelorama-webkit-report.json' }]],
  use: {
    ...iphone,
    browserName: 'webkit',
    baseURL: process.env.KELO_LOCAL || 'http://127.0.0.1:4173/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{
    name: 'webkit-mobile-emulation',
    use: { ...iphone, browserName: 'webkit' },
  }],
});

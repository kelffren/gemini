const { defineConfig, devices } = require('@playwright/test');

// BrowserStack real iOS receives device/browser capabilities from browserstack.yml.
// Do not inject Playwright's Chromium/Pixel device descriptor into that context:
// BrowserStack's real Safari driver validates those emulation values differently
// (notably reducedMotion), which can abort before the first page is opened.
const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

const localMobileUse = {
  ...devices['Pixel 7'],
};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'playwright-report.json' }]],
  use: {
    baseURL: process.env.KELO_PAGES || 'https://kelffren.github.io/gemini/',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    // Real-device BrowserStack must own viewport/touch/mobile/media capabilities.
    ...(isBrowserStack ? {} : localMobileUse),
  },
  projects: [
    {
      name: isBrowserStack ? 'browserstack-real-ios' : 'chromium',
      use: isBrowserStack ? {} : localMobileUse,
    },
  ],
});

const { defineConfig, devices } = require('@playwright/test');

// BrowserStack real iOS receives device/browser capabilities from browserstack.yml.
// Keep the BrowserStack project deliberately free of desktop/mobile emulation.
// Playwright defaults reducedMotion to "no-preference"; BrowserStack real iOS
// expects the device/system default instead, so explicitly reset it with null.
const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

const localMobileUse = {
  ...devices['Pixel 7'],
};

const browserStackIOSUse = {
  browserName: 'safari',
  channel: 'safari',
  reducedMotion: null,
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
    ...(isBrowserStack ? browserStackIOSUse : localMobileUse),
  },
  projects: [
    {
      // BrowserStack documents this naming form for real iOS Playwright projects.
      name: isBrowserStack
        ? 'safari@iPhone 14 Pro:26@browserstack-mobile'
        : 'chromium',
      use: isBrowserStack ? browserStackIOSUse : localMobileUse,
    },
  ],
});

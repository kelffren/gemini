const { defineConfig, devices } = require('@playwright/test');

// BrowserStack real iOS receives the physical Safari/device capabilities from
// browserstack.yml. Playwright itself only accepts chromium/firefox/webkit as
// browserName values, so the runner uses webkit while BrowserStack maps that
// session onto Safari on the requested real iPhone.
//
// Playwright defaults reducedMotion to "no-preference"; BrowserStack real iOS
// expects the device/system default instead, so explicitly reset it with null.
const isCI = Boolean(process.env.CI);
const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

const localMobileUse = {
  ...devices['Pixel 7'],
};

const browserStackIOSUse = {
  browserName: 'webkit',
  reducedMotion: null,
};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  globalTimeout: isCI ? 25 * 60 * 1000 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list'], ['json', { outputFile: 'playwright-report.json' }]],
  use: {
    baseURL: process.env.KELO_PAGES || 'https://kelffren.github.io/gemini/',
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...(isBrowserStack ? browserStackIOSUse : localMobileUse),
  },
  projects: [
    {
      // Physical Safari/iPhone selection remains exclusively in browserstack.yml.
      name: isBrowserStack
        ? 'webkit-real-ios-browserstack'
        : 'chromium',
      use: isBrowserStack ? browserStackIOSUse : localMobileUse,
    },
  ],
});

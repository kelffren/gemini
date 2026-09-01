const { defineConfig, devices } = require('@playwright/test');

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
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
});

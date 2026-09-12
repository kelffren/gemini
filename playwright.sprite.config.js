const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',
  testMatch:'sprite-tactile-editor.spec.js',
  timeout:60000,
  retries:0,
  reporter:[['list'],['json',{outputFile:'playwright-sprite-report.json'}]],
  use:{trace:'retain-on-failure',screenshot:'on',video:'off'},
  projects:[
    {name:'chromium-mobile',use:{...devices['Pixel 7']}},
    {name:'webkit-iphone',use:{...devices['iPhone 13']}}
  ]
});

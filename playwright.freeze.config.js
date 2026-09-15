/* KELO-INDEX area: QA; owner: freeze test config; keys: CHROMIUM WEBKIT IPHONE DESKTOP; online: N/A */
const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'freeze-stability.spec.js',timeout:60000,retries:0,workers:1,
 reporter:[['list'],['html',{outputFolder:'freeze-report',open:'never'}]],
 use:{baseURL:process.env.KELO_URL||'http://127.0.0.1:8096',trace:{mode:'retain-on-failure',snapshots:false,screenshots:false,sources:false},screenshot:'only-on-failure'},
 webServer:process.env.KELO_URL?undefined:{command:'node scripts/turbo-host-server.mjs',env:{PORT:'8096'},url:'http://127.0.0.1:8096',reuseExistingServer:!process.env.CI},
 projects:[
  {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
  {name:'iphone-chromium',use:{...devices['iPhone 13'],browserName:'chromium',viewport:{width:390,height:844}}},
  {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit',viewport:{width:390,height:844}}}
 ]
});

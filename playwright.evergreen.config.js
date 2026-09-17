/* KELO-INDEX
 * area: QA / EVERGREEN / WEBKIT
 * owner: Evergreen Runtime Compatibility CI
 * keys: PLAYWRIGHT WEBKIT IOS MOBILE SAFARI COMPATIBILITY
 * purpose: run the dedicated runtime compatibility probe in WebKit with an iPhone-sized touch profile
 * public-api: Playwright config only
 * state-owned: none
 * online: local static HTTP server only; real-device Safari remains browserstack.yml
 * do-not: NO UA spoof feature gates, NO production deployment, NO gameplay mutation
 */
const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests',
  testMatch:'evergreen-runtime-compat.spec.js',
  timeout:30000,
  workers:1,
  retries:process.env.CI?1:0,
  reporter:[['list'],['json',{outputFile:'artifacts/evergreen/runtime-webkit.json'}]],
  webServer:{
    command:'python3 -m http.server 4173 --bind 127.0.0.1',
    url:'http://127.0.0.1:4173/tests/evergreen-runtime-probe.html',
    reuseExistingServer:false,
    timeout:15000
  },
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'webkit',
    viewport:{width:393,height:852},
    isMobile:true,
    hasTouch:true,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'off'
  },
  projects:[{name:'webkit-ios-profile',use:{browserName:'webkit'}}]
});

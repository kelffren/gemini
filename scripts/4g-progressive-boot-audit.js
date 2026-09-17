#!/usr/bin/env node
/* KELO-INDEX
 * area: TOOLING / PERFORMANCE
 * owner: 4G Progressive Boot contract
 * keys: 4G BOOT PLAYABLE FIRST NETWORK PROFILE PRELOAD TELEMETRY RETRY
 * purpose: fail closed if Kelo World regresses to eager post-core boot or loses network-aware staged loading.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
let passed=0,failed=0;
function ok(value,message){if(value){passed++;console.log('✓',message);}else{failed++;console.error('✗',message);}}
function has(s,t){return s.includes(t);}
const index=read('index.html');
const progressive=read('src/core/progressive-boot.js');

ok(has(index,'src/core/progressive-boot.js?v=1-4g'),'index mounts the 4G progressive boot owner');
ok(has(index,'rel="preload" href="src/core/progressive-boot.js?v=1-4g"'),'progressive owner is discovered early');
const progressiveExec=index.indexOf('<script src="src/core/progressive-boot.js?v=1-4g"');
ok(index.indexOf('engine-c.js?v=232-position-owner')<progressiveExec,'movement core is complete before progressive owner executes');

const eagerForbidden=[
  'src/core/camera-system.js?v=1',
  'engine-d.js?v=95',
  'src/environment/world-map.js?v=terrain-191',
  'engine-l.js?v=223',
  'src/ui/luxe-shell.js?v=231',
  'src/systems/performance-governor.js?v=5-sampled-snapshots',
  'src/core/feature-registry.js?v=2',
  'src/core/module-loader.js?v=10-feature-registry',
  'src/systems/liveops-npc-world-runtime.js?v=1'
];
for(const src of eagerForbidden){
  ok(!index.includes(`<script src="${src}">`),`${src} stays out of eager index execution`);
  ok(has(progressive,`'${src}'`),`${src} is owned by progressive boot`);
}

ok(has(progressive,"id:'visual'")&&has(progressive,"id:'legacy'")&&has(progressive,"id:'environment'")&&has(progressive,"id:'ui'")&&has(progressive,"id:'services'"),'five ordered production stages exist');
ok(progressive.indexOf("id:'visual'")<progressive.indexOf("id:'legacy'")&&progressive.indexOf("id:'legacy'")<progressive.indexOf("id:'environment'")&&progressive.indexOf("id:'environment'")<progressive.indexOf("id:'ui'")&&progressive.indexOf("id:'ui'")<progressive.indexOf("id:'services'"),'stage dependency order is stable');
ok(has(progressive,'navigator.connection||root.navigator.mozConnection||root.navigator.webkitConnection'),'Network Information API is optional and feature-detected');
ok(has(progressive,"tier='mobile-unknown'"),'iPhone/Safari has a mobile fallback when Network Information API is absent');
ok(has(progressive,'effectiveType')&&has(progressive,'downlinkMbps')&&has(progressive,'rttMs')&&has(progressive,'saveData'),'network profile records effective type, bandwidth, RTT and Save-Data');
ok(has(progressive,"q.get('keloNetwork')"),'network tier can be overridden deterministically in tests');
ok(has(progressive,"link.rel='preload'")&&has(progressive,"link.as='script'")&&has(progressive,'PROFILE.lookahead'),'network-aware preload lookahead is active');
ok(has(progressive,'performance.getEntriesByName')&&has(progressive,'transferSize')&&has(progressive,'decodedBodySize'),'Resource Timing captures transferred and decoded bytes');
ok(has(progressive,'SCRIPT_LOAD_FAILED_AFTER_RETRY')&&has(progressive,"url.searchParams.set('kelo_retry'"),'each failed script gets one cache-busted retry before basic mode');
ok(has(progressive,"root.__keloBootReady=true")&&has(progressive,"root.dispatchEvent(new Event('kelo:boot-ready'))"),'playable signal is released by progressive owner after minimum visual stage');
ok(has(progressive,"if(stageIndex===0)releasePlayable()"),'game loop is released immediately after visual minimum, before world/UI/services');
ok(has(progressive,"root.KELO_MODULE_LOADER.start({build:BUILD})"),'optional feature loader resumes only after service foundation is available');
ok(has(progressive,"'src/core/update-gate.js?v=8-hot-data'"),'lightweight updater gate remains on the normal post-playable path');
ok(has(progressive,'kelo.4g.lastBoot.v1'),'last boot metrics are persisted for field diagnostics');
ok(!has(progressive,'setInterval('),'progressive boot adds no polling loop');
ok(!has(progressive,'serviceWorker.register'),'4G v1 does not introduce a competing mandatory Service Worker');

console.log(`\n4G progressive boot audit: ${passed} passed, ${failed} failed`);
if(failed)process.exit(1);
console.log('4G_PROGRESSIVE_BOOT_AUDIT_PASS');

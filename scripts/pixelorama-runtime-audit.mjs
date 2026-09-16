#!/usr/bin/env node
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const errors=[];
const expect=(ok,message)=>{if(!ok)errors.push(message);};
const wrapper=read('tools/pixelorama/index.html');
const bridge=read('src/creators/ui/pixelorama-pro-bridge.mjs');
const exclusive=read('src/creators/core/creator-exclusive-runtime.mjs');
const simulation=read('src/core/simulation-extension-system.js');
const patcher=read('scripts/prepare-pixelorama-kelo.mjs');

expect(wrapper.includes("UPSTREAM_COMMIT='2af0e590b6f1dd8a9255686373c5831623bb03bd'"),'Pixelorama runtime must pin immutable upstream engine deployment');
expect(wrapper.includes("KELO_PCK_COMMIT='8bd90d24aab6d849eb7fe1b2fea760879d166401'"),'Pixelorama runtime must pin immutable Kelo PCK deployment');
expect(wrapper.includes('cdn.jsdelivr.net/gh/kelffren/gemini@${KELO_PCK_COMMIT}/index.pck'),'custom Pixelorama pack must load lazily from the isolated runtime commit');
expect(wrapper.includes("await startEngine(KELO_PCK,'kelo-custom-pck')"),'runtime must try Kelo custom PCK first');
expect(wrapper.includes("await startEngine(STOCK_PCK,'stock-fallback')"),'runtime must retain stock PCK safe fallback');
expect(wrapper.includes("tell('custom-pack-fallback'"),'Session Doctor must report custom PCK fallback reason');
expect(wrapper.includes("source==='kelo-custom-pck'&&!nativeBridge"),'custom PCK must prove KeloWebBridge before promotion');
expect(wrapper.includes('serviceWorker:null'),'embedded Pixelorama must not register its own service worker');
expect(wrapper.includes('threads:false'),'Pixelorama runtime must remain threadless for mobile compatibility');
expect(wrapper.includes('requestQuit'),'Pixelorama runtime must request Godot quit');
expect(wrapper.includes('Engine?.unload'),'Pixelorama runtime must unload Godot memory');
expect(wrapper.includes('keloPixeloramaCommand'),'runtime must support Kelo native bridge when custom pack is deployed');
expect(wrapper.includes("BRIDGE_VERSION='kelo.pixelorama.session-doctor.v2-custom-pck'"),'runtime must expose custom-PCK Session Doctor bridge version');
expect(wrapper.includes("tell('asset-received'"),'runtime must acknowledge transferred asset bytes');
expect(wrapper.includes("tell('asset-injected'"),'stock runtime must acknowledge browser bridge injection');
expect(wrapper.includes("tell('asset-opened'"),'native runtime must acknowledge direct project/image open');
expect(wrapper.includes("tell('export-captured'"),'runtime must acknowledge captured exports before transfer');
expect(wrapper.includes('focusPulse()'),'stock Pixelorama bridge must emulate its expected focus-return lifecycle');
expect(!bridge.includes('orama-interactive.github.io/Pixelorama/'),'Asset Forge bridge must not iframe the external Pixelorama site');
expect(!bridge.includes("root.open?.("),'Pixelorama Pro must remain inside the game');
expect(bridge.includes('enterCreatorExclusiveMode'),'Pixelorama Pro must hibernate Kelo through creator lifecycle');
expect(bridge.includes('createPixeloramaProjectStore'),'Pixelorama .pxo must use bounded in-game persistence');
expect(bridge.includes("text:'DOCTOR CHECK'"),'Asset Forge overlay must expose Session Doctor UI');
expect(bridge.includes("message.type==='pong'"),'Asset Forge must consume runtime heartbeat replies');
expect(bridge.includes('HEARTBEAT_STALE_MS'),'Asset Forge must detect a stale Pixelorama heartbeat');
expect(exclusive.includes('KeloInputLocks'),'exclusive creator mode must reuse input owner');
expect(exclusive.includes('KeloMovement?.intercept'),'exclusive creator mode must reuse movement owner');
expect(exclusive.includes('KeloRender?.intercept'),'exclusive creator mode must reuse render owner');
expect(exclusive.includes('KeloSimulation?.suspend'),'exclusive creator mode must use simulation owner suspension');
expect(simulation.includes('suspendClaims:true'),'KeloSimulation must advertise native suspension claims');
expect(patcher.includes('max_undo_steps := 64'),'Kelo Pixelorama patch must bound Web undo history');
expect(patcher.includes('fileData = null'),'Kelo Pixelorama patch must release duplicated browser import buffers');
expect(patcher.includes('variant/thread_support=false'),'Kelo Pixelorama patcher must enforce threadless upstream Web preset');

if(errors.length){console.error(errors.map(v=>`FAIL: ${v}`).join('\n'));process.exit(1);}
console.log('pixelorama-runtime-audit OK');

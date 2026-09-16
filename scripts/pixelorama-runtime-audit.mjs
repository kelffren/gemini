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

expect(wrapper.includes("UPSTREAM_COMMIT='2af0e590b6f1dd8a9255686373c5831623bb03bd'"),'Pixelorama stock fallback must pin immutable upstream deployment');
expect(wrapper.includes("KELO_RUNTIME_COMMIT='5d2a3b99180ebeb1705cee865e7f6927df2352b5'"),'Pixelorama runtime must pin the immutable matched Kelo runtime commit');
expect(wrapper.includes('raw.githubusercontent.com/kelffren/gemini/${KELO_RUNTIME_COMMIT}'),'matched Pixelorama runtime must use immutable GitHub raw transport');
expect(wrapper.includes("RUNTIME_API_ROOT='https://api.github.com/repos/kelffren/gemini/contents'"),'matched runtime must retain GitHub Contents API raw fallback');
expect(wrapper.includes("Accept:'application/vnd.github.raw+json'"),'GitHub API fallback must request raw bytes');
expect(wrapper.includes("if(name.endsWith('.wasm'))return 'application/wasm'"),'WASM transport must normalize MIME to application/wasm');
expect(wrapper.includes("RUNTIME_BASE='https://kelo-pixelorama-runtime.invalid/index'"),'Godot must use a synthetic matched-runtime base intercepted by Kelo');
expect(wrapper.includes('installRuntimeTransport()'),'matched runtime must install the fetch/worklet transport before boot');
expect(wrapper.includes('loadMatchedEngineScript()'),'matched runtime must load its own JS from the same export commit');
expect(wrapper.includes("resolveEngine(){try{return (0,eval)('typeof Engine === \"function\" ? Engine : null')"),'Godot Engine must be resolved from the global lexical binding, not window.Engine');
expect(!wrapper.includes("typeof window.Engine!=='function'"),'runtime must not assume Godot Engine is a window property');
expect(!wrapper.includes('cdn.jsdelivr.net/gh/kelffren/gemini@${KELO_PCK_COMMIT}'),'runtime must not mix stock JS/WASM with a custom PCK');
expect(wrapper.includes("source:'kelo-matched-runtime'"),'runtime must boot the matched Kelo export first');
expect(wrapper.includes("next.searchParams.set('stock','1')"),'stock fallback must reload into a clean JS realm rather than redeclare a second Godot Engine');
expect(wrapper.includes("BRIDGE_VERSION='kelo.pixelorama.session-doctor.v3-matched-runtime'"),'runtime must expose matched-runtime Session Doctor bridge version');
expect(wrapper.includes("tell('boot-stage'"),'runtime must expose exact boot stages for mobile diagnosis');
expect(wrapper.includes("tell('runtime-fetch'"),'runtime must expose runtime asset transport evidence');
expect(wrapper.includes('serviceWorker:null'),'embedded Pixelorama must not register its own service worker');
expect(wrapper.includes('threads:false'),'Pixelorama runtime must remain threadless for mobile compatibility');
expect(wrapper.includes('requestQuit'),'Pixelorama runtime must request Godot quit');
expect(wrapper.includes('EngineCtor?.unload'),'Pixelorama runtime must unload the exact Godot engine constructor');
expect(wrapper.includes('keloPixeloramaCommand'),'runtime must support Kelo native bridge when custom runtime is deployed');
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

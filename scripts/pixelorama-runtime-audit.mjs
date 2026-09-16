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

expect(wrapper.includes("UPSTREAM_COMMIT='2af0e590b6f1dd8a9255686373c5831623bb03bd'"),'Pixelorama runtime must pin immutable upstream deployment');
expect(wrapper.includes('serviceWorker:null'),'embedded Pixelorama must not register its own service worker');
expect(wrapper.includes('threads:false'),'Pixelorama runtime must remain threadless for mobile compatibility');
expect(wrapper.includes('requestQuit'),'Pixelorama runtime must request Godot quit');
expect(wrapper.includes('Engine?.unload'),'Pixelorama runtime must unload Godot memory');
expect(wrapper.includes("keloPixeloramaCommand"),'runtime must support Kelo native bridge when custom build is deployed');
expect(!bridge.includes('orama-interactive.github.io/Pixelorama/'),'Asset Forge bridge must not iframe the external Pixelorama site');
expect(!bridge.includes("root.open?.("),'Pixelorama Pro must remain inside the game');
expect(bridge.includes('enterCreatorExclusiveMode'),'Pixelorama Pro must hibernate Kelo through creator lifecycle');
expect(bridge.includes('createPixeloramaProjectStore'),'Pixelorama .pxo must use bounded in-game persistence');
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

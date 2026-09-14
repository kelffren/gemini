import fs from 'node:fs';

const src=fs.readFileSync('src/studio/integration/world-studio-bridge.mjs','utf8');
const roots=[
  '../render/studio-overlay-canvas.mjs',
  '../render/creator-grid-overlay.mjs',
  '../input/pointer-input-adapter.mjs',
  '../input/studio-camera-controller.mjs',
  './authority-command-mirror.mjs',
  '../ui/creator-productivity-panel.mjs',
  '../tools/creator-actions.mjs',
  '../prefabs/creator-prefab-library.mjs',
  '../validation/creator-world-analyzer.mjs',
  '../document/document-commands.mjs'
];
for(const mod of roots)if(!src.includes(`'${mod}'`))throw new Error(`missing iPhone prewarm module ${mod}`);
if(!src.includes('for(let i=0;i<roots.length;i++)'))throw new Error('iPhone Studio prewarm must stay serialized');
if(!src.includes('await import(roots[i])'))throw new Error('serialized dynamic import missing');
if(!src.includes("if(i<roots.length-1)await yieldStudioBoot(root)"))throw new Error('main-thread yield must happen between iPhone imports, not after the final root');
if(!src.includes('await prewarmIphoneStudioRuntime(root)'))throw new Error('prewarm must run before controller hydrate');
const prewarmStart=src.indexOf('await prewarmIphoneStudioRuntime(root)');
const controllerStart=src.indexOf('controllerMod=await import(CONTROLLER)');
if(prewarmStart<0||controllerStart<0||prewarmStart>controllerStart)throw new Error('controller imports before iPhone prewarm');

const fnStart=src.indexOf('async function prewarmIphoneStudioRuntime(root)');
const loopStart=src.indexOf('for(let i=0;i<roots.length;i++)',fnStart);
const warmFlag=src.indexOf('iphonePrewarmed=true;',fnStart);
if(fnStart<0||loopStart<0||warmFlag<0)throw new Error('prewarm completion state missing');
if(warmFlag<loopStart)throw new Error('iPhone prewarm is marked complete before all roots finish');
const abortCheck=src.indexOf("if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT')",loopStart);
if(abortCheck<0||abortCheck>warmFlag)throw new Error('prewarm abort must leave completion state false');

console.log('world-editor-iphone-prewarm-audit: PASS');

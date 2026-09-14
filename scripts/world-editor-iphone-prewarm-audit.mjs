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
if(!src.includes('await yieldStudioBoot(root)'))throw new Error('main-thread yield missing between iPhone imports');
if(!src.includes('await prewarmIphoneStudioRuntime(root)'))throw new Error('prewarm must run before controller hydrate');
const prewarmStart=src.indexOf('await prewarmIphoneStudioRuntime(root)');
const controllerStart=src.indexOf('controllerMod=await import(CONTROLLER)');
if(prewarmStart<0||controllerStart<0||prewarmStart>controllerStart)throw new Error('controller imports before iPhone prewarm');
console.log('world-editor-iphone-prewarm-audit: PASS');

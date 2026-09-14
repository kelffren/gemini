import fs from 'node:fs';

const src=fs.readFileSync('src/studio/integration/world-studio-bridge.mjs','utf8');
const runtimeRoots=[
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

if(src.includes('prewarmIphoneStudioRuntime'))throw new Error('World bridge must not gate controller mount behind an eager iPhone runtime prewarm');
if(src.includes('iphonePrewarmed'))throw new Error('obsolete iPhone prewarm state must not return');
for(const mod of runtimeRoots){
  if(src.includes(`'${mod}'`))throw new Error(`runtime root leaked back into World bridge critical path: ${mod}`);
}
const status=src.indexOf("setWorldLaunchStatus(root,'Cargando editor…')");
const firstYield=src.indexOf('await yieldStudioBoot(root)',status);
const controllerStart=src.indexOf('controllerMod=await import(CONTROLLER)',firstYield);
if(status<0||firstYield<0||controllerStart<0)throw new Error('paced direct controller handoff missing');
if(!(status<firstYield&&firstYield<controllerStart))throw new Error('controller handoff order must be status -> paint yield -> controller import');
const beforeController=src.slice(firstYield,controllerStart);
if((beforeController.match(/await import\(/g)||[]).length!==0)throw new Error('no Studio runtime import may block between the paint yield and controller import');
const controllerReturn=src.indexOf('return controllerMod;',controllerStart);
if(controllerReturn<0)throw new Error('controller return missing');
const afterControllerImport=src.slice(controllerStart,controllerReturn);
if(afterControllerImport.includes('await yieldStudioBoot(root)'))throw new Error('do not insert a second paint/timer barrier between controller evaluation and World mount');
if(!afterControllerImport.includes("setWorldLaunchStatus(root,'Montando editor…')"))throw new Error('post-import mount status missing');
if(!src.includes("if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT')"))throw new Error('abort guard missing from direct controller handoff');

console.log('world-editor-iphone-prewarm-audit: PASS (controller-first, immediate mount handoff)');

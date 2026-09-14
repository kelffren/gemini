import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ensureWorldEditAuthorityLoaded, waitForWorldEditAuthority } from '../src/creators/adapters/world-creator-adapter.mjs';
import { createWorldWorkspaceManifest } from '../src/creators/workspaces/world-workspace.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const adapterPath=resolve(here,'../src/creators/adapters/world-creator-adapter.mjs');
const source=await readFile(adapterPath,'utf8');
const requiredModules=[
  '../../world/world-draft-store.js',
  '../../world/world-revision-system.js',
  '../../world/authorities/local-world-edit-authority.js',
  '../../world/world-edit-authority.js'
];
for(const modulePath of requiredModules){
  assert.ok(source.includes(modulePath),`lazy bootstrap missing ${modulePath}`);
}

const root={document:{},performance:{now:()=>Date.now()},setTimeout};
const order=[];
const authority={ready:true,request:async()=>({})};
const loaders=[
  async target=>{order.push('store');target.KELO_WORLD_DRAFT_STORE={};},
  async target=>{order.push('revisions');target.KELO_WORLD_REVISIONS={};},
  async target=>{order.push('local');target.LocalWorldEditAuthority=function LocalWorldEditAuthority(){};},
  async target=>{order.push('facade');target.KELO_WORLD_EDIT=authority;}
];
const loaded=await ensureWorldEditAuthorityLoaded(root,{loaders});
assert.equal(loaded,authority,'lazy bootstrap should return the world edit authority');
assert.deepEqual(order,['store','revisions','local','facade'],'world edit dependencies must load in dependency order');

let bootstrapCalls=0;
const readyRoot={document:{},performance:{now:()=>Date.now()},setTimeout};
const readyAuthority={ready:false,whenReady:async()=>{readyAuthority.ready=true;}};
const resolved=await waitForWorldEditAuthority(readyRoot,{
  timeoutMs:500,
  bootstrap:async target=>{bootstrapCalls++;target.KELO_WORLD_EDIT=readyAuthority;return readyAuthority;}
});
assert.equal(resolved,readyAuthority,'wait bridge should resolve the lazily bootstrapped authority');
assert.equal(bootstrapCalls,1,'wait bridge should bootstrap exactly once');
assert.equal(resolved.ready,true,'wait bridge should honor the authority readiness contract');

let shell=null,openCalls=0,closeCalls=0;
const iosRoot={
  KELO_WORLD_EDIT:{ready:true},
  KELO_WORLD_LAUNCH_YIELD_MS:0,
  document:{getElementById:id=>id==='kelo-studio-live'?shell:null},
  performance:{now:()=>Date.now()},
  setTimeout
};
const staleSession={id:'stale'};
const recoveredSession={id:'recovered'};
const manifest=createWorldWorkspaceManifest({
  loader:async()=>({
    openKeloStudioLive:async()=>{
      openCalls++;
      if(openCalls===1)return staleSession;
      shell={isConnected:true};
      return recoveredSession;
    },
    closeKeloStudioLive:async()=>{closeCalls++;shell=null;}
  })
});
const session=await manifest.open({root:iosRoot});
assert.equal(session,recoveredSession,'World workspace must recover when cached Studio session has no mounted shell');
assert.equal(openCalls,2,'World workspace should retry Studio exactly once after a stale shell');
assert.equal(closeCalls,1,'World workspace should close the stale Studio session before retrying');
assert.equal(iosRoot.document.getElementById('kelo-studio-live')?.isConnected,true,'recovered World session must leave a connected Studio shell');

let loaderStarted=0,chromeBeforeLoader=false;
const nodes=new Map();
const paintRoot={
  KELO_WORLD_EDIT:{ready:true},
  KELO_WORLD_LAUNCH_YIELD_MS:0,
  document:{
    body:{
      append(el){if(el?.id)nodes.set(el.id,el);}
    },
    createElement(tag){
      const el={
        tagName:String(tag).toUpperCase(),
        id:'',
        textContent:'',
        innerHTML:'',
        className:'',
        style:{cssText:''},
        isConnected:true,
        dataset:{},
        setAttribute(name,value){if(name==='id')this.id=value;},
        querySelector(){return null;},
        remove(){if(this.id)nodes.delete(this.id);}
      };
      return el;
    },
    getElementById(id){
      return nodes.get(id)||null;
    }
  },
  requestAnimationFrame:cb=>setTimeout(cb,0),
  setTimeout,
  clearTimeout
};
const paintManifest=createWorldWorkspaceManifest({
  loader:async()=>{
    loaderStarted++;
    chromeBeforeLoader=!!paintRoot.document.getElementById('kelo-studio-live');
    return {openKeloStudioLive:async()=>{
      const shell=paintRoot.document.getElementById('kelo-studio-live')||paintRoot.document.createElement('section');
      shell.id='kelo-studio-live';
      shell.dataset={};
      shell.querySelector=sel=>sel==='.ks-status'?{textContent:'SELECT'}:null;
      paintRoot.document.body.append(shell);
      return {id:'fresh'};
    },closeKeloStudioLive:async()=>{}};
  }
});
const painted=await paintManifest.open({root:paintRoot});
assert.equal(painted.id,'fresh','World launch with a chrome shell must still open Studio');
assert.equal(loaderStarted,1,'Studio loader must run after the launch shell paints');
assert.equal(chromeBeforeLoader,true,'World Studio placeholder must be visible before the heavy Studio import starts');

let timeoutCalls=0;
const hangRoot={
  KELO_WORLD_EDIT:{ready:true},
  KELO_WORLD_OPEN_TIMEOUT_MS:40,
  KELO_WORLD_LAUNCH_YIELD_MS:0,
  document:{getElementById:()=>null,body:{append(){}},createElement:()=>({style:{},dataset:{},setAttribute(){}})},
  setTimeout,
  clearTimeout
};
const hangManifest=createWorldWorkspaceManifest({
  loader:async()=>({
    openKeloStudioLive:()=>new Promise(()=>{timeoutCalls++;}),
    closeKeloStudioLive:async()=>{}
  })
});
const started=Date.now();
await assert.rejects(()=>hangManifest.open({root:hangRoot}),/WORLD_EDITOR_OPEN_TIMEOUT|CREATOR_WORLD_STUDIO_MOUNT_FAILED/);
assert.ok(Date.now()-started<20000,'World open watchdog must fail closed instead of leaving the Hub frozen');
assert.ok(timeoutCalls>=1,'timeout path must have attempted a Studio open');

const hangImportRoot={
  KELO_WORLD_EDIT:{ready:true},
  KELO_WORLD_OPEN_TIMEOUT_MS:40,
  KELO_WORLD_LAUNCH_YIELD_MS:0,
  document:{getElementById:()=>null,body:{append(){}},createElement:()=>({style:{},dataset:{},setAttribute(){}})},
  setTimeout,
  clearTimeout
};
const hangImportManifest=createWorldWorkspaceManifest({
  loader:()=>new Promise(()=>{})
});
const importStarted=Date.now();
await assert.rejects(()=>hangImportManifest.open({root:hangImportRoot}),/WORLD_EDITOR_OPEN_TIMEOUT/);
assert.ok(Date.now()-importStarted<20000,'Studio import hang must fail closed so the World button can be tapped again');

const worldSource=await readFile(resolve(here,'../src/creators/workspaces/world-workspace.mjs'),'utf8');
assert.match(worldSource,/paintWorldEditorLaunchShell|paintLaunch/,'World must expose an immediate Studio loading shell for Hub handoff');
assert.match(worldSource,/paintInteractiveChrome/,'World must upgrade to live Studio chrome before importing the controller graph');
assert.match(worldSource,/studio-live-shell\.mjs/,'World must load studio-live-shell before the live controller');
assert.match(worldSource,/WORLD_EDITOR_OPEN_TIMEOUT/,'World workspace must time out instead of freezing the editor button');
assert.match(worldSource,/yieldFrames/,'World workspace must yield frames so iPhone can paint ABRIENDO');
assert.match(worldSource,/420/,'World launch must yield ~420ms so iPhone can composite Studio chrome before the graph loads');
assert.match(worldSource,/KeloRender/,'World launch must pause gameplay render during the Studio import');
assert.match(worldSource,/withTimeout\(root,boot\(\)/,'World open watchdog must cover the Studio import, not only openKeloStudioLive');
assert.match(worldSource,/keloWorldLoading/,'Loading placeholder must not count as a mounted Studio shell');
assert.match(worldSource,/setGameplayBusy/,'World launch must mark the updater busy so a PWA reload cannot black-screen Safari');

const controllerSource=await readFile(resolve(here,'../src/studio/integration/live-studio-controller.mjs'),'utf8');
assert.doesNotMatch(controllerSource,/^import \{ createStudioOverlayCanvas \}/m,'Live controller must not statically import the overlay canvas');
assert.doesNotMatch(controllerSource,/^import \{ createStudioLiveShell \}/m,'Live controller must not statically import the Studio shell');
assert.match(controllerSource,/loadLiveStudioChrome/,'Live controller must load chrome before the rest of the Studio graph');
assert.match(controllerSource,/loadLiveStudioRuntime/,'Live controller must dynamically import remaining Studio modules after chrome');

console.log(JSON.stringify({
  ok:true,
  lazyAuthorityBootstrap:true,
  dependencyOrder:order,
  readinessContract:true,
  bootstrapCalls,
  iosWorldStaleShellRecovery:true,
  studioOpenCalls:openCalls,
  studioCloseCalls:closeCalls,
  launchChromeBeforeImport:chromeBeforeLoader,
  openWatchdog:true,
  importWatchdog:true,
  dynamicStudioGraph:true
}));

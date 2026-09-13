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

console.log(JSON.stringify({
  ok:true,
  lazyAuthorityBootstrap:true,
  dependencyOrder:order,
  readinessContract:true,
  bootstrapCalls,
  iosWorldStaleShellRecovery:true,
  studioOpenCalls:openCalls,
  studioCloseCalls:closeCalls
}));
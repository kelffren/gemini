import assert from 'node:assert/strict';
import {createMapForgeWorkspaceManifest} from '../src/creators/workspaces/map-forge-workspace.mjs';

let releaseLoader;
const loaderGate=new Promise(resolve=>{releaseLoader=resolve;});
let loaderCalls=0;
let openCalls=0;
const session=Object.freeze({shell:Object.freeze({isConnected:true})});
const sharedWindow={};
const sharedDocument={defaultView:sharedWindow,getElementById(){return null;}};
const rootA={document:sharedDocument};
const rootB={document:sharedDocument};

const loader=async()=>{
  loaderCalls+=1;
  await loaderGate;
  return {
    getMapForgeWorkspace(){return null;},
    async openMapForgeWorkspace(){openCalls+=1;return session;}
  };
};

const manifestA=createMapForgeWorkspaceManifest({loader});
const manifestB=createMapForgeWorkspaceManifest({loader});
const first=manifestA.open({root:rootA});
const second=manifestB.open({root:rootB});

await Promise.resolve();
assert.equal(loaderCalls,1,'distinct root wrappers sharing one document must share the canonical opening lock');
releaseLoader();
const [a,b]=await Promise.all([first,second]);
assert.equal(loaderCalls,1,'Map Forge UI loader must run once for one browsing context');
assert.equal(openCalls,1,'Map Forge workspace must mount once for one browsing context');
assert.equal(a,session);
assert.equal(b,session);
assert.equal(sharedWindow.__KELO_MAP_FORGE_WORKSPACE_OPENING__,undefined,'opening lock must be released after launch');

console.log('MAP_FORGE_CANONICAL_OPEN_LOCK_PASS roots=2 windows=1 loaderCalls=1 openCalls=1');

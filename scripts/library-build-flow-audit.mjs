/* KELO-INDEX
 * area: QA / UNIVERSAL LIBRARY / FAST BUILD
 * owner: Main Stability Gate
 * keys: LIBRARY BUILD VAULT STUDIO GHOST PLACEMENT SCENE PAINTER AUTHORITY MOBILE
 * purpose: prove that one-tap library build reuses canonical Studio placement and never bypasses Baúl or CommandBus authority
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  listPersonalBuildTemplates,
  choosePersonalBuildTemplate,
  startPersonalAssetPlacement
} from '../src/studio/integration/library-build-bridge.mjs';

const bridgeSource=fs.readFileSync(new URL('../src/studio/integration/library-build-bridge.mjs',import.meta.url),'utf8');
const vaultSource=fs.readFileSync(new URL('../asset-vault.html',import.meta.url),'utf8');
const launcherSource=fs.readFileSync(new URL('../src/ui/asset-library-launcher.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

// Architecture: Build Bridge orchestrates existing Studio tools. It must not own authority writes.
assert.doesNotMatch(bridgeSource,/KELO_WORLD_EDIT/,'library build bridge must not write World authority directly');
assert.doesNotMatch(bridgeSource,/kernel\.execute\s*\(/,'library build bridge must not bypass Studio placement/CommandBus');
assert.match(bridgeSource,/seedCatalogPrefabs/,'integrated PropertyCatalog assets must enter the existing Studio prefab registry');
assert.match(bridgeSource,/session\.beginPlacement/,'visual assets must use the canonical ghost placement flow');
assert.match(bridgeSource,/placement\?\.move/,'the ghost must be moved into the active camera area');
assert.match(bridgeSource,/paint-copies-tool\.mjs/,'fast build must be able to wake Scene Painter without waiting for the normal phone delay');

// Library: one explicit Build action may download+integrate, then hands off only the persisted asset id.
assert.match(vaultSource,/data-act="build"/,'buildable library cards must expose Poner');
assert.match(vaultSource,/await downloadAsset\(remote\)/,'Poner must persist a remote asset through Mi Baúl before World use');
assert.match(vaultSource,/await integrateContent\(id\)/,'Poner must compile/integrate the asset before placement');
assert.match(vaultSource,/kelo:build-personal-content/,'library must hand the persisted asset id to the game');
assert.match(launcherSource,/platform\.openWorkspace\('world'\)/,'game launcher must open the real World workspace directly');
assert.match(launcherSource,/library-build-bridge\.mjs\?v=1/,'launcher must hand off through the isolated build bridge');
assert.match(indexSource,/asset-library-launcher\.js\?v=8-fast-build/,'game boot must cache-bust the fast-build launcher');

// Pure selection contract.
const catalogRows=[
  {id:'world:tree',label:'Built-in Tree',sourceId:null,placeable:true},
  {id:'personal:ext:forest:trunk',label:'Forest Trunk',sourceId:'ext:forest',placeable:true},
  {id:'personal:ext:forest:leaves',label:'Forest Leaves',sourceId:'ext:forest',placeable:true},
  {id:'personal:ext:other:rock',label:'Rock',sourceId:'ext:other',placeable:true}
];
const catalog={list:()=>catalogRows,get:id=>catalogRows.find(row=>row.id===String(id))||null};
const personal=listPersonalBuildTemplates({session:{studio:{adapter:{assetCatalog:catalog}}},assetId:'ext:forest'});
assert.deepEqual(personal.map(row=>row.id),['personal:ext:forest:trunk','personal:ext:forest:leaves']);
assert.equal(choosePersonalBuildTemplate(personal,'personal:ext:forest:leaves')?.id,'personal:ext:forest:leaves');
assert.equal(choosePersonalBuildTemplate(personal)?.id,'personal:ext:forest:trunk');

// Functional ghost contract with a minimal Studio double.
const registered=new Map();
const prefabs={
  has:id=>registered.has(String(id)),
  register:def=>{registered.set(String(def.id),def);return def;},
  resolve:id=>registered.get(String(id))||null,
  size:()=>registered.size
};
let preview=null,moveCall=null,beginId=null;
const placement={
  getPreview:()=>preview,
  move:(x,y,options)=>{moveCall={x,y,options};return preview;}
};
const session={
  snapSize:32,
  cameraController:{toWorld:()=>({x:321,y:654})},
  studio:{
    adapter:{assetCatalog:catalog},
    kernel:{prefabs,document:{settings:{tileSize:32}}},
    tools:{placement}
  },
  beginPlacement(id){beginId=String(id);preview={prefabId:String(id)};}
};
const root={innerWidth:390,innerHeight:844,dispatchEvent(){}};
const result=await startPersonalAssetPlacement({
  root,session,assetId:'ext:forest',templateId:'personal:ext:forest:leaves',prepareScenePainter:false
});
assert.equal(result.mode,'placement');
assert.equal(result.prefabId,'personal:ext:forest:leaves');
assert.equal(beginId,result.prefabId);
assert.deepEqual(moveCall,{x:321,y:654,options:{snap:32}});
assert.equal(result.painterReady,false);
assert.equal(result.alternatives.length,2);

console.log('PASS library-build-flow-audit: Library → Baúl → integrated catalog → canonical Studio ghost placement');

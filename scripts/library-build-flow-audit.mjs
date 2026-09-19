/* KELO-INDEX
 * area: QA / UNIVERSAL LIBRARY / FAST BUILD
 * owner: Main Stability Gate
 * keys: LIBRARY BUILD VAULT STUDIO GHOST PALETTE BRUSH SCENE PAINTER AUTHORITY MOBILE
 * purpose: prove one-tap and multi-asset library build reuse canonical Studio commands without bypassing Baúl or authority
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  listPersonalBuildTemplates,
  choosePersonalBuildTemplate,
  startPersonalAssetPlacement
} from '../src/studio/integration/library-build-bridge.mjs';
import {createLibraryPaletteBrushTool} from '../src/studio/tools/library-palette-brush-tool.mjs';

const bridgeSource=fs.readFileSync(new URL('../src/studio/integration/library-build-bridge.mjs',import.meta.url),'utf8');
const brushSource=fs.readFileSync(new URL('../src/studio/tools/library-palette-brush-tool.mjs',import.meta.url),'utf8');
const vaultSource=fs.readFileSync(new URL('../asset-vault.html',import.meta.url),'utf8');
const launcherSource=fs.readFileSync(new URL('../src/ui/asset-library-launcher.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

// Bridge orchestrates existing Studio tools. Authority writes must stay outside the bridge.
assert.doesNotMatch(bridgeSource,/KELO_WORLD_EDIT/,'library build bridge must not write World authority directly');
assert.doesNotMatch(bridgeSource,/kernel\.execute\s*\(/,'library build bridge must not bypass Studio tools');
assert.match(bridgeSource,/seedCatalogPrefabs/,'integrated PropertyCatalog assets must enter the existing Studio prefab registry');
assert.match(bridgeSource,/session\.beginPlacement/,'single visual assets must use canonical ghost placement');
assert.match(bridgeSource,/library-palette-brush-tool\.mjs/,'multi-asset build must route through the isolated palette tool');
assert.match(bridgeSource,/paint-copies-tool\.mjs/,'single fast build must still be able to wake Scene Painter');

// Palette tool is allowed to commit, but only by composing ordinary reversible entity.place commands.
assert.match(brushSource,/createPlaceEntityCommand/,'palette brush must use ordinary placement commands');
assert.match(brushSource,/createCompositeCommand/,'one palette gesture must be one composite history action');
assert.match(brushSource,/kernel\.execute\(command\)/,'palette brush must commit through Studio CommandBus');
assert.doesNotMatch(brushSource,/KELO_WORLD_EDIT/,'palette brush must not talk directly to World authority');
assert.match(brushSource,/MAX_PREVIEW\s*=\s*180/,'palette preview must stay bounded for mobile');

// Library keeps explicit persistence before either single or palette handoff.
assert.match(vaultSource,/data-act="build"/,'buildable cards must expose Poner');
assert.match(vaultSource,/data-act="palette"/,'visual cards must expose palette selection');
assert.match(vaultSource,/MAX_PALETTE=12/,'phone palette selection must be bounded');
assert.match(vaultSource,/await downloadAsset\(remote\)/,'remote content must persist through Mi Baúl before World use');
assert.match(vaultSource,/await integrateContent\(id\)/,'palette assets must integrate before World use');
assert.match(vaultSource,/kelo:build-personal-palette/,'library must hand the persisted palette to the game');
assert.match(vaultSource,/state\.palette\.clear\(\)/,'active-page palette must be disposable on page hibernation');
assert.match(launcherSource,/platform\.openWorkspace\('world'\)/,'launcher must open the real World workspace directly');
assert.match(launcherSource,/library-build-bridge\.mjs\?v=2/,'launcher must use palette-aware build bridge');
assert.match(indexSource,/asset-library-launcher\.js\?v=9-build-palette/,'boot must cache-bust the palette launcher');

// Pure template selection contract.
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

// Functional single-asset ghost contract.
const registered=new Map();
const prefabs={
  has:id=>registered.has(String(id)),
  register:def=>{registered.set(String(def.id),def);return def;},
  resolve:id=>registered.get(String(id))||null,
  size:()=>registered.size
};
let preview=null,moveCall=null,beginId=null;
const placement={getPreview:()=>preview,move:(x,y,options)=>{moveCall={x,y,options};return preview;}};
const session={
  snapSize:32,
  cameraController:{toWorld:()=>({x:321,y:654})},
  studio:{adapter:{assetCatalog:catalog},kernel:{prefabs,document:{settings:{tileSize:32}}},tools:{placement}},
  beginPlacement(id){beginId=String(id);preview={prefabId:String(id)};}
};
const root={innerWidth:390,innerHeight:844,dispatchEvent(){}};
const result=await startPersonalAssetPlacement({root,session,assetId:'ext:forest',templateId:'personal:ext:forest:leaves',prepareScenePainter:false});
assert.equal(result.mode,'placement');
assert.equal(result.prefabId,'personal:ext:forest:leaves');
assert.equal(beginId,result.prefabId);
assert.deepEqual(moveCall,{x:321,y:654,options:{snap:32}});
assert.equal(result.painterReady,false);

// Functional palette gesture: deterministic multi-prefab previews, one reversible command.
const brushPrefabs=new Map([
  ['p:tree',{id:'p:tree',bounds:{w:28,h:44}}],
  ['p:rock',{id:'p:rock',bounds:{w:24,h:20}}],
  ['p:flower',{id:'p:flower',bounds:{w:16,h:18}}]
]);
const document={entities:[],settings:{tileSize:32}};
let lastCommand=null,executeCount=0,selected=[];
const fakeKernel={
  prefabs:{resolve:id=>brushPrefabs.get(String(id))||null},
  spatial:{queryRect:()=>[]},
  document,
  input:{register:()=>()=>{},push:()=>{},pop:()=>{}},
  selection:{set:value=>{selected=Array.isArray(value)?value:[value];}},
  async execute(command){executeCount++;lastCommand=command;await command.execute({document,kernel:fakeKernel});}
};
const brush=createLibraryPaletteBrushTool(fakeKernel,{root:{}});
brush.configurePalette(['p:tree','p:rock','p:flower'],{spacing:48,jitter:0,snap:16,seed:23,maxPreview:20,avoidOverlap:false});
brush.beginAt(0,0);brush.strokeTo(220,0);
const before=brush.getPreviews();
assert.ok(before.length>=4,'palette stroke should create several bounded previews');
assert.ok(before.every(row=>brushPrefabs.has(row.prefabId)),'every preview must resolve from selected palette prefabs');
const committed=await brush.commit();
assert.equal(executeCount,1,'one gesture must execute exactly one Studio command');
assert.equal(document.entities.length,committed.length);
assert.equal(selected.length,committed.length);
assert.equal(lastCommand.type,'entity.batch.library-palette');
await lastCommand.undo({document,kernel:fakeKernel});
assert.equal(document.entities.length,0,'palette gesture must undo as one action');
brush.destroy();

console.log('PASS library-build-flow-audit: single ghost + multi-asset Build Palette remain Baúl-first and CommandBus-authoritative');

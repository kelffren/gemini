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
import {inferSemanticRole,buildSemanticPalette} from '../src/studio/tools/semantic-brush-profile.mjs';

const bridgeSource=fs.readFileSync(new URL('../src/studio/integration/library-build-bridge.mjs',import.meta.url),'utf8');
const brushSource=fs.readFileSync(new URL('../src/studio/tools/library-palette-brush-tool.mjs',import.meta.url),'utf8');
const semanticSource=fs.readFileSync(new URL('../src/studio/tools/semantic-brush-profile.mjs',import.meta.url),'utf8');
const vaultSource=fs.readFileSync(new URL('../asset-vault.html',import.meta.url),'utf8');
const launcherSource=fs.readFileSync(new URL('../src/ui/asset-library-launcher.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

// Bridge orchestrates existing Studio tools. Authority writes must stay outside the bridge.
assert.doesNotMatch(bridgeSource,/KELO_WORLD_EDIT/,'library build bridge must not write World authority directly');
assert.doesNotMatch(bridgeSource,/kernel\.execute\s*\(/,'library build bridge must not bypass Studio tools');
assert.match(bridgeSource,/seedCatalogPrefabs/,'integrated PropertyCatalog assets must enter the existing Studio prefab registry');
assert.match(bridgeSource,/session\.beginPlacement/,'single visual assets must use canonical ghost placement');
assert.match(bridgeSource,/library-palette-brush-tool\.mjs/,'multi-asset build must route through the isolated palette tool');
assert.match(bridgeSource,/buildSemanticPalette/,'multi-asset handoff must classify semantic roles before brush activation');
assert.match(bridgeSource,/paint-copies-tool\.mjs/,'single fast build must still be able to wake Scene Painter');

// Palette tool is allowed to commit, but only by composing ordinary reversible entity.place commands.
assert.match(brushSource,/createPlaceEntityCommand/,'palette brush must use ordinary placement commands');
assert.match(brushSource,/createCompositeCommand/,'one palette gesture must be one composite history action');
assert.match(brushSource,/kernel\.execute\(command\)/,'palette brush must commit through Studio CommandBus');
assert.doesNotMatch(brushSource,/KELO_WORLD_EDIT/,'palette brush must not talk directly to World authority');
assert.match(brushSource,/MAX_PREVIEW\s*=\s*180/,'semantic preview must stay bounded for mobile');
assert.match(brushSource,/density:/,'semantic brush must expose density');
assert.match(brushSource,/radius:/,'semantic brush must expose area radius');
assert.match(brushSource,/avoidCollisions:/,'semantic brush must support collision exclusion');
assert.match(brushSource,/blockedZoneTags/,'semantic brush must support protected zones');
assert.match(semanticSource,/SEMANTIC_PRESETS/,'semantic presets must be data-driven');
for(const [label,expected] of [['Oak Tree','canopy'],['Fern Patch','understory'],['Rock Small','detail'],['Street Lamp','roadside'],['River Reeds','waterside'],['Stone House','structure'],['Mystery Asset','generic']])assert.equal(inferSemanticRole({label}),expected);

// Library keeps explicit persistence before either single or palette handoff.
assert.match(vaultSource,/data-act="build"/,'buildable cards must expose Poner');
assert.match(vaultSource,/data-act="palette"/,'visual cards must expose palette selection');
assert.match(vaultSource,/MAX_PALETTE=12/,'phone palette selection must be bounded');
assert.match(vaultSource,/await downloadAsset\(remote\)/,'remote content must persist through Mi Baúl before World use');
assert.match(vaultSource,/await integrateContent\(id\)/,'palette assets must integrate before World use');
assert.match(vaultSource,/kelo:build-personal-palette/,'library must hand the persisted palette to the game');
assert.match(vaultSource,/state\.palette\.clear\(\)/,'active-page palette must be disposable on page hibernation');
assert.match(launcherSource,/platform\.openWorkspace\('world'\)/,'launcher must open the real World workspace directly');
assert.match(launcherSource,/library-build-bridge\.mjs\?v=4/,'launcher must use semantic-aware build bridge');
assert.match(indexSource,/asset-library-launcher\.js\?v=11-semantic-context/,'boot must cache-bust the semantic launcher');

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

// Functional Semantic Brush: role-aware, deterministic, constrained and one reversible command.
const brushPrefabs=new Map([
  ['p:tree',{id:'p:tree',label:'Oak Tree',bounds:{w:28,h:44}}],
  ['p:fern',{id:'p:fern',label:'Fern Patch',bounds:{w:24,h:20}}],
  ['p:rock',{id:'p:rock',label:'Rock Small',bounds:{w:16,h:18}}]
]);
const semanticPalette=buildSemanticPalette([...brushPrefabs.values()]);
assert.deepEqual(semanticPalette.map(row=>row.role),['canopy','understory','detail']);

function makeBrushHarness(){
  const document={entities:[],settings:{tileSize:32},navigation:{collisions:{blocked:{collisionId:'blocked',x:0,y:0,w:40,h:40}}},zones:[{x:300,y:0,w:40,h:40,tags:['no-build']}]};
  let lastCommand=null,executeCount=0,selected=[];
  const kernel={
    prefabs:{resolve:id=>brushPrefabs.get(String(id))||null},
    spatial:{queryRect:()=>[]},
    document,
    input:{register:()=>()=>{},push:()=>{},pop:()=>{}},
    selection:{set:value=>{selected=Array.isArray(value)?value:[value];}},
    async execute(command){executeCount++;lastCommand=command;await command.execute({document,kernel});}
  };
  return{kernel,get:()=>({lastCommand,executeCount,selected})};
}
function paintDeterministic(harness){
  const brush=createLibraryPaletteBrushTool(harness.kernel,{root:{showToast(){}}});
  brush.configurePalette(semanticPalette,{spacing:48,density:1,radius:0,minSpacing:0,snap:16,seed:99,maxPreview:30,avoidOverlap:false,avoidCollisions:true,collisionClearance:0});
  brush.beginAt(8,8);
  assert.equal(brush.getPreviews().length,0,'collision area must reject semantic preview');
  brush.strokeTo(240,8);
  const rows=brush.getPreviews().map(row=>({prefabId:row.prefabId,transform:{...row.transform}}));
  return{brush,rows};
}
const first=makeBrushHarness(),a=paintDeterministic(first);
const second=makeBrushHarness(),b=paintDeterministic(second);
assert.ok(a.rows.length>=3,'semantic stroke should generate several previews');
assert.deepEqual(a.rows,b.rows,'same seed and inputs must regenerate identical previews');
assert.ok(a.rows.some(row=>row.transform.scale!==1),'semantic brush should author deterministic scale variation');
assert.ok(a.rows.every(row=>[0,90,180,270].includes(row.transform.rotation)),'semantic rotations must remain quarter-turn safe');
const committed=await a.brush.commit();
assert.equal(first.get().executeCount,1,'one semantic gesture must execute exactly one Studio command');
assert.equal(first.get().lastCommand.type,'entity.batch.library-semantic-brush');
assert.equal(first.kernel.document.entities.length,committed.length);
assert.equal(first.get().selected.length,committed.length);
await first.get().lastCommand.undo({document:first.kernel.document,kernel:first.kernel});
assert.equal(first.kernel.document.entities.length,0,'semantic gesture must undo as one action');
a.brush.destroy();b.brush.destroy();
console.log('PASS library-build-flow-audit: single ghost + deterministic Semantic Brush remain Baúl-first, bounded and CommandBus-authoritative');

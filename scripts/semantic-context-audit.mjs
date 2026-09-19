/* KELO-INDEX
 * area: QA / STUDIO / SEMANTIC CONTEXT
 * owner: Main Stability Gate
 * keys: SEMANTIC CONTEXT ROAD WATER BUILDING DISTRICT AFFINITY KILL SWITCH MOBILE
 * purpose: prove Phase D stays local, deterministic and overrideable
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSemanticContextResolver,classifySurfaceCell} from '../src/studio/tools/semantic-context-resolver.mjs';
import {createLibraryPaletteBrushTool} from '../src/studio/tools/library-palette-brush-tool.mjs';
import {buildSemanticPalette} from '../src/studio/tools/semantic-brush-profile.mjs';

const resolverSource=fs.readFileSync(new URL('../src/studio/tools/semantic-context-resolver.mjs',import.meta.url),'utf8');
const brushSource=fs.readFileSync(new URL('../src/studio/tools/library-palette-brush-tool.mjs',import.meta.url),'utf8');
const bridgeSource=fs.readFileSync(new URL('../src/studio/integration/library-build-bridge.mjs',import.meta.url),'utf8');
const launcherSource=fs.readFileSync(new URL('../src/ui/asset-library-launcher.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(resolverSource,/surfaceNeighborhood/,'road + water must use a bounded local terrain neighborhood');
assert.match(resolverSource,/kernel\.spatial\?\.queryRect/,'building context must use Studio spatial index');
assert.doesNotMatch(resolverSource,/Object\.values\(document\.terrain/,'semantic context must never scan the full terrain map per point');
assert.doesNotMatch(resolverSource,/KELO_WORLD_EDIT/,'semantic context is read-only and must not call authority');
assert.match(brushSource,/smartContext:/,'brush must expose context capability state');
assert.match(brushSource,/toggleSmartContext/,'brush must provide a kill switch');
assert.match(brushSource,/REGLAS ON/,'mobile UI must expose whether semantic rules are active');
assert.match(bridgeSource,/library-palette-brush-tool\.mjs\?v=3-context/,'bridge must cache-bust the context brush');
assert.match(launcherSource,/library-build-bridge\.mjs\?v=4/,'launcher must use context-aware bridge');
assert.match(indexSource,/asset-library-launcher\.js\?v=11-semantic-context/,'game boot must cache-bust context launcher');

assert.equal(classifySurfaceCell({role:'path',material:'grass'}),'path');
assert.equal(classifySurfaceCell({role:'terrain',material:'water_deep'}),'water');
assert.equal(classifySurfaceCell({role:'terrain',material:'cobble'}),'terrain');

const prefabs=new Map([
  ['p:tree',{id:'p:tree',label:'Oak Tree',bounds:{w:20,h:30}}],
  ['p:road',{id:'p:road',label:'Street Lamp',bounds:{w:16,h:24}}],
  ['p:reed',{id:'p:reed',label:'River Reeds',bounds:{w:12,h:18}}],
  ['p:house',{id:'p:house',label:'Stone House',bounds:{w:64,h:64}}]
]);
const buildingEntry={id:'house:1',category:'entity',rect:{x:224,y:0,w:64,h:64},data:{id:'house:1',prefabId:'p:house',components:{building:{}}}};
function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function makeKernel(){
  const document={
    settings:{tileSize:32},
    terrain:{
      '64,0':{x:64,y:0,material:'cobble',role:'path'},
      '64,32':{x:64,y:32,material:'cobble',role:'path'},
      '160,0':{x:160,y:0,material:'water_deep',role:'terrain'},
      '160,32':{x:160,y:32,material:'water_deep',role:'terrain'}
    },
    entities:[],
    zones:[
      {x:0,y:96,w:128,h:128,tags:['district:forest','semantic:prefer:canopy','semantic:block:structure']},
      {x:320,y:0,w:96,h:96,tags:['district:wetlands','semantic:only:waterside']}
    ],
    navigation:{collisions:{}}
  };
  let lastCommand=null;
  const kernel={
    document,
    prefabs:{resolve:id=>prefabs.get(String(id))||null},
    spatial:{queryRect:rect=>intersects(rect,buildingEntry.rect)?[buildingEntry]:[]},
    input:{register:()=>()=>{},push:()=>{},pop:()=>{}},
    selection:{set(){}},
    async execute(command){lastCommand=command;await command.execute({document,kernel});}
  };
  return{kernel,getLast:()=>lastCommand};
}
const harness=makeKernel(),resolver=createSemanticContextResolver(harness.kernel,{
  roadClearance:16,roadAffinity:96,waterClearance:0,waterAffinity:96,buildingAffinity:88,strictAffinity:true
});

const roadContext=resolver.contextAt(80,16);
assert.equal(roadContext.onRoad,true);
assert.equal(roadContext.nearRoad,true);
const waterContext=resolver.contextAt(176,16);
assert.equal(waterContext.onWater,true);
assert.equal(waterContext.nearWater,true);
const buildingContext=resolver.contextAt(208,16);
assert.equal(buildingContext.nearBuilding,true,'building edge must be discoverable through spatial index');

const forestContext=resolver.contextAt(32,128);
assert.ok(forestContext.district.districts.includes('district:forest'));
assert.ok(resolver.roleWeightMultiplier('canopy',forestContext)>resolver.roleWeightMultiplier('detail',forestContext),'forest district should prefer canopy');
assert.equal(resolver.roleWeightMultiplier('structure',forestContext),0,'forest district must block structure');

const wetlandsContext=resolver.contextAt(352,32);
assert.equal(resolver.roleWeightMultiplier('canopy',wetlandsContext),0,'only-role district must zero disallowed roles');
assert.ok(resolver.roleWeightMultiplier('waterside',wetlandsContext)>0,'only-role district must keep allowed role');

assert.equal(resolver.rejectReason({role:'canopy'},{x:96,y:8,w:20,h:30}),'road','trees must keep road clearance');
assert.equal(resolver.rejectReason({role:'roadside'},{x:96,y:8,w:16,h:24}),null,'roadside prop can sit beside but not on the road');
assert.equal(resolver.rejectReason({role:'waterside'},{x:112,y:8,w:12,h:18}),null,'waterside prop can sit on a bank near water');
assert.equal(resolver.rejectReason({role:'waterside'},{x:448,y:8,w:12,h:18}),'water-affinity','waterside prop must not appear far from water');

const semantic=buildSemanticPalette([
  {id:'p:tree',label:'Oak Tree'}
]);
const brush=createLibraryPaletteBrushTool(harness.kernel,{root:{showToast(){}}});
brush.configurePalette(semantic,{activate:true,spacing:48,density:1,radius:0,minSpacing:0,snap:16,seed:41,avoidOverlap:false,avoidCollisions:false,roadClearance:16,roadAffinity:96,smartContext:true,maxPreview:20});
brush.beginAt(96,8);
assert.equal(brush.getPreviews().length,0,'context ON must reject canopy beside protected road');
brush.cancelStroke();
brush.toggleSmartContext();
assert.equal(brush.state().settings.smartContext,false);
brush.beginAt(96,8);
assert.equal(brush.getPreviews().length,1,'context OFF must preserve manual creator override');
brush.cancelStroke();
brush.destroy();

console.log('PASS semantic-context-audit: road, water, building edge, district rules and creator override stay local and deterministic');

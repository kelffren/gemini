import fs from 'node:fs';
import vm from 'node:vm';

const contractSource=fs.readFileSync('src/environment/prefab-contract.js','utf8');
const rendererSource=fs.readFileSync('src/environment/generic-prefabs.js','utf8');
const adapterSource=fs.readFileSync('src/environment/luxe-kiosk-atlas.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

const window={KELO_TILE_REGISTRY:{version:'test-registry',styles:{architecture:{mode:'test'}},architectureAssets:{
  shop:{id:'shop',src:'shop.png',width:192,height:222,worldWidth:192,worldHeight:222,family:'architecture'},
  castle:{id:'castle',src:'castle.png',width:320,height:256,worldWidth:320,worldHeight:256,family:'architecture'}
},architecturePrefabs:{
  shop:{id:'shop-central',asset:'shop',x:100,y:200,collision:{x:120,y:370,w:140,h:40},interaction:{x:196,y:430,radius:90},occlusion:{sideInset:8,topInset:30,bottomPadding:4,clip:{xPadding:6,topPadding:20,bottomPadding:6}},districts:['central']},
  castle:{id:'castle-north',asset:'castle',x:700,y:400,collision:{x:740,y:610,w:240,h:46},entrance:{x:860,y:668,radius:110},doors:[{id:'main'}],shadows:[{id:'base'}],overlays:[{id:'banner'}],animation:[{id:'flag'}],districts:['north']}
}}};
const context=vm.createContext({window,console});
vm.runInContext(contractSource,context,{filename:'prefab-contract.js'});
const C=window.KELO_PREFAB_CONTRACT;
if(!C)throw new Error('Prefab contract did not initialize');
if(C.version!=='1.0.0'||C.prefabs.length!==2)throw new Error('Unexpected contract version/count');
const castle=C.prefabs.find(p=>p.id==='castle-north');
if(!castle||castle.asset!=='castle'||castle.size.w!==320||castle.size.h!==256)throw new Error('Unknown building did not normalize from metadata');
if(castle.entrance?.x!==860||castle.doors.length!==1||castle.shadows.length!==1||castle.overlays.length!==1||castle.animation.length!==1||castle.districts[0]!=='north')throw new Error('Optional building metadata was not preserved');
for(const key of ['splitLayers','colliders','interactionMetadata','entrances','doors','shadows','overlays','animationFrames','occlusion','districtCompatibility'])if(C.capabilities[key]!==true)throw new Error(`Missing capability ${key}`);
if(/luxeBoutique|kelo-luxe|SHOP|Boutique/.test(rendererSource))throw new Error('Generic prefab renderer contains building-specific knowledge');
if(/new Image\(|drawImage|\.register\(\{id:[`'"]?luxe/.test(adapterSource))throw new Error('Luxe adapter still owns rendering');
if(!/src\/environment\/prefab-contract\.js\?v=\d+/.test(indexSource)||!/src\/environment\/generic-prefabs\.js\?v=\d+/.test(indexSource))throw new Error('Generic prefab pipeline is not booted');
if(indexSource.indexOf('prefab-contract.js?')>indexSource.indexOf('luxe-kiosk-atlas.js'))throw new Error('Prefab contract loads after compatibility adapter');
console.log('PASS prefab contract: synthetic castle integrated through metadata without renderer changes');
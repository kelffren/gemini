import assert from 'node:assert/strict';
import {classifyAsset,parseIntent,rankAssets,snapCompatibility,buildWithThisPlan} from '../src/creators/assets/asset-discovery-intelligence.mjs';
const assets=[
 {id:'crypt-room',name:'Dark Crypt Boss Room',tags:['dungeon','boss'],styles:['medieval'],performance:{mobileReady:true},connections:['door','corridor']},
 {id:'wall-a',name:'Medieval Stone Wall',type:'module',snapType:'wall',tags:['medieval'],connections:['wall','corner','door'],performance:{triangles:1200,previewBytes:90000}},
 {id:'door-a',name:'Crypt Door',type:'module',snapType:'door',tags:['medieval'],connections:['wall','room'],performance:{mobileReady:true}},
 {id:'car',name:'Realistic Sports Car',type:'prop',styles:['realistic'],performance:{triangles:200000}}
];
assert.equal(classifyAsset(assets[0]).type,'room');
assert.equal(parseIntent('dark medieval dungeon boss mobile').type,'dungeon');
assert.equal(rankAssets(assets,'medieval dungeon boss',{styles:['medieval']})[0].asset.id,'crypt-room');
assert.equal(snapCompatibility(assets[1],assets[2]).compatible,true);
assert.ok(buildWithThisPlan(assets[1],assets,{styles:['medieval']}).suggestions.includes('door-a'));
console.log('asset-discovery-intelligence: ok');

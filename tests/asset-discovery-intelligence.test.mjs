import assert from 'node:assert/strict';
import {classifyAsset,parseIntent,rankAssets,snapCompatibility,buildWithThisPlan,dungeonDNA,styleCompatibility,groupSearchResults,continueBuilding} from '../src/creators/assets/asset-discovery-intelligence.mjs';
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
const dna=dungeonDNA({...assets[0],topology:{rooms:12,branches:3,deadEnds:2,verticality:'medium'}});
assert.ok(dna.roles.includes('boss')); assert.equal(dna.rooms,12);
assert.equal(styleCompatibility(assets[1],{styles:['medieval']}).score,1);
const grouped=groupSearchResults(rankAssets(assets,'medieval',{styles:['medieval']})); assert.ok(grouped.modules.length>=2);
const next=continueBuilding([assets[1]],assets,{styles:['medieval']}); assert.ok(next.some(x=>x.asset.id==='door-a'));
assert.equal(buildWithThisPlan(assets[0],assets,{styles:['medieval']}).version,2);
console.log('asset-discovery-intelligence v2: ok');

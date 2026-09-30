import assert from 'node:assert/strict';
import {filterAssetPaletteRows} from '../src/studio/ui/studio-asset-palette.mjs';
import {rankAssets,groupSearchResults,buildWithThisPlan} from '../src/creators/assets/asset-discovery-intelligence.mjs';
const rows=[
 {id:'boss-room',name:'Dark Medieval Boss Room',tags:['dungeon','boss'],styles:['medieval'],connections:['door','corridor'],performance:{mobileReady:true}},
 {id:'door',name:'Medieval Crypt Door',type:'module',snapType:'door',tags:['medieval'],connections:['room','wall'],performance:{mobileReady:true}},
 {id:'tree',name:'Forest Tree',type:'prop',category:'nature_trees_rocks'}
];
assert.equal(filterAssetPaletteRows(rows,{category:'all'}).length,3);
const ranked=rankAssets(rows,'dark medieval dungeon boss',{usedAssetIds:[]});
assert.equal(ranked[0].asset.id,'boss-room');
const grouped=groupSearchResults(ranked);
assert.ok(grouped.rooms.length>=1);
const plan=buildWithThisPlan(rows[0],rows,{});
assert.ok(plan.suggestions.includes('door'));
console.log('studio asset intelligence integration: ok');

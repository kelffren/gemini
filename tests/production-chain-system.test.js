const assert=require('assert');
const P=require('../src/systems/production-chain-system.js');
assert.equal(P.canCraft('olive_paste',{olive:8},2).ok,true);
assert.equal(P.canCraft('olive_oil',{olive_paste:2},1).error,'MISSING_INPUTS');
assert.deepEqual(P.getRecipe('olive_oil').inputs,{olive_paste:2,empty_vessel:1});
assert(P.previewQuality({materialQuality:90,expertise:50,stationLevel:3})>P.previewQuality({materialQuality:40,expertise:0,stationLevel:1}));
(async()=>{let seen=null;const out=await P.craft({recipeId:'bread',batches:2,qualityContext:{materialQuality:80,expertise:20,stationLevel:2}},{transact:async c=>(seen=c,{ok:true})});assert.equal(out.ok,true);assert.deepEqual(seen.inputs,{flour:4});assert.deepEqual(seen.outputs,{bread:2});assert.equal(seen.type,'CraftProductionRecipe');console.log('production-chain-system: ok');})().catch(e=>{console.error(e);process.exit(1);});
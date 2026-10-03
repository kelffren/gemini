'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let saves=0;
const context={console,Date,Math,Object,Array,Number,String,JSON,Map,Set,Promise,STATE:{},localPlayer:{id:'local_pioneer',name:'Kelo'},saveState(){saves++;},window:{}};
context.window=context;context.globalThis=context;vm.createContext(context);
for(const file of ['src/systems/equipment-item-catalog.js','src/systems/artisan-profession-system.js','src/systems/player-forging-system.js']){
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const A=context.KeloArtisanProfession,F=context.KeloPlayerForging;
assert(A&&F);
assert.equal(A.getRank().id,'merchant');
let made=F.forge('starter_weapon',{id:'artisan_a',createdAt:1,creator:{id:'local_pioneer',name:'Kelo'},name:'Furia de Kelo',socketCount:2});
assert(made.ok);
let p=A.getProfile();assert.equal(p.crafts,1);assert(p.reputation>=5);
for(let i=0;i<30;i++)A.recordCraft(made.item,{id:'local_pioneer',name:'Kelo'});
p=A.getProfile();assert(p.reputation>=100);assert.notEqual(p.rank.id,'merchant');
let sale=A.recordSale(made.item,25000,{id:'local_pioneer',name:'Kelo'});assert(sale.ok);assert.equal(A.getProfile().sales,1);assert.equal(A.getProfile().salesVolume,25000);
const board=A.getLeaderboard(10);assert.equal(board[0].playerId,'local_pioneer');
const mods=A.getForgeModifiers();assert(mods.qualityBonus>=1);
made=F.forge('starter_bow',{id:'artisan_b',createdAt:2,creator:{id:'local_pioneer',name:'Kelo'},name:'Arco del Artesano',recordProfession:false});
assert(made.ok);assert(made.item.forge.profession);assert(made.item.quality>=2);
assert(saves>0);
console.log('KELO_ARTISAN_PROFESSION_AUDIT=PASS');
console.log(JSON.stringify({ok:true,rank:A.getRank().id,reputation:A.getProfile().reputation,crafts:A.getProfile().crafts,sales:A.getProfile().sales,leaderboard:true,forgeRankBonuses:true},null,2));

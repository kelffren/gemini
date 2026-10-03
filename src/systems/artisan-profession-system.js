/* KELO-INDEX
 * area: ECON / ARTISAN PROFESSION
 * owner: KeloArtisanProfession
 * keys: MERCHANT BLACKSMITH ARTISAN REPUTATION RANKING FORGE SALES
 * purpose: progression layer for player commerce/crafting inspired by classic merchant gameplay without coupling UI or authority.
 * public-api: ensureProfile/recordCraft/recordSale/getRank/getLeaderboard/getForgeModifiers
 * state-owned: STATE.artisanProfession local/offline profile + leaderboard cache
 * online: server must own reputation, sales and leaderboard truth when network authority is active
 */
(function(root){
'use strict';
if(root.KeloArtisanProfession)return;
const VERSION='artisan-profession-v1.0.0';
const SCHEMA=1;
const RANKS=Object.freeze([
 {id:'merchant',name:'Mercader',min:0,socketBonus:0,qualityBonus:0},
 {id:'apprentice_smith',name:'Aprendiz Herrero',min:100,socketBonus:0,qualityBonus:1},
 {id:'blacksmith',name:'Herrero',min:350,socketBonus:1,qualityBonus:1},
 {id:'master_blacksmith',name:'Maestro Herrero',min:900,socketBonus:1,qualityBonus:2},
 {id:'artisan',name:'Artesano',min:2000,socketBonus:2,qualityBonus:2},
 {id:'legendary_crafter',name:'Forjador Legendario',min:5000,socketBonus:2,qualityBonus:3}
]);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
function state(){return typeof STATE!=='undefined'&&STATE&&typeof STATE==='object'?STATE:null;}
function save(){try{if(typeof saveState==='function')saveState();}catch(_){}}
function localIdentity(){
 const id=String(root.keloNet?.playerKey||root.keloNet?.id||'local_pioneer');
 let name='Kelo';try{if(typeof localPlayer!=='undefined'&&localPlayer?.name)name=String(localPlayer.name);}catch(_){}
 return{id,name};
}
function ensureRoot(){
 const s=state();if(!s)return null;
 if(!s.artisanProfession||typeof s.artisanProfession!=='object')s.artisanProfession={schemaVersion:SCHEMA,profiles:{},leaderboard:[]};
 if(!s.artisanProfession.profiles||typeof s.artisanProfession.profiles!=='object')s.artisanProfession.profiles={};
 if(!Array.isArray(s.artisanProfession.leaderboard))s.artisanProfession.leaderboard=[];
 s.artisanProfession.schemaVersion=SCHEMA;return s.artisanProfession;
}
function rankFor(rep){let out=RANKS[0];for(const r of RANKS)if(Number(rep)>=r.min)out=r;return out;}
function ensureProfile(identity){
 const rootState=ensureRoot();if(!rootState)return null;
 const who=identity||localIdentity(),id=String(who.id||'local_pioneer');
 if(!rootState.profiles[id])rootState.profiles[id]={playerId:id,playerName:String(who.name||'Kelo').slice(0,24),reputation:0,crafts:0,sales:0,salesVolume:0,masterworks:0,lastCraftAt:0,lastSaleAt:0};
 const p=rootState.profiles[id];p.playerName=String(who.name||p.playerName||'Kelo').slice(0,24);return p;
}
function reputationForCraft(summary){
 const power=Math.max(0,Number(summary?.forgePower)||0),filled=Math.max(0,Number(summary?.filledSockets)||0);
 return Math.max(5,Math.round(8+power*.35+filled*4));
}
function rebuildLeaderboard(){
 const a=ensureRoot();if(!a)return[];
 a.leaderboard=Object.values(a.profiles).map(p=>({playerId:p.playerId,playerName:p.playerName,reputation:p.reputation,crafts:p.crafts,sales:p.sales,salesVolume:p.salesVolume,masterworks:p.masterworks,rank:rankFor(p.reputation).id}))
 .sort((x,y)=>y.reputation-x.reputation||y.salesVolume-x.salesVolume||y.crafts-x.crafts).slice(0,100);
 return clone(a.leaderboard);
}
function recordCraft(item,identity){
 const p=ensureProfile(identity);if(!p)return{ok:false,error:'STATE_UNAVAILABLE'};
 const summary=root.KeloPlayerForging?.inspect?.(item);if(!summary)return{ok:false,error:'INVALID_FORGED_ITEM'};
 const gain=reputationForCraft(summary);p.crafts++;p.reputation+=gain;p.lastCraftAt=now();if(summary.forgePower>=40)p.masterworks++;
 const board=rebuildLeaderboard();save();return{ok:true,gain,profile:getProfile(p.playerId),leaderboard:board};
}
function recordSale(item,price,identity){
 const p=ensureProfile(identity);if(!p)return{ok:false,error:'STATE_UNAVAILABLE'};
 const amount=Math.max(0,Math.floor(Number(price)||0));p.sales++;p.salesVolume+=amount;p.reputation+=Math.max(2,Math.min(40,Math.round(amount/250)));p.lastSaleAt=now();
 rebuildLeaderboard();save();return{ok:true,profile:getProfile(p.playerId)};
}
function getProfile(playerId){const a=ensureRoot();if(!a)return null;const p=a.profiles[String(playerId||localIdentity().id)];if(!p)return null;return Object.freeze(Object.assign(clone(p),{rank:clone(rankFor(p.reputation))}));}
function getRank(playerId){return getProfile(playerId)?.rank||clone(RANKS[0]);}
function getLeaderboard(limit){return rebuildLeaderboard().slice(0,Math.max(1,Math.min(100,Math.floor(Number(limit)||20))));}
function getForgeModifiers(playerId){
 const r=getRank(playerId);return Object.freeze({rankId:r.id,rankName:r.name,socketBonus:r.socketBonus,qualityBonus:r.qualityBonus});
}
function nextRank(playerId){
 const p=getProfile(playerId)||{reputation:0};const current=rankFor(p.reputation),i=RANKS.findIndex(x=>x.id===current.id),next=RANKS[i+1]||null;
 return next?Object.freeze({id:next.id,name:next.name,required:next.min,remaining:Math.max(0,next.min-p.reputation)}):null;
}
root.KeloArtisanProfession=Object.freeze({version:VERSION,ranks:RANKS,ensureProfile,recordCraft,recordSale,getProfile,getRank,nextRank,getLeaderboard,getForgeModifiers,rebuildLeaderboard});
root.KELO_ARTISAN_PROFESSION_AUDIT=Object.freeze({version:VERSION,merchantPath:true,blacksmithPath:true,reputation:true,ranking:true,salesVolume:true,serverReplaceable:true});
try{ensureProfile();rebuildLeaderboard();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);

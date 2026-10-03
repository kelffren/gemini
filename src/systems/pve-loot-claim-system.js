/* KELO-INDEX
 * area: PVE / LOOT CLAIMS
 * owner: KeloPvELootClaims
 * purpose: idempotent claim command builder; server owns claim ledger and inventory award
 * public-api: claimKey/buildClaim/canClaim
 * state-owned: none
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvELootClaims=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-loot-claims-v1.0.0';
function claimKey(x){return[String(x.encounterId),String(x.actorId),String(x.deathRevision),String(x.claimantId)].join(':');}function canClaim(x){return!!(x&&x.encounterId&&x.actorId&&x.claimantId&&x.deathRevision!=null);}
function buildClaim(x){if(!canClaim(x))return{ok:false,error:'INVALID_LOOT_CLAIM'};return{ok:true,idempotencyKey:claimKey(x),command:{type:'ClaimPvELoot',encounterId:String(x.encounterId),actorId:String(x.actorId),deathRevision:String(x.deathRevision),claimantId:String(x.claimantId),lootTableId:String(x.lootTableId||'')}};}return Object.freeze({version:V,claimKey,buildClaim,canClaim});});
(function(){
'use strict';
const GRANT_ID='swap-sword-inventory-20260907';
const ABILITY_KEY='swap_sword';
if(typeof STATE==='undefined'||!window.KeloStones||typeof window.KeloStones.createAbilityStone!=='function')return;
STATE.inventory=Array.isArray(STATE.inventory)?STATE.inventory:[];
STATE.equipped=Array.isArray(STATE.equipped)?STATE.equipped:[];
STATE.playerGrants=Array.isArray(STATE.playerGrants)?STATE.playerGrants:[];
const alreadyOwns=STATE.inventory.concat(STATE.equipped).some(function(item){return item&&(item.abilityKey===ABILITY_KEY||item.typeId===ABILITY_KEY);});
const alreadyGranted=STATE.playerGrants.indexOf(GRANT_ID)>=0;
let granted=false;
if(!alreadyOwns&&!alreadyGranted){
  STATE.inventory.push(window.KeloStones.createAbilityStone(ABILITY_KEY,'Common',{source:'kelo-player-grant',bound:false}));
  STATE.playerGrants.push(GRANT_ID);
  granted=true;
  if(typeof saveState==='function')saveState();
}
window.KELO_PLAYER_GRANT_AUDIT=Object.freeze({grantId:GRANT_ID,abilityKey:ABILITY_KEY,granted:granted,alreadyOwns:alreadyOwns,alreadyGranted:alreadyGranted});
})();

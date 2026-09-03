(function(){
'use strict';
const VERSION='equipment-v1.0';
const SLOTS=['weapon','helmet','chest','gloves','boots','accessory','necklace','ring','belt'];
const CORE_SLOTS=['weapon','helmet','chest','gloves','boots','accessory'];
const QUALITY_NAMES={1:'Normal',2:'Common',3:'Enhanced',4:'Delicate',5:'Good',6:'Superior',7:'Classic',8:'Eternal',9:'Epic'};
const QUALITY_MULTIPLIER={1:1,2:1.05,3:1.10,4:1.17,5:1.25,6:1.35,7:1.47,8:1.62,9:1.80};
const GRADE_ARMOR_POINTS={1:0,2:20,3:40,4:70,5:110,6:170,7:260,8:400,9:650};
const GRADE_SPECIAL_MULTIPLIER={1:1,2:1.05,3:1.10,4:1.17,5:1.25,6:1.35,7:1.50,8:1.70,9:2};
const AURA_THRESHOLDS=[0,330,475,750,950,1350,1720,2225,3860,5250];
const SLOT_LABELS={weapon:'Arma',helmet:'Casco',chest:'Pecho',gloves:'Guantes',boots:'Botas',accessory:'Accesorio',necklace:'Collar',ring:'Anillo',belt:'Cinturón'};
function clampTier(v){v=Math.floor(Number(v)||1);return Math.max(1,Math.min(9,v));}
function uid(slot){return 'eq_'+slot;}
function template(slot){
 const bases={weapon:{attack:12,defense:0,hp:0},helmet:{attack:0,defense:5,hp:20},chest:{attack:0,defense:10,hp:45},gloves:{attack:4,defense:3,hp:0},boots:{attack:0,defense:4,hp:15},accessory:{attack:3,defense:2,hp:10},necklace:{attack:4,defense:1,hp:15},ring:{attack:5,defense:0,hp:5},belt:{attack:0,defense:4,hp:25}};
 const specials={attackPct:slot==='weapon'||slot==='ring'?2:0,defensePct:['helmet','chest','boots','belt'].includes(slot)?2:0,hpPct:['chest','accessory','necklace'].includes(slot)?2:0};
 return {id:uid(slot),templateId:'starter_'+slot,name:'Equipo '+SLOT_LABELS[slot],slot,itemLevel:1,quality:1,grade:1,baseStats:bases[slot],specialStats:specials,bound:false,createdAt:Date.now(),kind:'equipment'};
}
function ensure(){
 if(typeof STATE==='undefined')return null;
 if(!Array.isArray(STATE.inventory))STATE.inventory=[];
 if(!STATE.equipmentSlots||typeof STATE.equipmentSlots!=='object')STATE.equipmentSlots={};
 SLOTS.forEach(function(slot){
  let item=STATE.inventory.find(function(x){return x&&x.kind==='equipment'&&x.id===uid(slot)});
  if(!item){item=template(slot);STATE.inventory.push(item);}
  item.slot=slot;item.quality=clampTier(item.quality);item.grade=clampTier(item.grade);item.itemLevel=Math.max(1,Math.floor(Number(item.itemLevel)||1));
  if(!STATE.equipmentSlots[slot])STATE.equipmentSlots[slot]=item.id;
 });
 if(typeof localPlayer!=='undefined')recalculate(localPlayer);
 return STATE;
}
function allEquipment(){ensure();return STATE.inventory.filter(function(x){return x&&x.kind==='equipment';});}
function find(id){return allEquipment().find(function(x){return x.id===id;})||null;}
function equippedItems(){ensure();const out=[];SLOTS.forEach(function(slot){const id=STATE.equipmentSlots[slot],item=find(id);if(item&&item.slot===slot)out.push(item);});return out;}
function getArmorScore(player){if(player&&player!==localPlayer&&Number.isFinite(player.armorScore))return Math.max(0,Math.floor(player.armorScore));return equippedItems().reduce(function(sum,item){return sum+(GRADE_ARMOR_POINTS[clampTier(item.grade)]||0);},0);}
function getAuraRank(score){score=Math.max(0,Math.floor(Number(score)||0));let rank=0;for(let i=1;i<AURA_THRESHOLDS.length;i++)if(score>=AURA_THRESHOLDS[i])rank=i;return rank;}
function avg(key,player){if(player&&player!==localPlayer&&Number.isFinite(player[key]))return Number(player[key]);const items=equippedItems();if(!items.length)return 0;return items.reduce(function(s,x){return s+clampTier(x[key==='averageQuality'?'quality':'grade']);},0)/items.length;}
function getAverageQuality(player){return avg('averageQuality',player);}
function getAverageGrade(player){return avg('averageGrade',player);}
function qualityName(v){return QUALITY_NAMES[clampTier(v)]||QUALITY_NAMES[1];}
function finalStats(item){if(!item)return null;const q=QUALITY_MULTIPLIER[clampTier(item.quality)],g=GRADE_SPECIAL_MULTIPLIER[clampTier(item.grade)];const b=item.baseStats||{},s=item.specialStats||{};return {attack:Math.floor((Number(b.attack)||0)*q),defense:Math.floor((Number(b.defense)||0)*q),hp:Math.floor((Number(b.hp)||0)*q),attackPct:+((Number(s.attackPct)||0)*g).toFixed(2),defensePct:+((Number(s.defensePct)||0)*g).toFixed(2),hpPct:+((Number(s.hpPct)||0)*g).toFixed(2)};}
function recalculate(player){if(!player)return;const items=equippedItems();const totals={attack:0,defense:0,hp:0,attackPct:0,defensePct:0,hpPct:0};items.forEach(function(item){const s=finalStats(item);Object.keys(totals).forEach(function(k){totals[k]+=Number(s[k])||0;});});player.equipmentStats=totals;player.armorScore=getArmorScore();player.auraRank=getAuraRank(player.armorScore);player.averageQuality=getAverageQuality();player.averageGrade=getAverageGrade();player.equipmentSummary=items.map(function(x){return {slot:x.slot,itemLevel:x.itemLevel,quality:x.quality,grade:x.grade};});if(window.KeloNetAuthority&&typeof window.KeloNetAuthority.syncEquipment==='function')window.KeloNetAuthority.syncEquipment(player.equipmentSummary).catch(function(){});}
function equipItem(itemId){ensure();const item=find(itemId);if(!item)return {ok:false,error:'ITEM_NOT_FOUND'};if(!SLOTS.includes(item.slot))return {ok:false,error:'INVALID_SLOT'};Object.keys(STATE.equipmentSlots).forEach(function(slot){if(STATE.equipmentSlots[slot]===itemId)delete STATE.equipmentSlots[slot];});STATE.equipmentSlots[item.slot]=itemId;recalculate(localPlayer);if(typeof saveState==='function')saveState();return {ok:true,item,armorScore:localPlayer.armorScore,auraRank:localPlayer.auraRank};}
function unequipItem(slot){ensure();if(!SLOTS.includes(slot))return {ok:false,error:'INVALID_SLOT'};const id=STATE.equipmentSlots[slot]||null;delete STATE.equipmentSlots[slot];recalculate(localPlayer);if(typeof saveState==='function')saveState();return {ok:true,itemId:id};}
function nextAura(score){const rank=getAuraRank(score);return rank>=9?null:{rank:rank+1,threshold:AURA_THRESHOLDS[rank+1]};}
function applyServerItem(serverItem){ensure();if(!serverItem||!serverItem.id)return null;const item=find(serverItem.id);if(!item)return null;['itemLevel','quality','grade'].forEach(function(k){if(Number.isFinite(Number(serverItem[k])))item[k]=k==='itemLevel'?Math.max(1,Math.floor(Number(serverItem[k]))):clampTier(serverItem[k]);});recalculate(localPlayer);if(typeof saveState==='function')saveState();return item;}
ensure();
window.KeloEquipment=Object.freeze({version:VERSION,SLOTS:SLotsSafe(),CORE_SLOTS:CORE_SLOTS.slice(),QUALITY_NAMES:{...QUALITY_NAMES},QUALITY_MULTIPLIER:{...QUALITY_MULTIPLIER},GRADE_ARMOR_POINTS:{...GRADE_ARMOR_POINTS},GRADE_SPECIAL_MULTIPLIER:{...GRADE_SPECIAL_MULTIPLIER},AURA_THRESHOLDS:AURA_THRESHOLDS.slice(),getEquipment:allEquipment,getEquipped:equippedItems,equipItem,unequipItem,getArmorScore,getAverageQuality,getAverageGrade,getAuraRank,qualityName,finalStats,recalculate,nextAura,applyServerItem,getItem:find});
function SLotsSafe(){return SLOTS.slice();}
window.KELO_EQUIPMENT_AUDIT={version:VERSION,ready:true,minSlots:6,slotCount:SLOTS.length,maxQuality:9,maxGrade:9,maxAura:9,maxReachableArmorScore:SLOTS.length*GRADE_ARMOR_POINTS[9]};
})();
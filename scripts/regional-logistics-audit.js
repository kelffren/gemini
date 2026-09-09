#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / REGIONAL LOGISTICS
 * owner: Regional Logistics CI
 * keys: AUDIT ECONOMY LOGISTICS CARAVAN FACTION CONTAINER COMBAT
 * purpose: valida la integración real entre economía regional, contenedores, carretas, facciones y combate
 * public-api: npm run audit:logistics
 * consumes: KeloRegionalEconomyMath, KeloContainers, KeloRegionalEconomy, KeloFactions, KeloCaravans, KeloCombatEngine
 * state-owned: none
 * do-not: no depender de navegador ni de red
 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');

function load(sandbox,file){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  new vm.Script(source,{filename:file}).runInContext(sandbox);
}
function makeSandbox(extra){
  const listeners=new Map(),movementHooks=[],renderHooks=[];
  const s={
    console,Date,Math,JSON,Map,Set,Object,Array,Number,String,Boolean,Promise,Infinity,NaN,parseInt,parseFloat,isFinite,setTimeout,clearTimeout,
    performance:{now:()=>Date.now()},
    STATE:{gold:100000,kc:0,inventory:[],equipped:[]},
    localPlayer:{id:'local_pioneer',name:'Audit',x:100,y:100,vx:0,vy:0,hp:100,maxHp:100,radius:20},
    simulatedPlayers:[],input:{normX:0,normY:0},saveCount:0,
    KeloEquipment:{isEquipped(){return false;}},
    KeloEvents:{
      on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name).delete(fn);},
      emit(name,payload){for(const fn of listeners.get(name)||[])fn(payload);}
    },
    KeloMovement:{after(owner,fn){movementHooks.push({owner,fn});return owner;}},
    KeloRender:{afterFrame(owner,fn){renderHooks.push({owner,fn});return owner;}},
    KeloCamera:{worldToScreen(x,y){return{x,y};},getEffectiveZoom(){return 1;}},
    ctx:{save(){},restore(){},translate(){},scale(){},fillRect(){},strokeRect(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}},
    innerWidth:390,innerHeight:844
  };
  s.saveState=()=>{s.saveCount++;};
  s.KeloBackpack={ensure(){if(!s.STATE.backpack)s.STATE.backpack={capacity:20,slots:new Array(20).fill(null)};}};
  Object.assign(s,extra||{});
  s.window=s;s.globalThis=s;
  return vm.createContext(s);
}
function approx(a,b,tol,msg){assert(Math.abs(a-b)<=tol,(msg||'values differ')+`: ${a} vs ${b}`);}

async function main(){
  const s=makeSandbox();
  load(s,'src/systems/regional-economy-math.js');
  load(s,'src/systems/container-system.js');
  load(s,'src/systems/regional-economy-system.js');
  load(s,'src/systems/faction-clan-system.js');
  load(s,'src/systems/caravan-system.js');

  const E=s.KeloRegionalEconomy,C=s.KeloContainers,F=s.KeloFactions,V=s.KeloCaravans,M=s.KeloRegionalEconomyMath;
  assert(E&&C&&F&&V&&M,'regional logistics owners must load');
  assert.strictEqual(typeof C.registerContainer,'function','KeloContainers must expose dynamic container registration');
  assert.strictEqual(typeof C.removeContainer,'function','KeloContainers must expose dynamic container removal');
  assert.strictEqual(typeof C.extractItem,'function','KeloContainers must expose extraction');

  const easy={travelTime:15,pvpExposure:.1,terrainDanger:.1,chokePointRisk:.1,npcThreat:.1,eventRisk:.1};
  const danger={travelTime:15,pvpExposure:.9,terrainDanger:.8,chokePointRisk:.8,npcThreat:.9,eventRisk:.8};
  assert(M.riskBreakdown(danger).score>M.riskBreakdown(easy).score,'danger must raise route risk');
  assert(M.economicEdgeCost(danger)>M.economicEdgeCost(easy),'risk must raise economic distance');
  assert(M.propagatedDemand(30,M.economicEdgeCost(danger),30)<M.propagatedDemand(30,M.economicEdgeCost(easy),30),'risk must attenuate propagated demand');
  const pathResult=M.shortestEconomicPath([{from:'A',to:'B',travelTime:10,pvpExposure:.05},{from:'A',to:'C',travelTime:4,pvpExposure:1},{from:'C',to:'B',travelTime:40,pvpExposure:.1}],'A','B',{riskMultiplier:3});
  assert.deepStrictEqual(Array.from(pathResult.path),['A','B'],'economic routing must not reward deliberate detours');

  E.dev.setStock('ignis','coal',.50,'T1');
  const coalBefore=E.quote('ignis','coal','T1',{skipRefresh:true}).stock;
  const prod=E.dev.advanceHours('ignis',1);
  assert(prod.ok&&prod.produced.coal>499,'lazy production must add specialist output');
  approx(E.quote('ignis','coal','T1',{skipRefresh:true}).stock-coalBefore,500,1.5,'coal production');
  assert(E.productionProfile('ignis','coal').hourlyRate>E.productionProfile('verdantia','coal').hourlyRate,'specialization must be data-driven');

  E.dev.setStock('verdantia','stone',.90,'T1');
  const abundant=E.quote('verdantia','stone','T1',{skipRefresh:true});
  E.dev.setStock('verdantia','stone',.30,'T1');
  const scarce=E.quote('verdantia','stone','T1',{skipRefresh:true});
  assert(scarce.unitPrice>abundant.unitPrice,'scarcity must raise price');
  assert(Number.isFinite(scarce.breakdown.base)&&Number.isFinite(scarce.breakdown.scarcity)&&Number.isFinite(scarce.breakdown.regionalDemand),'quote must expose explainable breakdown');

  E.dev.setStock('verdantia','apple',.70,'T1');
  const stockBeforeBuy=E.quote('verdantia','apple','T1',{skipRefresh:true}).stock;
  const buy=await E.request('BuyResource',{settlementId:'verdantia',resourceId:'apple',tier:'T1',quantity:10});
  assert(buy.ok,'buy resource must succeed');
  const stockAfterBuy=E.quote('verdantia','apple','T1',{skipRefresh:true}).stock;
  approx(stockBeforeBuy-stockAfterBuy,10,.01,'buy stock delta');
  let appleSlot=C.getSlots('backpack').find(x=>x.item&&x.item.resourceId==='apple');
  assert(appleSlot,'bought resource must enter Backpack through KeloContainers');
  const appleBeforeSell=Math.max(1,Number(appleSlot.item.quantity)||1);
  const sell=await E.request('SellResource',{settlementId:'verdantia',itemKey:appleSlot.key,quantity:5});
  assert(sell.ok,'sell resource must succeed');
  approx(E.quote('verdantia','apple','T1',{skipRefresh:true}).stock-stockAfterBuy,5,.01,'sell stock delta');
  if(appleBeforeSell>5){appleSlot=C.getSlots('backpack').find(x=>x.item&&x.item.resourceId==='apple');assert(appleSlot&&Number(appleSlot.item.quantity)===appleBeforeSell-5,'partial extraction must preserve the remaining stack');}

  const emergency=E.dev.setStock('ignis','apple',.08,'T1');
  assert(emergency.contract&&emergency.contract.status==='ACTIVE','emergency reserve must create supply contract');
  const contractId=emergency.contract.id,rewardBefore=emergency.contract.currentReward,stockBeforeDelivery=E.quote('ignis','apple','T1',{skipRefresh:true}).stock;
  const received=C.receiveItem('backpack',{id:'audit_supply_apples',templateId:'resource_apple',kind:'resource',resourceId:'apple',tier:'T1',quantity:100,maxStack:200,weight:.35},{persist:false,preserveIdentity:true});
  assert(received.ok,'supply fixture must enter Backpack');
  const delivery=await E.request('DeliverSupplyContract',{contractId,itemKey:received.itemKey,quantity:100});
  assert(delivery.ok,'contract delivery must succeed');
  assert(delivery.stock>stockBeforeDelivery,'delivery must increase real reserve');
  assert(delivery.contract.currentReward<rewardBefore,'contract reward must decline as shortage recovers');
  E.dev.setStock('ignis','apple',.50,'T1');
  assert.strictEqual(E.getContract(contractId).status,'COMPLETED','recovered reserve must close contract');

  const emergency2=E.dev.setStock('ignis','apple',.08,'T1').contract;
  E.dev.setStock('verdantia','apple',.70,'T1');E.dev.setStock('ferrum','apple',.70,'T1');
  const easyDistance=E.getEconomicDistance('verdantia','ignis'),dangerDistance=E.getEconomicDistance('ferrum','ignis');
  assert(dangerDistance.distance>easyDistance.distance,'dangerous origin must be economically farther');
  const easyQuote=E.quote('verdantia','apple','T1',{skipRefresh:true}),dangerQuote=E.quote('ferrum','apple','T1',{skipRefresh:true});
  assert(easyQuote.breakdown.regionalDemand>dangerQuote.breakdown.regionalDemand,'easy market must receive more demand pressure');
  assert(emergency2.currentReward-dangerQuote.unitPrice>emergency2.currentReward-easyQuote.unitPrice,'danger must create margin via distance, not a direct bonus');
  const riskBefore=E.getRouteRisk('route_ignis_verdantia').score;
  const raid=await E.request('ActivateRaiderBand',{routeId:'route_ignis_verdantia',ambushNodeId:'forest_iv',npcThreat:.20,eventRisk:.40});
  assert(raid.ok&&raid.risk.score>riskBefore,'RaiderBand must raise route risk');
  await E.request('EndWorldEvent',{eventId:raid.event.id});
  approx(E.getRouteRisk('route_ignis_verdantia').score,riskBefore,.000001,'route risk restore');

  const resourceSlot=C.getSlots('backpack').find(x=>x.item&&x.item.kind==='resource');
  assert(resourceSlot,'resource fixture required for cart');
  const attach=await V.request('AttachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'});
  assert(attach.ok&&attach.cart.state==='ATTACHED','cart must attach');
  assert.strictEqual(V.canActorAttack('local_pioneer'),false,'attached cart carrier cannot attack');
  assert.strictEqual((await V.request('BeginClaimCart',{cartId:'cart_demo_1',actorId:'enemy'})).error,'CART_ATTACHED_PROTECTED','attached cart cannot be stolen directly');
  const loaded=await V.request('LoadCart',{cartId:'cart_demo_1',actorId:'local_pioneer',itemKey:resourceSlot.key,quantity:1});
  assert(loaded.ok&&V.cartWeight('cart_demo_1')>0,'cart cargo must use KeloContainers');
  assert.strictEqual(V.inspectCart('cart_demo_1','enemy').cargo,'UNKNOWN','unauthorized cargo must remain hidden');
  assert(V.inspectCart('cart_demo_1','local_pioneer').cargoVisible,'authorized owner can inspect cargo');
  const drop=await V.request('DetachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'});
  assert(drop.ok&&drop.cart.state==='DROPPED','detach must drop cart');
  const claim=await V.request('BeginClaimCart',{cartId:'cart_demo_1',actorId:'enemy'});
  assert(claim.ok&&claim.cart.state==='CLAIMING','dropped cart must be claimable');
  const stolen=V.dev.finishClaim('cart_demo_1','enemy');
  assert(stolen.ok&&stolen.cart.currentControllerId==='enemy','claim must transfer controller');
  assert.strictEqual(stolen.cart.owner.id,'local_pioneer','claim must preserve owner identity');

  const joinFaction=await F.request('JoinFaction',{playerId:'local_pioneer',factionId:'solari'});
  assert(joinFaction.ok,'player must join faction');
  const clan=await F.request('CreateClan',{playerId:'local_pioneer',name:'Audit Clan',tag:'AUD'});
  assert(clan.ok&&clan.clan.factionId==='solari','clan must bind to faction');
  assert(F.hasPermission(clan.clan.id,'local_pioneer','MANAGE_CARAVANS'),'leader permissions must be data-driven');

  await V.request('AttachCart',{cartId:'cart_demo_1',actorId:'local_pioneer'});
  s.KeloCombatSchema={events:{ATTACK_STARTED:'a',ATTACK_RESOLVED:'b',HIT_CONFIRMED:'c',DAMAGE_APPLIED:'combat:damage_applied',ENTITY_KILLED:'combat:entity_killed'}};
  s.KeloHitResolver={withinRange(){return{hit:true,distance:1,range:10};}};
  s.KeloDamageResolver={apply(target,amount){target.hp-=amount;return{amount,requested:amount,absorbed:0,hp:target.hp,killed:target.hp<=0};}};
  load(s,'src/systems/combat/combat-engine.js');
  const target={id:'enemy_target',x:101,y:100,hp:100};
  const blocked=s.KeloCombatEngine.attack({attacker:s.localPlayer,target,profile:{range:10,damage:10,cooldown:1}});
  assert.strictEqual(blocked.reason,'ACTION_BLOCKED_BY_CART','combat owner must reject attached carrier attacks');
  s.KeloEvents.emit('combat:damage_applied',{targetActorId:'local_pioneer',target:s.localPlayer,amount:5});
  assert.strictEqual(V.getCart('cart_demo_1').state,'ATTACHED','damage must not detach carrier');
  s.KeloEvents.emit('combat:entity_killed',{targetActorId:'local_pioneer',target:s.localPlayer});
  assert.strictEqual(V.getCart('cart_demo_1').state,'DROPPED','carrier death must abandon cart');

  const persisted=JSON.parse(JSON.stringify(s.STATE));s.STATE=persisted;
  assert(V.getCart('cart_demo_1')&&C.getContainer('cart_inv_cart_demo_1'),'cart and dynamic cargo container must survive serialization');
  const identityAudit=C.auditIdentities();
  assert(identityAudit.ok,'item identities must remain unique across all containers');

  console.log(JSON.stringify({ok:true,version:E.version,checks:{production:true,scarcity:true,stockTransactions:true,partialExtract:true,contracts:true,riskMargin:true,raiders:true,carts:true,hiddenCargo:true,factions:true,clans:true,persistence:true,combatCartLock:true,identity:true},easyDistance:easyDistance.distance,dangerDistance:dangerDistance.distance,riskBefore,raiderRisk:raid.risk.score},null,2));
}
main().catch(err=>{console.error(err&&err.stack||err);process.exit(1);});

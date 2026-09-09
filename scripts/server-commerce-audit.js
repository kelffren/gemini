'use strict';
const assert=require('assert');
const {createPlayerEconomyStore}=require('../server/player-economy-store');
const {createForgeService}=require('../server/forge-store');
const {createCommerceService}=require('../server/commerce-store');

(async()=>{
  const economy=createPlayerEconomyStore({});
  const names={alice:'Alice',bob:'Bob'};
  const commerce=createCommerceService({economyStore:economy,resolvePlayerName:id=>names[id]||id});
  const forge=createForgeService({economyStore:economy});
  const alice=economy.ensure('alice'),bob=economy.ensure('bob');
  alice.gold=2000;bob.gold=1500;
  commerce.seedItems('alice',[
    {id:'a_sword',templateId:'iron_sword',name:'Espada',quantity:1,maxStack:1},
    {id:'a_ore',templateId:'ore',name:'Mineral',quantity:5,maxStack:20}
  ]);
  commerce.seedItems('bob',[
    {id:'b_gem',templateId:'gem',name:'Gema',quantity:1,maxStack:1},
    {id:'b_potion',templateId:'potion',name:'Poción',quantity:3,maxStack:20}
  ]);

  // One economy truth: Forge spends the exact gold Commerce sees.
  alice.inventory.sapphire_1=5;
  const beforeForge=commerce.snapshot('alice').player.gold;
  const forgeResult=await forge.attempt('alice',{itemId:'eq_weapon',forgeType:'quality',materialLevel:1,crystals:[]});
  assert.strictEqual(forgeResult.gold,beforeForge-500);
  assert.strictEqual(commerce.snapshot('alice').player.gold,forgeResult.gold);

  let r=await commerce.handle('alice','stall:claim',{stallId:'stall_01',message:'Armas'},'claim-a');
  assert.strictEqual(r.ok,true);
  r=await commerce.handle('alice','market:create',{instanceId:'a_sword',quantity:1,price:250,metadata:{stallId:'stall_01'}},'list-a');
  assert.strictEqual(r.ok,true);const listingId=r.listingId;
  assert.strictEqual(economy.ensure('alice').items.find(x=>x.id==='a_sword').container,'market_escrow');
  const aliceGoldBefore=economy.ensure('alice').gold,bobGoldBefore=economy.ensure('bob').gold;
  r=await commerce.handle('bob','market:buy',{listingId},'buy-once');
  assert.strictEqual(r.ok,true);assert.strictEqual(economy.ensure('bob').gold,bobGoldBefore-250);assert.strictEqual(economy.ensure('alice').gold,aliceGoldBefore+250);
  assert(economy.ensure('bob').items.some(x=>x.id==='a_sword'&&x.ownerId==='bob'&&x.container==='backpack'));
  const duplicate=await commerce.handle('bob','market:buy',{listingId},'buy-once');
  assert.strictEqual(duplicate.ok,true);assert.strictEqual(duplicate.transactionId,r.transactionId,'same requestId must be idempotent');
  assert.strictEqual(economy.ensure('bob').gold,bobGoldBefore-250,'duplicate request must not debit twice');
  const secondBuyerAttempt=await commerce.handle('alice','market:buy',{listingId},'buy-after-sold');
  assert.strictEqual(secondBuyerAttempt.ok,false);assert.strictEqual(secondBuyerAttempt.error,'LISTING_NOT_FOUND');

  // Bilateral trade: item + gold, mutation reset, two final accepts.
  r=await commerce.handle('alice','trade:create',{peerId:'bob',peerName:'Bob'},'trade-create');
  assert.strictEqual(r.ok,true);const tradeId=r.trade.tradeId;
  r=await commerce.handle('alice','trade:addItem',{instanceId:'a_ore',quantity:2},'trade-a-item');assert.strictEqual(r.ok,true);
  r=await commerce.handle('bob','trade:addItem',{instanceId:'b_gem',quantity:1},'trade-b-item');assert.strictEqual(r.ok,true);
  await commerce.handle('alice','trade:setGold',{gold:10},'trade-a-gold-10');
  await commerce.handle('bob','trade:setGold',{gold:20},'trade-b-gold-20');
  await commerce.handle('alice','trade:ready',{ready:true},'trade-a-ready-1');
  await commerce.handle('bob','trade:ready',{ready:true},'trade-b-ready-1');
  assert.strictEqual(commerce.snapshot('alice').activeTrade.status,'FINAL_REVIEW');
  await commerce.handle('alice','trade:setGold',{gold:11},'trade-a-gold-11');
  let ta=commerce.snapshot('alice').activeTrade;
  assert.strictEqual(ta.offers.local.ready,false);assert.strictEqual(ta.offers.peer.ready,false);assert.strictEqual(ta.offers.local.finalAccepted,false);assert.strictEqual(ta.offers.peer.finalAccepted,false);
  await commerce.handle('alice','trade:ready',{ready:true},'trade-a-ready-2');
  await commerce.handle('bob','trade:ready',{ready:true},'trade-b-ready-2');
  r=await commerce.handle('alice','trade:finalAccept',{accept:true},'trade-a-final');
  assert.strictEqual(r.ok,true);assert(commerce.snapshot('alice').activeTrade,'one final accept must not commit');
  const aGold=economy.ensure('alice').gold,bGold=economy.ensure('bob').gold;
  r=await commerce.handle('bob','trade:finalAccept',{accept:true},'trade-b-final');
  assert.strictEqual(r.ok,true);assert.strictEqual(r.status,'COMPLETED');assert.strictEqual(r.tradeId,tradeId);
  assert.strictEqual(commerce.snapshot('alice').activeTrade,null);assert.strictEqual(commerce.snapshot('bob').activeTrade,null);
  assert.strictEqual(economy.ensure('alice').gold,aGold-11+20);assert.strictEqual(economy.ensure('bob').gold,bGold-20+11);
  assert(economy.ensure('alice').items.some(x=>x.id==='b_gem'&&x.ownerId==='alice'&&x.container==='backpack'));
  assert(economy.ensure('bob').items.some(x=>x.templateId==='ore'&&x.ownerId==='bob'&&x.quantity===2&&x.container==='backpack'));
  assert(!Object.keys(economy.ensure('alice').reservations).length);assert(!Object.keys(economy.ensure('bob').reservations).length);
  assert(economy.ensure('alice').items.some(x=>x.id==='a_ore'&&x.quantity===3),'partial stack source must remain');
  assert.strictEqual(economy.auditPlayer('alice').ok,true);assert.strictEqual(economy.auditPlayer('bob').ok,true);assert.strictEqual(commerce.audit().ok,true);
  assert(commerce.snapshot('alice').transactionHistory.some(x=>x.type==='player_trade'&&x.status==='committed'));

  // Cancel/disconnect releases escrow and stall ownership.
  await commerce.handle('bob','stall:claim',{stallId:'stall_03'},'claim-b');
  await commerce.handle('alice','trade:create',{peerId:'bob'},'trade-cancel-create');
  const swordBack=economy.ensure('bob').items.find(x=>x.id==='a_sword');
  await commerce.handle('bob','trade:addItem',{instanceId:swordBack.id,quantity:1},'trade-cancel-item');
  assert.strictEqual(swordBack.container,'trade_escrow');
  const disc=commerce.disconnect('bob');assert.strictEqual(disc.status,'CANCELLED');assert.strictEqual(swordBack.container,'backpack');assert.strictEqual(disc.releasedStall,'stall_03');

  console.log('PASS server-commerce-audit',JSON.stringify({commerce:commerce.version,economy:economy.version,forgeSharedGold:true,idempotentPurchase:true,doubleConfirmation:true,tradeRollbackBoundary:true,aliceGold:economy.ensure('alice').gold,bobGold:economy.ensure('bob').gold}));
})().catch(err=>{console.error(err);process.exit(1);});

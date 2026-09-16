/* KELO-INDEX
 * area: ECON / HOT MARKET BALANCE
 * owner: KeloEquipmentMarketHotBalance
 * keys: EQUIPMENT MARKET PRICE HOT DATA TRANSACTION ROLLBACK LIVEOPS
 * purpose: hot-update armory catalog prices for future/offline commerce without mutating inventory, gold, player listings or server authority
 * public-api: KeloEquipmentMarketHotBalance.getState/getConfig/getPrice/applyRuntime
 * state-owned: one immutable pricing pointer + event subscriptions; NO timer/polling/game loop/storage
 * do-not: NO stat changes, NO inventory mutation, NO gold mutation, NO server snapshot mutation, NO player listing repricing
 */
(function(root){
'use strict';
if(root.KeloEquipmentMarketHotBalance)return;
const VERSION='kelo-equipment-market-hot-v1';
const PATH='src/systems/equipment-market-balance.json';
const TEMPLATE_IDS=Object.freeze(['starter_weapon','arcane_staff','starter_bow','starter_daggers','starter_hammer','frost_staff']);
const TEMPLATE_SET=new Set(TEMPLATE_IDS);
const prepared=new WeakMap();
let active=deepFreeze({schemaVersion:1,globalMultiplier:1,templates:{}}),epoch=0,applies=0,rollbacks=0,lastError=null,lastSource='bootstrap-default',mutationSeq=0,baseCatalog=null,wrappedCatalog=null,fixturePatches=0,binds=0;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.keys(value).forEach(k=>deepFreeze(value[k]));return Object.freeze(value);}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:equipment-market-balance:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function worldState(){try{if(root.STATE&&typeof root.STATE==='object')return root.STATE;if(typeof STATE!=='undefined'&&STATE&&typeof STATE==='object')return STATE;}catch(_){}return null;}
function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('equipment_market_object_required');
  if(Number(raw.schemaVersion)!==1)throw new Error('equipment_market_schema_unsupported');
  const multiplier=Number(raw.globalMultiplier);if(!Number.isFinite(multiplier)||multiplier<0.1||multiplier>10)throw new Error('equipment_market_multiplier_out_of_range');
  const src=raw.templates;if(!src||typeof src!=='object'||Array.isArray(src))throw new Error('equipment_market_templates_object_required');
  const templates={};
  for(const id of Object.keys(src)){
    if(!TEMPLATE_SET.has(id))throw new Error('equipment_market_unknown_template:'+id);
    const row=src[id];if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('equipment_market_template_object_required:'+id);
    const keys=Object.keys(row);if(keys.some(k=>k!=='price'))throw new Error('equipment_market_unknown_field:'+id);
    const price=Number(row.price);if(!Number.isInteger(price)||price<1||price>1000000)throw new Error('equipment_market_price_out_of_range:'+id);
    templates[id]=Object.freeze({price});
  }
  return deepFreeze({schemaVersion:1,globalMultiplier:Number(multiplier.toFixed(4)),templates});
}
function getPrice(templateId,basePrice){const id=String(templateId||''),row=active.templates[id],base=row?row.price:Number(basePrice);if(!Number.isFinite(base)||base<1)return null;return Math.max(1,Math.min(1000000,Math.round(base*active.globalMultiplier)));}
function hotTemplate(def){if(!def)return null;const out=clone(def),price=getPrice(def.templateId,def.marketPrice);if(price!=null)out.marketPrice=price;return deepFreeze(out);}
function hotOffer(offer){if(!offer)return null;const out=clone(offer),base=baseCatalog?.get?.(offer.templateId);const price=getPrice(offer.templateId,base?.marketPrice||offer.price);if(price!=null)out.price=price;return deepFreeze(out);}
function makeWrapper(base){
  const api={
    version:String(base.version||1)+'+hot-market-v1',__hotMarketWrapped:true,__baseCatalog:base,
    get templates(){return Object.freeze((base.list?.()||base.templates||[]).map(hotTemplate));},
    get marketOffers(){return Object.freeze((base.marketOffers||[]).map(hotOffer));},
    get(templateId){return hotTemplate(base.get?.(templateId));},
    list(){return (base.list?.()||[]).map(hotTemplate);},
    listByFamily(family){return (base.listByFamily?.(family)||[]).map(hotTemplate);},
    createItem(templateId,overrides){const item=base.createItem?.(templateId,overrides);if(!item)return null;const price=getPrice(templateId,item.marketPrice);if(price!=null)item.marketPrice=price;return item;},
    validateTemplate(def,abilityData){return base.validateTemplate?.(def,abilityData)||{ok:true};}
  };
  return Object.freeze(api);
}
function bindCatalog(){
  const current=root.KELO_EQUIPMENT_ITEM_CATALOG;if(!current)return false;
  if(current.__hotMarketWrapped===true){wrappedCatalog=current;baseCatalog=current.__baseCatalog||baseCatalog;return true;}
  baseCatalog=current;wrappedCatalog=makeWrapper(current);root.KELO_EQUIPMENT_ITEM_CATALOG=wrappedCatalog;binds++;return true;
}
function patchOfflineFixtures(){
  const state=worldState();if(!wrappedCatalog||!state?.commerce||!Array.isArray(state.commerce.demoListings))return 0;
  const prices=new Map((wrappedCatalog.marketOffers||[]).map(o=>['demo_listing_'+o.offerId,o.price]));let changed=0;
  for(const listing of state.commerce.demoListings){if(!listing||listing.demo!==true||listing.ownerId!=='offline_vendor_ron')continue;const price=prices.get(String(listing.listingId||''));if(!Number.isFinite(price)||listing.price===price)continue;listing.price=price;changed++;}
  fixturePatches+=changed;return changed;
}
function applyRuntime(reason){try{const ready=bindCatalog(),patched=ready?patchOfflineFixtures():0;emit('runtime-refresh',{reason:String(reason||'manual'),ready,patched});return ready;}catch(error){lastError=String(error&&error.message||error);emit('runtime-error',{error:lastError});return false;}}
function setActive(next,source){active=next;epoch++;lastSource=String(source||'unknown');lastError=null;applyRuntime(lastSource);emit('changed',{source:lastSource});}
function validate(raw){try{const normalized=normalize(raw);prepared.set(raw,normalized);return true;}catch(error){lastError=String(error&&error.message||error);throw error;}}
function snapshot(){return active;}
function apply(raw,context){const next=prepared.get(raw)||normalize(raw);mutationSeq++;applies++;setActive(next,'hot:'+String(context&&context.build||'unknown'));return true;}
function rollback(previous,context){mutationSeq++;rollbacks++;setActive(previous&&previous.schemaVersion===1?previous:deepFreeze({schemaVersion:1,globalMultiplier:1,templates:{}}),'rollback:'+String(context&&context.build||'unknown'));return true;}
function getConfig(){return active;}
function getState(){return Object.freeze({version:VERSION,path:PATH,schemaVersion:1,epoch,applies,rollbacks,lastError,lastSource,registered:!!root.KeloHotDataRegistry?.isRegistered?.(PATH),catalogReady:!!root.KELO_EQUIPMENT_ITEM_CATALOG,catalogWrapped:!!wrappedCatalog,binds,fixturePatches,templateCount:Object.keys(active.templates).length,serverAuthorityTouched:false,playerListingsRepriced:false,inventoryMutations:0,goldMutations:0,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});}
async function loadInitial(){const seq=mutationSeq;try{const u=new URL(PATH,document.baseURI);u.searchParams.set('kelo_market_boot',Date.now().toString(36));const response=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'});if(!response.ok)throw new Error('equipment_market_http_'+response.status);const raw=await response.json(),next=normalize(raw);if(seq!==mutationSeq)return;setActive(next,'initial');}catch(error){lastError=String(error&&error.message||error);emit('initial-error',{error:lastError});}}
function register(){const registry=root.KeloHotDataRegistry;if(!registry||typeof registry.register!=='function')throw new Error('equipment_market_hot_registry_missing');registry.register({path:PATH,owner:'KeloEquipmentMarketHotBalance',version:VERSION,validate,snapshot,apply,rollback});}
root.KeloEquipmentMarketHotBalance=Object.freeze({version:VERSION,path:PATH,getState,getConfig,getPrice,applyRuntime});
root.KELO_EQUIPMENT_MARKET_HOT_AUDIT=Object.freeze({version:VERSION,registeredPath:PATH,priceOnly:true,transactional:true,serverAuthorityTouched:false,playerListingsRepriced:false,inventoryMutations:0,goldMutations:0,polling:false,timers:0,intervals:0,raf:0,gameLoop:false});
try{register();}catch(error){lastError=String(error&&error.message||error);emit('register-error',{error:lastError});}
applyRuntime('owner-install');
root.addEventListener('kelo:module-load-end',()=>applyRuntime('module-load'),{passive:true});
root.addEventListener('KELO_MOUNTED',()=>applyRuntime('mounted'),{passive:true});
root.addEventListener('kelo:runtime-foundations-ready',()=>applyRuntime('foundations-ready'),{passive:true});
void loadInitial();
})(typeof globalThis!=='undefined'?globalThis:window);

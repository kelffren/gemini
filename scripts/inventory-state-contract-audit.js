/* KELO-INDEX
 * area: QA / INVENTORY
 * owner: FOUNDATION CI
 * purpose: valida KeloInventory como owner único y bloquea writers LIVE directos de STATE.inventory
 * public-api: CLI `node scripts/inventory-state-contract-audit.js`
 * consumes: index.html + KeloInventory + migrated inventory consumers
 * state-owned: ninguno
 * extension-points: ampliar invariantes deterministas del dominio portable
 * reuse: Foundation/Inventory CI
 * legacy: engine-a conserva bootstrap/loadState de STATE.inventory como excepción explícita
 * do-not: no convertir en linter genérico ni permitir feature writers por allowlist
 */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function ok(cond,msg){if(!cond)throw new Error(msg);}
const ownerPath='src/core/inventory-state-system.js';
const ownerSource=fs.readFileSync(ownerPath,'utf8');
const context={console,Date,Math,Map,Set,Object,Array,Number,String,JSON,STATE:{inventory:[],warehouse:{items:[]},marketEscrow:{items:[]},emoteLoadout:{items:[]}},saveCalls:0,saveState(){this.saveCalls++;},window:{}};context.window=context;vm.createContext(context);vm.runInContext(ownerSource,context,{filename:ownerPath});
const I=context.KeloInventory;assert(I,'KeloInventory must boot');assert.equal(I.version,'inventory-state-v1.0.0');
const a={id:'a',templateId:'potion',kind:'consumable',quantity:3,maxStack:10};const b={id:'b',templateId:'potion',kind:'consumable',quantity:4,maxStack:10};
assert(I.addItem('backpack',a,{persist:false}).ok);assert(I.addItem('warehouse',b,{persist:false}).ok);assert(I.canStack(a,b));assert.equal(I.keyForItem(a,0),'id:a');
const anonymous={kind:'material'};const k1=I.keyForItem(anonymous,0),k2=I.keyForItem(anonymous,99);assert.equal(k1,k2,'anonymous identity must be stable');
let audit=I.identityAudit(['backpack','warehouse']);assert(audit.ok,'identity audit should pass');
context.STATE.marketEscrow.items.push(a);audit=I.identityAudit(['backpack','warehouse','market_escrow']);assert(!audit.ok&&audit.errors.some(x=>x.code==='DUPLICATE_IDENTITY'),'cross-container duplicate must be detected');context.STATE.marketEscrow.items=[];
const snap=I.snapshot(['inventory','warehouse']);I.setQuantity(a,9,{persist:false});I.removeItem('warehouse',b,{persist:false});I.restore(snap,{persist:false});assert.equal(context.STATE.inventory[0].quantity,3);assert.equal(context.STATE.warehouse.items[0].id,'b');
const clone=I.cloneWithNewIdentity(context.STATE.inventory[0],{quantity:1});assert.notEqual(I.itemIdentity(clone),'a');

const html=fs.readFileSync('index.html','utf8');const scriptRe=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;const live=[];let m;while((m=scriptRe.exec(html))){const p=m[1].split('?')[0];if(!/^(https?:)?\/\//.test(p)&&fs.existsSync(p))live.push(p);}
ok(live.includes(ownerPath),'KeloInventory must be LIVE in index.html');
const ownerIndex=html.indexOf(ownerPath),stoneIndex=html.indexOf('src/abilities/stone-system.js'),equipmentIndex=html.indexOf('src/systems/equipment-system.js');ok(ownerIndex>=0&&ownerIndex<stoneIndex&&ownerIndex<equipmentIndex,'inventory owner must load before stone/equipment consumers');
const allowedWriters=new Set(['engine-a.js']);const violations=[];
for(const file of live){if(allowedWriters.has(file)||file===ownerPath)continue;const text=fs.readFileSync(file,'utf8');const lines=text.split(/\r?\n/);lines.forEach((line,i)=>{const code=line.replace(/\/\/.*$/,'');if(/\bSTATE\.inventory\s*=/.test(code)||/\bSTATE\.inventory\s*\.(?:push|splice|pop|shift|unshift|sort|reverse)\s*\(/.test(code))violations.push(file+':'+(i+1)+': '+line.trim());});}
if(violations.length)throw new Error('DIRECT_LIVE_INVENTORY_WRITERS\n'+violations.join('\n'));
for(const file of ['src/systems/equipment-system.js','src/systems/backpack-system.js','src/systems/container-system.js','src/systems/emote-system.js','src/systems/market-escrow-system.js','src/abilities/stone-backpack-bridge.js']){
 const text=fs.readFileSync(file,'utf8');ok(text.includes('KeloInventory'),file+' must consume KeloInventory');ok(!/\bSTATE\.inventory\b/.test(text),file+' must not access STATE.inventory directly');
}
console.log('INVENTORY_STATE_OK:',JSON.stringify({version:I.version,liveScripts:live.length,directLiveInventoryWriters:0,legacyWriter:'engine-a.js',sharedIdentity:true,sharedStacks:true,snapshotRollback:true}));

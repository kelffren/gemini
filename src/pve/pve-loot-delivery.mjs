/* KELO-INDEX
 * area: PVE / LOOT DELIVERY
 * owner: KeloPvELootDelivery
 * purpose: local vertical-slice adapter from resolved drops to canonical KeloContainers
 * public-api: deliver
 * online: server authority must replace this adapter for shared worlds
 */
const F=Object.freeze;
export function deliver(drops,{container=globalThis.KeloContainers,destination='backpack',source='pve'}={}){
 const results=[];for(const d of drops||[]){const item={resourceId:String(d.id),templateId:String(d.id),kind:String(d.kind||'material'),quantity:Math.max(1,Number(d.quantity)||1),maxStack:99,stackKey:'pve:'+String(d.id),source};results.push(container?.receiveItem?.(destination,item,{allowMerge:true})||{ok:false,error:'CONTAINERS_UNAVAILABLE'});}
 const out=F({ok:results.length>0&&results.every(x=>x.ok),results:F(results)});globalThis.KeloEvents?.emit?.('kelo:pve:loot-delivered',out);return out;
}

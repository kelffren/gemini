/* KELO-INDEX
 * area: PROPERTY / CREATOR ACCESS
 * owner: Kelo Creator Property Entitlement Guard
 * purpose: defense-in-depth facade over KELO_PROPERTY_CATALOG so cached Creator templates stop being usable after identity/access changes
 * does-not-own: catalog data, placement authority, renderer, purchases or entitlements
 */
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function installCreatorPropertyEntitlementGuard({root=globalThis}={}){
  const current=root.KELO_PROPERTY_CATALOG;if(!current)return null;if(current.__creatorEntitlementGuard)return current;
  const allowed=row=>{
    if(!row||row.source!=='creator-content')return true;
    const revisionId=String(row.sourceId||'');if(!UUID_RE.test(revisionId))return false;
    return root.KeloCreatorEntitlements?.canUse?.({source:'creator-content',revisionId})===true;
  };
  const api=Object.freeze({
    __creatorEntitlementGuard:true,version:`${current.version||'property-catalog'}+creator-entitlement-v1`,tileSize:current.tileSize,
    registerTemplate:raw=>current.registerTemplate(raw),
    getRaw:id=>current.get(String(id)),
    get(id){const row=current.get(String(id));return allowed(row)?row:null;},
    list(filter){return (current.list(filter)||[]).filter(allowed);},
    categories:()=>current.categories?.()||[],
    onRegister(fn){return current.onRegister?.(row=>{if(allowed(row))fn(row);})||(()=>{});}
  });
  root.KELO_PROPERTY_CATALOG=api;root.KELO_CREATOR_PROPERTY_ACCESS=Object.freeze({version:'creator-property-entitlement-guard-v1.0.0',allowed});return api;
}

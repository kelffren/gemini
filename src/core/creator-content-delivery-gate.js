/* KELO-INDEX
 * area: CORE / CREATOR CONTENT DELIVERY
 * owner: KeloCreatorDelivery
 * keys: CREATOR CONTENT DELIVERY LAZY ENTITLEMENT OWNED RUNTIME
 * purpose: tiny normal-boot facade; imports Creator delivery only when one exact revision is requested
 * do-not: NO catalog sync, NO polling, NO asset preload, NO second auth client, NO gameplay authority
 */
(function(root){
'use strict';
if(root.KeloCreatorDelivery)return;
const VERSION='creator-content-delivery-gate-v1.0.0';let loading=null;
async function service(){
  if(root.KELO_CREATOR_CONTENT_DELIVERY)return root.KELO_CREATOR_CONTENT_DELIVERY;
  if(!loading)loading=import('../creators/content/creator-content-delivery.mjs?v=delivery-20260915-1').then(mod=>mod.getOrCreateCreatorContentDelivery({root})).finally(()=>{loading=null;});
  return loading;
}
async function useRevision(revisionId,options){return (await service()).activateRevision(revisionId,options);}
async function manifest(revisionId,options){return (await service()).getManifest(revisionId,options);}
async function load(){return service();}
function diagnostics(){return Object.freeze({version:VERSION,loaded:!!root.KELO_CREATOR_CONTENT_DELIVERY,loading:!!loading,runtime:root.KELO_CREATOR_CONTENT_DELIVERY?.diagnostics?.()||null});}
root.KeloCreatorDelivery=Object.freeze({version:VERSION,useRevision,manifest,load,diagnostics});
})(typeof globalThis!=='undefined'?globalThis:window);

/* KELO-INDEX
 * area: ECON / OLIVE OIL LIVE SLICE
 * owner: KeloOliveOilLive
 * purpose: headless playable olive -> paste -> oil domain adapter; world UI belongs to KeloOliveOilWorldStations
 */
import {create as createJobs} from './olive-oil-process-jobs.mjs';
const F=Object.freeze;
function qty(items,id){return(items||[]).filter(x=>x.resourceId===id||x.templateId===id).reduce((n,x)=>n+(Number(x.quantity)||1),0)}
function backpack(){return globalThis.KeloContainers?.getContainer?.('backpack')||null}
function take(id,count){let left=count,c=backpack();if(!c)return false;for(const item of [...(c.items||[])]){if(left<=0)break;if(item.resourceId!==id&&item.templateId!==id)continue;const key=globalThis.KeloContainers.keyForItem(item),n=Math.min(left,Number(item.quantity)||1),r=globalThis.KeloContainers.extractItem('backpack',key,{amount:n});if(!r.ok)return false;left-=n}return left===0}
function give(id,count,kind='material'){return globalThis.KeloContainers.receiveItem('backpack',{resourceId:id,templateId:id,kind,quantity:count,maxStack:99,stackKey:'production:'+id,source:'olive-oil-live'},{allowMerge:true})}
export function mount(){
 const G=globalThis.KeloGathering,P=globalThis.KeloProductionChain;if(!G||!P||!globalThis.KeloContainers)throw Error('OLIVE_OIL_FOUNDATION_UNAVAILABLE');
 document.getElementById('kelo-olive-oil-live')?.remove();
 const state={treeCharges:12,gathers:0},jobs=createJobs({recipes:P,consume(inputs){const inv={};for(const x of backpack()?.items||[]){const id=x.resourceId||x.templateId;if(id)inv[id]=(inv[id]||0)+(Number(x.quantity)||1)}for(const [id,n] of Object.entries(inputs))if((inv[id]||0)<n)return{ok:false,error:'MISSING_INPUTS',missing:{[id]:n-(inv[id]||0)}};for(const [id,n] of Object.entries(inputs))if(!take(id,n))return{ok:false,error:'CONSUME_FAILED'};return{ok:true}},give});
 function snapshot(){const items=backpack()?.items||[];return F({treeCharges:state.treeCharges,olive:qty(items,'olive'),olive_paste:qty(items,'olive_paste'),empty_vessel:qty(items,'empty_vessel'),olive_oil:qty(items,'olive_oil'),mill:jobs.snapshot('olive_mill'),press:jobs.snapshot('oil_press')})}
 function gatherOlives(){const check=G.canGather('olive_tree',{availableCharges:state.treeCharges});if(!check.ok)return check;const n=Math.max(1,Number(G.previewGather('olive_tree',{})?.quantity)||1),r=give('olive',n);if(r.ok){state.treeCharges--;state.gathers++;globalThis.KeloEvents?.emit?.('RESOURCE_GATHERED',{resourceId:'olive',count:n,nodeId:'olive_tree'})}return r}
 function interactJob(station,recipe){const j=jobs.snapshot(station);if(j?.state==='READY')return jobs.collect(station);if(j?.state==='PROCESSING')return{ok:false,error:'PROCESSING',job:j};return jobs.start(station,recipe)}
 function vessel(){return give('empty_vessel',1)}
 return F({jobs,gatherOlives,millPaste:()=>interactJob('olive_mill','olive_paste'),pressOil:()=>interactJob('oil_press','olive_oil'),takeVessel:vessel,snapshot,refresh(){},destroy(){}});
}

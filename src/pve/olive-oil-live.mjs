/* KELO-INDEX
 * area: ECON / OLIVE OIL LIVE SLICE
 * owner: KeloOliveOilLive
 * purpose: playable olive -> timed paste -> timed oil using canonical Gathering/ProductionChain/Containers
 */
import {create as createJobs} from './olive-oil-process-jobs.mjs';
const F=Object.freeze;
function qty(items,id){return(items||[]).filter(x=>x.resourceId===id||x.templateId===id).reduce((n,x)=>n+(Number(x.quantity)||1),0)}
function backpack(){return globalThis.KeloContainers?.getContainer?.('backpack')||null}
function take(id,count){let left=count,c=backpack();if(!c)return false;for(const item of [...(c.items||[])]){if(left<=0)break;if(item.resourceId!==id&&item.templateId!==id)continue;const key=globalThis.KeloContainers.keyForItem(item),n=Math.min(left,Number(item.quantity)||1),r=globalThis.KeloContainers.extractItem('backpack',key,{amount:n});if(!r.ok)return false;left-=n}return left===0}
function give(id,count,kind='material'){return globalThis.KeloContainers.receiveItem('backpack',{resourceId:id,templateId:id,kind,quantity:count,maxStack:99,stackKey:'production:'+id,source:'olive-oil-live'},{allowMerge:true})}
export function mount(){
 const G=globalThis.KeloGathering,P=globalThis.KeloProductionChain;if(!G||!P||!globalThis.KeloContainers)throw Error('OLIVE_OIL_FOUNDATION_UNAVAILABLE');
 const state={treeCharges:6,gathers:0},jobs=createJobs({recipes:P,consume(inputs){const inv={};for(const x of backpack()?.items||[]){const id=x.resourceId||x.templateId;if(id)inv[id]=(inv[id]||0)+(Number(x.quantity)||1)}for(const [id,n] of Object.entries(inputs))if((inv[id]||0)<n)return{ok:false,error:'MISSING_INPUTS'};for(const [id,n] of Object.entries(inputs))if(!take(id,n))return{ok:false,error:'CONSUME_FAILED'};return{ok:true}},give});
 const ui=document.createElement('section');ui.id='kelo-olive-oil-live';ui.style.cssText='position:absolute;right:10px;top:max(70px,env(safe-area-inset-top));z-index:88;width:min(235px,68vw);padding:9px;border-radius:14px;background:rgba(10,16,12,.86);color:#fff;border:1px solid rgba(170,190,90,.45);font:600 12px -apple-system,sans-serif;pointer-events:none';ui.innerHTML='<b>🫒 Aceite de Verdantia</b><div data-status style="margin-top:5px;opacity:.9"></div>'; (document.getElementById('ui-layer')||document.body).appendChild(ui);
 function snapshot(){const items=backpack()?.items||[];return F({treeCharges:state.treeCharges,olive:qty(items,'olive'),olive_paste:qty(items,'olive_paste'),empty_vessel:qty(items,'empty_vessel'),olive_oil:qty(items,'olive_oil'),mill:jobs.snapshot('olive_mill'),press:jobs.snapshot('oil_press')})}
 function paint(msg=''){const s=snapshot(),fmt=j=>!j?'libre':j.state==='PROCESSING'?Math.ceil(j.remainingMs/1000)+'s':j.state==='READY'?'LISTO':'libre';ui.querySelector('[data-status]').textContent=(msg?msg+' · ':'')+'🫒 '+s.olive+' | pasta '+s.olive_paste+' | aceite '+s.olive_oil+' · Molino '+fmt(s.mill)+' · Prensa '+fmt(s.press)}
 function gatherOlives(){const check=G.canGather('olive_tree',{availableCharges:state.treeCharges});if(!check.ok){paint('Árbol agotado');return check}const n=Math.max(1,Number(G.previewGather('olive_tree',{})?.quantity)||1),r=give('olive',n);if(r.ok){state.treeCharges--;state.gathers++}paint(r.ok?'Recogiste '+n:'Mochila llena');return r}
 function interactJob(station,recipe){const j=jobs.snapshot(station);let r;if(j?.state==='READY')r=jobs.collect(station);else if(j?.state==='PROCESSING')r={ok:false,error:'PROCESSING',job:j};else r=jobs.start(station,recipe);paint(r.ok?(r.outputs?'Producto recogido':'Producción iniciada'):(r.error==='PROCESSING'?'Procesando…':'Faltan materiales'));return r}
 function vessel(){const r=give('empty_vessel',1);paint(r.ok?'Recipiente obtenido':'Mochila llena');return r}
 paint('Cadena lista');
 return F({ui,jobs,gatherOlives,millPaste:()=>interactJob('olive_mill','olive_paste'),pressOil:()=>interactJob('oil_press','olive_oil'),takeVessel:vessel,snapshot,refresh:paint,destroy(){ui.remove()}});
}

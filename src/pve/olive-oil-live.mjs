/* KELO-INDEX
 * area: ECON / OLIVE OIL LIVE SLICE
 * owner: KeloOliveOilLive
 * purpose: playable olive -> paste -> oil vertical slice using canonical Gathering, ProductionChain and KeloContainers
 * public-api: mount/gatherOlives/millPaste/pressOil/snapshot
 * online: local demo authority only; shared world replaces transaction adapter
 * do-not: NO second inventory, NO production recipe duplication
 */
const F=Object.freeze;
function qty(items,id){return(items||[]).filter(x=>x.resourceId===id||x.templateId===id).reduce((n,x)=>n+(Number(x.quantity)||1),0)}
function backpack(){return globalThis.KeloContainers?.getContainer?.('backpack')||globalThis.KeloContainers?.getContainer?.('inventory')||null}
function take(id,count){let left=count;const c=backpack();if(!c)return false;for(const item of [...(c.items||[])]){if(left<=0)break;if(item.resourceId!==id&&item.templateId!==id)continue;const key=globalThis.KeloContainers.keyForItem(item),n=Math.min(left,Number(item.quantity)||1),r=globalThis.KeloContainers.extractItem('backpack',key,{amount:n});if(!r.ok)return false;left-=n}return left===0}
function give(id,count,kind='material'){return globalThis.KeloContainers.receiveItem('backpack',{resourceId:id,templateId:id,kind,quantity:count,maxStack:99,stackKey:'production:'+id,source:'olive-oil-live'},{allowMerge:true})}
export function mount({getPlayer=()=>globalThis.localPlayer}={}){
 const G=globalThis.KeloGathering,P=globalThis.KeloProductionChain;if(!G||!P||!globalThis.KeloContainers)throw Error('OLIVE_OIL_FOUNDATION_UNAVAILABLE');
 const state={treeCharges:6,gathers:0,crafts:0};
 const ui=document.createElement('section');ui.id='kelo-olive-oil-live';ui.style.cssText='position:absolute;right:10px;top:max(70px,env(safe-area-inset-top));z-index:88;width:min(260px,72vw);padding:10px;border-radius:14px;background:rgba(10,16,12,.88);color:#fff;border:1px solid rgba(170,190,90,.45);font:600 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;pointer-events:auto';
 ui.innerHTML='<div style="font-weight:900;font-size:14px">🫒 Aceite de Verdantia</div><div data-status style="margin:6px 0;opacity:.9"></div><div style="display:grid;gap:6px"><button data-a="gather">🌳 Recoger aceitunas</button><button data-a="mill">⚙️ Moler 4 → pasta</button><button data-a="vessel">🏺 Tomar recipiente</button><button data-a="press">🫒 Prensar 2 pasta + 🏺 → aceite</button></div>';ui.querySelectorAll('button').forEach(b=>b.style.cssText='min-height:42px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.09);color:#fff;font-weight:800;text-align:left;padding:8px');
 (document.getElementById('ui-layer')||document.body).appendChild(ui);
 function snapshot(){const items=backpack()?.items||[];return F({treeCharges:state.treeCharges,olive:qty(items,'olive'),olive_paste:qty(items,'olive_paste'),empty_vessel:qty(items,'empty_vessel'),olive_oil:qty(items,'olive_oil')})}
 function paint(msg=''){const s=snapshot();ui.querySelector('[data-status]').textContent=(msg?msg+' · ':'')+'Aceitunas '+s.olive+' | Pasta '+s.olive_paste+' | 🏺 '+s.empty_vessel+' | Aceite '+s.olive_oil+' | Árbol '+s.treeCharges+'/6'}
 function gatherOlives(){const check=G.canGather('olive_tree',{availableCharges:state.treeCharges});if(!check.ok){paint('Árbol agotado');return check}const p=G.previewGather('olive_tree',{}),n=Math.max(1,Number(p.quantity)||1),r=give('olive',n);if(r.ok){state.treeCharges--;state.gathers++;globalThis.KeloEvents?.emit?.('RESOURCE_GATHERED',{resourceId:'olive',count:n,nodeId:'olive_tree'})}paint(r.ok?'Recogiste '+n:'Mochila llena');return r}
 function craft(recipeId){const recipe=P.getRecipe(recipeId),items=backpack()?.items||[],inv={};for(const x of items){const id=x.resourceId||x.templateId;if(id)inv[id]=(inv[id]||0)+(Number(x.quantity)||1)}const check=P.canCraft(recipeId,inv,1);if(!check.ok){paint('Faltan materiales');return check}for(const [id,n] of Object.entries(recipe.inputs))if(!take(id,n)){paint('Error consumiendo '+id);return{ok:false,error:'CONSUME_FAILED'}}for(const [id,n] of Object.entries(recipe.outputs)){const r=give(id,n);if(!r.ok){paint('Mochila llena');return r}}state.crafts++;globalThis.KeloEvents?.emit?.('PRODUCTION_RECIPE_COMPLETED',{recipeId,outputs:recipe.outputs});paint(recipeId==='olive_oil'?'¡Aceite producido!':'Pasta lista');return{ok:true,recipeId}}
 function vessel(){const r=give('empty_vessel',1);paint(r.ok?'Recipiente obtenido':'Mochila llena');return r}
 ui.addEventListener('click',e=>{const a=e.target?.dataset?.a;if(a==='gather')gatherOlives();if(a==='mill')craft('olive_paste');if(a==='vessel')vessel();if(a==='press')craft('olive_oil')});paint('Cadena lista');
 return F({ui,gatherOlives,millPaste:()=>craft('olive_paste'),pressOil:()=>craft('olive_oil'),takeVessel:vessel,snapshot,destroy(){ui.remove()}});
}

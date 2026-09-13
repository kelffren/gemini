/* KELO-INDEX
 * area: STUDIO / UI / QUICK BUILD
 * owns: compact semantic building-piece palette and catalog-to-prefab resolution
 * does-not-own: placement math, document mutation, CommandBus, authority or rendering
 * public-api: createStudioQuickBuild(), resolveQuickBuildCatalog()
 * online: choosing a piece delegates to the existing Studio placement pipeline
 */

const PIECES=Object.freeze([
  Object.freeze({type:'wall',label:'WALL',glyph:'▥',keywords:['wall','muro','pared','fence','barrier']}),
  Object.freeze({type:'floor',label:'FLOOR',glyph:'▦',keywords:['floor','tile','ground','piso','grounding']})
]);

const norm=value=>String(value||'').trim().toLowerCase();
const searchable=asset=>`${norm(asset?.id)} ${norm(asset?.label)} ${norm(asset?.category)}`;

function scoreAsset(asset,piece){
  const text=searchable(asset);if(!text)return -1;
  let score=0;
  for(const word of piece.keywords){
    if(norm(asset?.id)===word)score+=12;
    if(norm(asset?.label)===word)score+=10;
    if(text.includes(word))score+=4;
  }
  if(text.includes('building')||text.includes('structure'))score+=1;
  return score||-1;
}

export function resolveQuickBuildCatalog({assets=[],overrides={}}={}){
  const rows=[];
  for(const piece of PIECES){
    const forced=overrides?.[piece.type];
    if(forced){rows.push({...piece,prefabId:String(forced),source:'override'});continue;}
    let best=null,bestScore=-1;
    for(const asset of assets||[]){const score=scoreAsset(asset,piece);if(score>bestScore){best=asset;bestScore=score;}}
    if(best&&bestScore>0)rows.push({...piece,prefabId:String(best.id),source:'catalog'});
  }
  return rows;
}

export function createStudioQuickBuild({root=globalThis,host=null,assets=[],overrides=null,onChoose=null,onCancel=null}={}){
  const document=root?.document;
  if(!document?.createElement)return Object.freeze({catalog:[],open:()=>false,close:()=>false,setActive:()=>{},destroy(){}});
  const catalog=resolveQuickBuildCatalog({assets,overrides:overrides||root.KELO_QUICK_BUILD_CATALOG||{}});
  let destroyed=false,active='',panel=null,style=null;
  const target=host||document.getElementById?.('kelo-studio-live')||document.body;

  function ensure(){
    if(destroyed||!target)return null;
    if(!style){style=document.createElement('style');style.dataset.keloQuickBuild='1';style.textContent=`
      #kelo-studio-live .ks-quick-build{position:absolute;left:50%;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 72px);transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid rgba(231,197,106,.38);border-radius:15px;background:rgba(5,14,16,.94);box-shadow:0 12px 34px rgba(0,0,0,.4);backdrop-filter:blur(14px);pointer-events:auto}
      #kelo-studio-live .ks-quick-build[hidden]{display:none}
      #kelo-studio-live .ks-qb-title{padding:0 5px;color:#e7c56a;font:800 8px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.12em;white-space:nowrap}
      #kelo-studio-live .ks-qb-piece,#kelo-studio-live .ks-qb-close{min-width:48px;min-height:44px;border:1px solid rgba(231,197,106,.24);border-radius:11px;background:#102022;color:#f8efcf;font:800 8px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;touch-action:manipulation}
      #kelo-studio-live .ks-qb-piece strong{display:block;font-size:16px;line-height:16px;margin-bottom:3px;color:#e7c56a}
      #kelo-studio-live .ks-qb-piece.on{border-color:#8cf0b4;background:#17372c;box-shadow:inset 0 0 0 1px rgba(140,240,180,.24)}
      #kelo-studio-live .ks-qb-close{min-width:44px;color:#ffd2cd;border-color:rgba(255,120,110,.34)}
      @media(max-width:760px){#kelo-studio-live .ks-quick-build{left:8px;right:8px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 70px);transform:none;justify-content:center}.ks-qb-title{display:none!important}}
    `;document.head?.appendChild(style);}
    if(!panel?.isConnected){
      panel=document.createElement('div');panel.className='ks-quick-build';panel.hidden=true;panel.dataset.keloStudioUi='1';panel.setAttribute('aria-label','Quick Build');
      panel.innerHTML=`<span class="ks-qb-title">QUICK BUILD</span>${catalog.map(piece=>`<button type="button" class="ks-qb-piece" data-qb-piece="${piece.type}" aria-label="Construir ${piece.label}"><strong>${piece.glyph}</strong>${piece.label}</button>`).join('')}<button type="button" class="ks-qb-close" data-qb-close="1" aria-label="Cerrar Quick Build">×</button>`;
      panel.addEventListener('click',click);target.appendChild(panel);
    }
    return panel;
  }

  function sync(){const el=ensure();if(!el)return;el.querySelectorAll?.('[data-qb-piece]')?.forEach(button=>button.classList.toggle('on',button.dataset.qbPiece===active));}
  function click(event){
    const type=event.target?.closest?.('[data-qb-piece]')?.dataset.qbPiece;
    if(type){const piece=catalog.find(row=>row.type===type);if(!piece)return;active=type;sync();onChoose?.({...piece,components:{buildingPiece:{type:piece.type,system:'quick-build',version:1}}});return;}
    if(event.target?.closest?.('[data-qb-close]')){active='';panel.hidden=true;onCancel?.();}
  }
  function open(){const el=ensure();if(!el||!catalog.length)return false;el.hidden=false;sync();return true;}
  function close(){if(!panel)return false;active='';panel.hidden=true;return true;}
  function setActive(type){active=norm(type);sync();}
  ensure();
  return Object.freeze({version:'studio-quick-build-v1.0.0-phase1',catalog:catalog.map(row=>({...row})),open,close,setActive,get active(){return active;},destroy(){if(destroyed)return;destroyed=true;panel?.removeEventListener?.('click',click);panel?.remove();style?.remove();panel=style=null;}});
}

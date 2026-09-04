(function(){
'use strict';

const VERSION='backpack-ui-v1.2.0';
let selected=null;
let moveMode=false;
let splitMode=false;
let splitAmount=1;
let discardConfirm=false;

function css(){
  if(document.getElementById('kelo-backpack-v1-style'))return;
  const style=document.createElement('style');
  style.id='kelo-backpack-v1-style';
  style.textContent=`
    #kelo-bag.kb-panel{display:none;position:absolute;top:max(66px,calc(env(safe-area-inset-top) + 58px));left:50%;right:auto;transform:translateX(-50%);width:min(350px,calc(100vw - 20px));max-height:min(76vh,650px);overflow-y:auto;z-index:130;padding:12px;border:1px solid rgba(231,197,106,.5);border-radius:18px;background:linear-gradient(180deg,rgba(14,26,27,.985),rgba(8,15,18,.99));box-shadow:0 22px 60px rgba(0,0,0,.5);color:#eef2e9;pointer-events:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
    #kelo-bag .kb-head{display:flex;align-items:center;gap:7px;margin-bottom:9px}
    #kelo-bag .kb-title{font-size:13px;font-weight:900;letter-spacing:.12em;color:#e7c56a}
    #kelo-bag .kb-count{margin-left:auto;padding:5px 8px;border-radius:999px;border:1px solid rgba(231,197,106,.2);background:rgba(231,197,106,.06);font-size:10px;color:#d8c889}
    #kelo-bag .kb-sort,#kelo-bag .kb-close{min-width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.04);color:#9da8a3;line-height:1;touch-action:manipulation}
    #kelo-bag .kb-sort{padding:0 8px;font-size:9px;font-weight:850;color:#d8c889;border:1px solid rgba(231,197,106,.16)}
    #kelo-bag .kb-close{font-size:22px}
    #kelo-bag .kb-sub{font-size:9px;color:#81918a;margin-bottom:10px}
    #kelo-bag .kb-grid{display:grid;grid-template-columns:repeat(5,52px);gap:6px;justify-content:center}
    #kelo-bag .kb-slot{position:relative;width:52px;height:52px;border:1px solid rgba(184,197,188,.18);border-radius:11px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(0,0,0,.15));color:#e8ede8;display:grid;place-items:center;padding:0;touch-action:manipulation;box-shadow:inset 0 0 0 1px rgba(255,255,255,.018)}
    #kelo-bag .kb-slot:active{transform:scale(.96)}
    #kelo-bag .kb-slot.selected{border-color:#e7c56a;box-shadow:0 0 0 2px rgba(231,197,106,.13),inset 0 0 0 1px rgba(231,197,106,.18)}
    #kelo-bag .kb-slot.equipped:after{content:'E';position:absolute;right:3px;top:3px;min-width:14px;height:14px;border-radius:7px;background:#e7c56a;color:#18201d;font-size:8px;font-weight:950;display:grid;place-items:center}
    #kelo-bag .kb-slot.move-target{border-style:dashed;border-color:rgba(231,197,106,.62)}
    #kelo-bag .kb-icon{font-size:22px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))}
    #kelo-bag .kb-qty{position:absolute;right:4px;bottom:3px;min-width:15px;padding:1px 3px;border-radius:6px;background:rgba(5,9,11,.9);font-size:9px;font-weight:900;color:#fff;text-align:center}
    #kelo-bag .kb-rarity{position:absolute;left:4px;top:4px;width:5px;height:5px;border-radius:50%;background:#7e9489}
    #kelo-bag .kb-rarity.rare{background:#5aa7ff} #kelo-bag .kb-rarity.epic{background:#b87cff} #kelo-bag .kb-rarity.legendary,#kelo-bag .kb-rarity.eternal{background:#e7c56a} #kelo-bag .kb-rarity.divine{background:#ff7ac8}
    #kelo-bag .kb-detail{margin-top:11px;min-height:88px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(0,0,0,.16)}
    #kelo-bag .kb-empty-detail{display:grid;place-items:center;min-height:66px;color:#71817a;font-size:10px;text-align:center}
    #kelo-bag .kb-name{font-size:12px;font-weight:900;color:#f4efd9}.kb-meta{margin-top:3px;font-size:9px;color:#8fa198}
    #kelo-bag .kb-actions{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}
    #kelo-bag .kb-action{min-height:40px;padding:0 12px;border-radius:10px;border:1px solid rgba(231,197,106,.34);background:rgba(255,255,255,.035);color:#c7d1cb;font-size:10px;font-weight:850;touch-action:manipulation}
    #kelo-bag .kb-action.primary{background:rgba(231,197,106,.12);color:#f0db9b;border-color:rgba(231,197,106,.5)}
    #kelo-bag .kb-action.danger{border-color:rgba(222,88,88,.45);color:#f0aaaa}
    #kelo-bag .kb-move-note,#kelo-bag .kb-inline{margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(231,197,106,.08);color:#e5d18b;font-size:9px}
    #kelo-bag .kb-stepper{display:flex;align-items:center;gap:8px;margin-top:7px}
    #kelo-bag .kb-stepper button{width:40px;height:40px;border:1px solid rgba(231,197,106,.32);border-radius:10px;background:rgba(255,255,255,.04);color:#ead892;font-size:18px;font-weight:900}
    #kelo-bag .kb-step-value{min-width:42px;text-align:center;font-size:12px;font-weight:900;color:#fff}
    @media(max-width:340px){#kelo-bag .kb-grid{grid-template-columns:repeat(5,49px);gap:5px}#kelo-bag .kb-slot{width:49px;height:49px}}
  `;
  document.head.appendChild(style);
}

function rarityClass(rarity){return String(rarity||'').toLowerCase().replace(/[^a-z0-9_-]/g,'');}
function isEquipped(item){return !!(item&&item.kind==='equipment'&&window.KeloEquipment&&typeof window.KeloEquipment.isEquipped==='function'&&window.KeloEquipment.isEquipped(item.id));}
function resetModes(){moveMode=false;splitMode=false;splitAmount=1;discardConfirm=false;}
function toast(text){if(typeof showToast==='function')showToast(text);}
function panel(){
  css();
  let root=document.getElementById('kelo-bag');
  if(!root){root=document.createElement('div');root.id='kelo-bag';document.body.appendChild(root);}
  root.className='kb-panel';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-label','Mochila');
  return root;
}

function render(){
  const root=panel();
  if(!window.KeloBackpack){root.innerHTML='<div class="kb-empty-detail">Backpack todavía cargando…</div>';return;}
  const slots=window.KeloBackpack.getSlots();
  const stats=window.KeloBackpack.getStats();
  if(selected!=null&&(selected<0||selected>=slots.length))selected=null;
  const active=selected==null?null:slots[selected];
  root.innerHTML=`
    <div class="kb-head"><div class="kb-title">MOCHILA</div><div class="kb-count">${stats.used}/${stats.capacity}</div><button class="kb-sort" aria-label="Ordenar mochila">ORDENAR</button><button class="kb-close" aria-label="Cerrar mochila">×</button></div>
    <div class="kb-sub">Inventario portátil · toca un objeto para inspeccionarlo</div>
    <div class="kb-grid" role="grid" aria-label="Slots de mochila"></div>
    <div class="kb-detail"></div>`;
  const grid=root.querySelector('.kb-grid');
  slots.forEach(function(slot){
    const d=slot.descriptor;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='kb-slot'+(selected===slot.index?' selected':'')+(moveMode&&selected!==slot.index?' move-target':'')+(slot.item&&isEquipped(slot.item)?' equipped':'');
    btn.dataset.slot=String(slot.index);
    btn.setAttribute('aria-label',d?('Slot '+(slot.index+1)+': '+d.name+(slot.item&&isEquipped(slot.item)?' equipado':'')):('Slot '+(slot.index+1)+' vacío'));
    if(d){
      btn.innerHTML='<span class="kb-rarity '+rarityClass(d.rarity)+'"></span><span class="kb-icon"></span>'+(d.quantity>1?'<span class="kb-qty"></span>':'');
      btn.querySelector('.kb-icon').textContent=d.icon;
      const qty=btn.querySelector('.kb-qty');if(qty)qty.textContent=String(d.quantity);
    }
    btn.onclick=function(){onSlot(slot.index);};
    grid.appendChild(btn);
  });
  root.querySelector('.kb-close').onclick=close;
  root.querySelector('.kb-sort').onclick=function(){window.KeloBackpack.sortSlots();selected=null;resetModes();toast('Mochila ordenada');render();};
  const detail=root.querySelector('.kb-detail');
  if(!active||!active.item||!active.descriptor){
    detail.innerHTML='<div class="kb-empty-detail">Selecciona un objeto para ver sus datos.</div>';
    return;
  }
  const d=active.descriptor;
  detail.innerHTML='<div class="kb-name"></div><div class="kb-meta"></div><div class="kb-actions"></div>'+(moveMode?'<div class="kb-move-note">Toca otro slot para mover, intercambiar o combinar este objeto.</div>':'');
  detail.querySelector('.kb-name').textContent=d.icon+' '+d.name;
  detail.querySelector('.kb-meta').textContent=[d.rarity,d.category,d.bound?'Vinculado':'No vinculado',d.quantity>1?'x'+d.quantity:null,isEquipped(active.item)?'Equipado':null].filter(Boolean).join(' · ');
  const actions=detail.querySelector('.kb-actions');
  if(d.category==='equipment'&&window.KeloEquipment){
    const equipped=isEquipped(active.item);
    const equip=document.createElement('button');equip.className='kb-action primary';equip.textContent=equipped?'Desequipar':'Equipar';
    equip.onclick=function(){const result=equipped?window.KeloEquipment.unequipItem(active.item.slot):window.KeloEquipment.equipItem(active.item.id);if(result&&result.ok)toast(equipped?'Objeto desequipado':'Objeto equipado');render();};
    actions.appendChild(equip);
  }
  const move=document.createElement('button');move.className='kb-action';move.textContent=moveMode?'Cancelar mover':'Mover';
  move.onclick=function(){moveMode=!moveMode;splitMode=false;discardConfirm=false;render();};actions.appendChild(move);
  if(d.stackable&&d.quantity>1){
    const split=document.createElement('button');split.className='kb-action';split.textContent=splitMode?'Cancelar dividir':'Dividir';
    split.onclick=function(){splitMode=!splitMode;moveMode=false;discardConfirm=false;splitAmount=Math.min(Math.max(1,splitAmount),d.quantity-1);render();};actions.appendChild(split);
  }
  if(d.category!=='equipment'&&!d.bound){
    const discard=document.createElement('button');discard.className='kb-action danger';discard.textContent=discardConfirm?'Cancelar':'Descartar';
    discard.onclick=function(){discardConfirm=!discardConfirm;moveMode=false;splitMode=false;render();};actions.appendChild(discard);
  }
  if(splitMode&&d.stackable&&d.quantity>1){
    const box=document.createElement('div');box.className='kb-inline';box.innerHTML='<div>Dividir stack · se usará el primer slot vacío.</div><div class="kb-stepper"><button type="button" class="kb-minus">−</button><span class="kb-step-value"></span><button type="button" class="kb-plus">+</button><button type="button" class="kb-action primary kb-split-go">SEPARAR</button></div>';
    box.querySelector('.kb-step-value').textContent=String(splitAmount);
    box.querySelector('.kb-minus').onclick=function(){splitAmount=Math.max(1,splitAmount-1);render();};
    box.querySelector('.kb-plus').onclick=function(){splitAmount=Math.min(d.quantity-1,splitAmount+1);render();};
    box.querySelector('.kb-split-go').onclick=function(){const free=window.KeloBackpack.getSlots().find(function(s){return !s.item;});if(!free){toast('No hay espacio libre');return;}const result=window.KeloBackpack.splitStack(active.index,free.index,splitAmount);if(result.ok){selected=free.index;resetModes();toast('Stack dividido');}render();};
    detail.appendChild(box);
  }
  if(discardConfirm&&d.category!=='equipment'&&!d.bound){
    const box=document.createElement('div');box.className='kb-inline';box.innerHTML='<div>Esta acción elimina '+(d.quantity>1?'el stack completo (x'+d.quantity+')':'este objeto')+'.</div><div class="kb-actions"><button type="button" class="kb-action danger kb-discard-go">CONFIRMAR DESCARTE</button></div>';
    box.querySelector('.kb-discard-go').onclick=function(){const result=window.KeloBackpack.discardSlot(active.index);if(result.ok){selected=null;resetModes();toast('Objeto descartado');}render();};
    detail.appendChild(box);
  }
}

function onSlot(index){
  if(moveMode&&selected!=null&&index!==selected){
    const result=window.KeloBackpack.moveSlot(selected,index);
    if(result.ok){selected=result.merged?(result.sourceRemaining>0?selected:index):index;moveMode=false;toast(result.merged?'Stacks combinados':'Objeto movido');}
    render();return;
  }
  if(moveMode&&index===selected){moveMode=false;render();return;}
  const slot=window.KeloBackpack.getSlots()[index];
  selected=slot&&slot.item?index:null;
  resetModes();
  render();
}

function open(){if(typeof closeMenu==='function')closeMenu();selected=null;resetModes();render();const root=panel();root.style.display='block';}
function close(){const root=document.getElementById('kelo-bag');if(root)root.style.display='none';selected=null;resetModes();}

const previous=window.KeloSocialUI||{};
window.KeloSocialUI=Object.freeze(Object.assign({},previous,{openBag:open,closeBag:close}));
window.KeloBackpackUI=Object.freeze({version:VERSION,open,close,render});
window.KELO_BACKPACK_UI_AUDIT=Object.freeze({version:VERSION,interaction:'tap-first-transactional-v2',columns:5,slotTargetPx:52,dragDrop:false,detailPanel:true,equipmentAction:true,stackMergeByMove:true,splitStepper:true,sortAction:true,inlineDiscardConfirm:true});
})();
/* KELO-INDEX
 * area: UI / HUD
 * owner: Kelo Luxe Shell presentation
 * keys: PLAYER HUD PROFILE NOBILITY TITLE CLAN HP MANA GOLD GUIDE MOBILE WORLD FIRST EXPLORATION
 * purpose: HUD móvil world-first: mantiene recursos críticos visibles y mueve metadata secundaria a disclosure progresivo para liberar paisaje
 * public-api: KELO_LUXE_PLAYER_HUD.refresh/snapshot
 * consumes: localPlayer, STATE, KeloNobility, KeloTitles, KeloEvents, legacy inspectPlayer adapter
 * state-owned: cache visual del último snapshot + estado expanded del HUD
 * extension-points: futuros owners pueden exponer avatar/clan/mana en localPlayer o STATE sin rehacer el HUD
 * reuse: HUD superior izquierdo único del jugador local + compactación visual del Luxe rail existente
 * legacy: reemplaza las piezas .lx-gold/.lx-presence del shell anterior; no crea otra economía/HP/maná
 * do-not: NO mutar gameplay, NO polling/setInterval, NO inventar recursos ausentes
 * online: solo lectura/presentación; IDs/rangos/títulos/recursos siguen perteneciendo a sus capas de autoridad
 */
(function(root){
'use strict';
if(typeof document==='undefined'||document.getElementById('kw-player-hud-wrap'))return;

const luxe=document.getElementById('kelo-luxe');
if(!luxe)return;

// Retiro real de los badges anteriores: desaparecen del DOM, no se tapan con CSS.
luxe.querySelector('.lx-gold')?.remove();
luxe.querySelector('.lx-presence')?.remove();

// Boutique ya existe y conserva su owner/onclick. Solo cambia de superficie visual:
// sale de la barra superior permanente y reutiliza el rail compacto existente.
const rail=luxe.querySelector('.lx-rail');
const shop=document.getElementById('lx-shop');
if(rail&&shop){
  shop.textContent='◇';
  shop.setAttribute('aria-label','Abrir Boutique');
  shop.setAttribute('title','Boutique');
  rail.appendChild(shop);
}

const style=document.createElement('style');
style.id='kw-player-hud-style';
style.textContent=`
/* WORLD-FIRST MOBILE CHROME ------------------------------------------------ */
#kw-player-hud-wrap{position:absolute;top:max(6px,env(safe-area-inset-top));left:max(6px,env(safe-area-inset-left));width:clamp(150px,43vw,176px);pointer-events:none;z-index:86;color:#fff4d6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.kw-player-hud{position:relative;overflow:hidden;padding:4px;border:1px solid rgba(231,197,106,.58);border-radius:11px;background:linear-gradient(145deg,rgba(7,25,31,.91),rgba(5,15,20,.94));box-shadow:0 6px 16px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.025);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:none}
.kw-hud-core{display:grid;grid-template-columns:38px minmax(0,1fr);gap:5px;align-items:start;min-width:0}
.kw-hud-avatar{position:relative;width:38px;height:38px;padding:0;border-radius:9px;border:1px solid rgba(231,197,106,.76);background:#07141a;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,.26);pointer-events:auto;touch-action:manipulation}
.kw-hud-avatar-img{position:absolute;inset:0;background-repeat:no-repeat;background-position:0 0;background-size:cover}.kw-hud-avatar-img.sprite{background-size:400% 400%;background-position:0 0}
.kw-hud-main{min-width:0;display:grid;gap:2px}.kw-hud-head{display:grid;grid-template-columns:minmax(0,1fr) 24px;gap:3px;align-items:center;min-height:20px}.kw-hud-name{min-width:0;color:#fff2c6;font:800 clamp(10.5px,3vw,12px)/1 Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 7px rgba(231,197,106,.11)}
.kw-hud-more{width:24px;height:24px;padding:0;border:1px solid rgba(231,197,106,.27);border-radius:7px;background:rgba(7,19,23,.78);color:#e7c56a;font:900 11px/1 Georgia,serif;pointer-events:auto;touch-action:manipulation;transition:transform .14s ease}.kw-hud-more[aria-expanded="true"]{transform:rotate(180deg)}
.kw-hud-id-row{display:flex;align-items:center;min-width:0;height:10px;color:#91a49e;font-size:5.4px;line-height:1;letter-spacing:.025em}.kw-hud-id-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kw-hud-copy{margin-left:auto;width:22px;height:22px;padding:0;border:0;background:transparent;color:#d8bd71;pointer-events:auto;font-size:8px;line-height:1;touch-action:manipulation}
.kw-hud-resources{display:grid;gap:2px;margin-top:1px}.kw-hud-resource{display:grid;grid-template-columns:12px minmax(0,1fr);gap:3px;align-items:center;min-height:9px}.kw-hud-resource-icon{width:12px;height:12px;display:grid;place-items:center;color:#e9d9a5;font-size:7px}.kw-hud-resource-main{display:block;min-width:0}.kw-hud-resource-head{display:flex;align-items:center;justify-content:space-between;gap:3px;color:#a9b9b2;font-size:5px;line-height:1}.kw-hud-resource-head b{color:#e8e9dc;font:800 5.8px/1 Georgia,serif}.kw-hud-bar{display:block;width:100%;height:4px;margin-top:1px;border-radius:99px;overflow:hidden;background:rgba(1,8,11,.78);box-shadow:inset 0 0 0 1px rgba(255,255,255,.055)}.kw-hud-bar i{display:block;height:100%;width:0;transition:width .18s ease}.kw-hud-hp i{background:linear-gradient(90deg,#9d1015,#ec4638)}.kw-hud-mana i{background:linear-gradient(90deg,#0756aa,#22a4f2)}.kw-hud-resource.unavailable{opacity:.52}.kw-hud-resource.unavailable .kw-hud-bar i{width:0!important}
.kw-hud-gold{grid-column:1/-1;height:17px;margin-top:3px;padding:0 5px;border-radius:6px;border:1px solid rgba(231,197,106,.23);background:rgba(5,15,19,.58);display:flex;align-items:center;gap:4px}.kw-hud-gem{width:6px;height:6px;transform:rotate(45deg);background:linear-gradient(135deg,#ffe29a,#c48f2a)}.kw-hud-gold-label{color:#d6bf7f;font:700 6px Georgia,serif}.kw-hud-gold-value{margin-left:auto;color:#fff0bd;font:900 8.5px Georgia,serif}

/* Metadata secundaria: sigue viva y owner-backed, pero no roba FOV mientras exploras. */
.kw-hud-details{display:grid;grid-template-columns:1fr;gap:2px;max-height:0;margin-top:0;opacity:0;overflow:hidden;pointer-events:none;transition:max-height .18s ease,opacity .14s ease,margin-top .18s ease}.kw-player-hud.expanded .kw-hud-details{max-height:86px;margin-top:4px;opacity:1;pointer-events:auto}
.kw-hud-detail{min-width:0;min-height:18px;padding:2px 5px;border-radius:6px;border:1px solid rgba(231,197,106,.18);background:rgba(5,16,20,.52);display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:4px}.kw-hud-detail small{color:#9eaa9e;font:700 5px Georgia,serif;text-transform:uppercase;letter-spacing:.04em}.kw-hud-detail strong,.kw-hud-detail b{min-width:0;color:#f0dfad;font:800 6.7px Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kw-hud-nobility strong{color:#ffe59a}
.kw-guide{position:relative;pointer-events:auto;display:grid;place-items:center;width:44px;min-height:44px;margin-top:2px;border-radius:11px;border:1px solid rgba(231,197,106,.43);background:linear-gradient(145deg,rgba(12,31,34,.91),rgba(5,15,19,.94));box-shadow:0 4px 12px rgba(0,0,0,.22);color:#e7c56a;text-decoration:none;font:900 16px Georgia,serif;touch-action:manipulation}.kw-guide span{transform:translateY(-1px)}
.kw-hud-avatar:active,.kw-hud-copy:active,.kw-hud-more:active,.kw-guide:active{transform:scale(.95)}.kw-hud-avatar:focus-visible,.kw-hud-copy:focus-visible,.kw-hud-more:focus-visible,.kw-guide:focus-visible{outline:2px solid #f4d77f;outline-offset:2px}

/* El rail pasa de una columna gigante a un bloque 2x2 de controles de 44px. */
#kelo-luxe .lx-top{display:none!important}
#kelo-luxe .lx-rail{top:max(6px,env(safe-area-inset-top))!important;right:max(6px,env(safe-area-inset-right))!important;width:94px!important;display:grid!important;grid-template-columns:repeat(2,44px)!important;grid-auto-rows:44px!important;gap:6px!important;align-items:center!important;justify-items:center!important}
#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #kelo-orientation-btn,#kelo-luxe #lx-shop{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important;border-radius:13px!important;display:grid!important;place-items:center!important;gap:0!important;box-shadow:0 6px 16px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.025)!important}
#kelo-luxe .lx-side-menu b,#kelo-luxe .lx-side-pvp b{font-size:20px!important;line-height:1!important}#kelo-luxe .lx-side-menu span,#kelo-luxe .lx-side-pvp span{display:none!important}
#kelo-luxe #kelo-orientation-btn .kelo-fullscreen-icon{width:20px!important;height:20px!important}#kelo-luxe #kelo-orientation-btn [data-fullscreen-primary],#kelo-luxe #kelo-orientation-btn [data-fullscreen-secondary]{display:none!important}
#kelo-luxe #lx-shop{font:900 21px/1 Georgia,serif!important;color:var(--lx-gold,#e7c56a)!important;background:linear-gradient(145deg,rgba(22,45,39,.94),rgba(8,18,20,.96))!important;border:1px solid rgba(231,197,106,.52)!important}

@media(max-width:360px){#kw-player-hud-wrap{width:clamp(146px,45vw,158px)}.kw-hud-core{grid-template-columns:36px minmax(0,1fr);gap:4px}.kw-hud-avatar{width:36px;height:36px;border-radius:8px}.kw-hud-name{font-size:10px}.kw-hud-head{grid-template-columns:minmax(0,1fr) 22px}.kw-hud-more{width:22px;height:22px}.kw-hud-resource{grid-template-columns:11px minmax(0,1fr);gap:2px}.kw-hud-resource-icon{width:11px;height:11px}.kw-hud-gold{height:16px}.kw-hud-gold-value{font-size:8px}#kelo-luxe .lx-rail{width:90px!important;grid-template-columns:repeat(2,42px)!important;grid-auto-rows:42px!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #kelo-orientation-btn,#kelo-luxe #lx-shop{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important}}
@media(max-height:520px) and (orientation:landscape){#kw-player-hud-wrap{width:154px;top:max(4px,env(safe-area-inset-top));left:max(4px,env(safe-area-inset-left))}.kw-player-hud{padding:3px}.kw-hud-core{grid-template-columns:34px minmax(0,1fr)}.kw-hud-avatar{width:34px;height:34px}.kw-hud-id-row{display:none}.kw-hud-gold{height:15px;margin-top:2px}.kw-guide{width:40px;min-height:40px;margin-top:1px}#kelo-luxe .lx-rail{top:max(4px,env(safe-area-inset-top))!important;right:max(4px,env(safe-area-inset-right))!important}}
@media(prefers-reduced-motion:reduce){.kw-hud-details,.kw-hud-bar i,.kw-hud-more{transition:none!important}}
`;
document.head.appendChild(style);

const wrap=document.createElement('div');
wrap.id='kw-player-hud-wrap';
wrap.innerHTML=`<section class="kw-player-hud" id="kw-player-hud-card" aria-label="Estado rápido del héroe">
  <div class="kw-hud-core">
    <button class="kw-hud-avatar" id="kw-hud-avatar" type="button" aria-label="Abrir perfil"><span class="kw-hud-avatar-img sprite" id="kw-hud-avatar-img"></span></button>
    <div class="kw-hud-main">
      <div class="kw-hud-head"><div class="kw-hud-name" id="kw-hud-name">Héroe</div><button class="kw-hud-more" id="kw-hud-more" type="button" aria-expanded="false" aria-controls="kw-hud-details" aria-label="Mostrar clan, nobleza y título">⌄</button></div>
      <div class="kw-hud-id-row"><span id="kw-hud-id">ID —</span><button class="kw-hud-copy" id="kw-hud-copy" type="button" aria-label="Copiar ID del jugador">⧉</button></div>
      <div class="kw-hud-resources">
        <div class="kw-hud-resource kw-hud-hp"><span class="kw-hud-resource-icon" aria-hidden="true">♥</span><span class="kw-hud-resource-main"><span class="kw-hud-resource-head"><b>Vida</b><span id="kw-hud-hp-text">— / —</span></span><span class="kw-hud-bar" role="progressbar" id="kw-hud-hp-bar" aria-label="Vida"><i></i></span></span></div>
        <div class="kw-hud-resource kw-hud-mana" id="kw-hud-mana-row"><span class="kw-hud-resource-icon" aria-hidden="true">◆</span><span class="kw-hud-resource-main"><span class="kw-hud-resource-head"><b>Maná</b><span id="kw-hud-mana-text">— / —</span></span><span class="kw-hud-bar" role="progressbar" id="kw-hud-mana-bar" aria-label="Maná"><i></i></span></span></div>
      </div>
    </div>
    <div class="kw-hud-gold"><span class="kw-hud-gem" aria-hidden="true"></span><span class="kw-hud-gold-label">Oro</span><strong class="kw-hud-gold-value" id="lx-gold">0</strong></div>
  </div>
  <div class="kw-hud-details" id="kw-hud-details" aria-label="Prestigio del jugador">
    <div class="kw-hud-detail"><small>Clan</small><b id="kw-hud-clan">Sin clan</b></div>
    <div class="kw-hud-detail kw-hud-nobility"><small>Nobleza</small><strong id="kw-hud-nobility">Sin nobleza</strong></div>
    <div class="kw-hud-detail"><small>Título</small><strong id="kw-hud-title">Ninguno</strong></div>
  </div>
</section><a class="kw-guide" id="kw-player-guide" href="guide.html" aria-label="Abrir guía de mecánicas" title="Guía"><span aria-hidden="true">▤</span></a>`;
luxe.appendChild(wrap);

const byId=id=>document.getElementById(id);
const el={name:byId('kw-hud-name'),id:byId('kw-hud-id'),clan:byId('kw-hud-clan'),nobility:byId('kw-hud-nobility'),title:byId('kw-hud-title'),hpText:byId('kw-hud-hp-text'),hpBar:byId('kw-hud-hp-bar'),manaText:byId('kw-hud-mana-text'),manaBar:byId('kw-hud-mana-bar'),manaRow:byId('kw-hud-mana-row'),gold:byId('lx-gold'),avatar:byId('kw-hud-avatar-img'),card:byId('kw-player-hud-card'),more:byId('kw-hud-more')};
let last={};

function worldState(){try{if(typeof STATE!=='undefined')return STATE;}catch(e){}return root.STATE||null;}
function player(){try{if(typeof localPlayer!=='undefined')return localPlayer;}catch(e){}return root.localPlayer||null;}
function cleanName(value){return String(value||'Héroe').replace(/\s*\(Tu\)\s*$/,'').trim()||'Héroe';}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function findClan(p,state){const candidates=[p?.clan?.name,p?.clanName,p?.clan,state?.playerProfile?.clan?.name,state?.playerProfile?.clanName,state?.playerProfile?.clan];for(const value of candidates){if(typeof value==='string'&&value.trim())return value.trim();}return 'Sin clan';}
function findNobility(p){try{const rank=root.KeloNobility?.getRank?.();if(rank?.name)return rank.name;}catch(e){}return p?.nobilityTitle||p?.nobilityRank||'Sin nobleza';}
function findTitle(){try{const id=root.KeloTitles?.getEquipped?.();if(!id)return 'Ninguno';return root.KeloTitles?.getTitle?.(id)?.name||id;}catch(e){return 'Ninguno';}}
function findMana(p,state){const current=finite(p?.mana??state?.playerProfile?.mana);const max=finite(p?.maxMana??state?.playerProfile?.maxMana);return current!==null&&max!==null&&max>0?{current:Math.max(0,current),max:Math.max(1,max)}:null;}
function findAvatar(p,state){const url=p?.avatarUrl||p?.avatar||state?.playerProfile?.avatarUrl||state?.playerProfile?.avatar;if(typeof url==='string'&&url.trim())return {url:url.trim(),sprite:false};return {url:'assets/hero.PNG?hero=deeab966',sprite:true};}
function snapshot(){const p=player()||{};const state=worldState()||{};const hp=finite(p.hp),maxHp=finite(p.maxHp);return Object.freeze({id:String(p.id||state.playerProfile?.id||'local_pioneer'),name:cleanName(p.name||state.playerProfile?.name),clan:findClan(p,state),nobility:String(findNobility(p)),title:String(findTitle()),hp:hp===null?null:Math.max(0,hp),maxHp:maxHp===null?null:Math.max(1,maxHp),mana:findMana(p,state),gold:Math.max(0,finite(state.gold)??finite(state.playerProfile?.gold)??0),avatar:findAvatar(p,state)});}
function setText(node,key,value){if(!node||last[key]===value)return;node.textContent=value;last[key]=value;}
function setBar(node,row,key,current,max){if(!node)return;const available=current!==null&&max!==null&&max>0;const ratio=available?Math.max(0,Math.min(1,current/max)):0;const pct=Math.round(ratio*100);const sig=(available?current:'x')+'/'+(available?max:'x');if(last[key]===sig)return;last[key]=sig;node.setAttribute('aria-valuemin','0');if(available){node.setAttribute('aria-valuemax',String(max));node.setAttribute('aria-valuenow',String(current));node.querySelector('i').style.width=pct+'%';row?.classList.remove('unavailable');}else{node.removeAttribute('aria-valuemax');node.removeAttribute('aria-valuenow');node.querySelector('i').style.width='0%';row?.classList.add('unavailable');}}
function refresh(){const s=snapshot();setText(el.name,'name',s.name);setText(el.id,'id','ID '+s.id);setText(el.clan,'clan',s.clan);setText(el.nobility,'nobility',s.nobility);setText(el.title,'title',s.title);setText(el.gold,'gold',Math.floor(s.gold).toLocaleString('es-ES'));const hpOk=s.hp!==null&&s.maxHp!==null;setText(el.hpText,'hpText',hpOk?Math.floor(s.hp)+' / '+Math.floor(s.maxHp):'— / —');setBar(el.hpBar,el.hpBar?.closest('.kw-hud-resource'),'hpBar',s.hp,s.maxHp);const mana=s.mana;setText(el.manaText,'manaText',mana?Math.floor(mana.current)+' / '+Math.floor(mana.max):'— / —');setBar(el.manaBar,el.manaRow,'manaBar',mana?.current??null,mana?.max??null);const avatarSig=s.avatar.url+'|'+s.avatar.sprite;if(last.avatar!==avatarSig){last.avatar=avatarSig;el.avatar.style.backgroundImage='url("'+String(s.avatar.url).replace(/"/g,'%22')+'")';el.avatar.classList.toggle('sprite',!!s.avatar.sprite);}return s;}
function toast(message){try{if(typeof showToast==='function'){showToast(message);return;}}catch(e){}if(typeof root.showToast==='function')root.showToast(message);}
function openProfile(){const p=player();if(!p)return;try{if(typeof inspectPlayer==='function'){inspectPlayer(p,true);return;}}catch(e){}if(typeof root.inspectPlayer==='function')root.inspectPlayer(p,true);}
function setExpanded(force){const next=typeof force==='boolean'?force:!el.card?.classList.contains('expanded');el.card?.classList.toggle('expanded',next);el.more?.setAttribute('aria-expanded',String(next));el.more?.setAttribute('aria-label',next?'Ocultar clan, nobleza y título':'Mostrar clan, nobleza y título');return next;}

byId('kw-hud-copy')?.addEventListener('click',async()=>{const id=snapshot().id;try{await navigator.clipboard.writeText(id);toast('ID copiado');}catch(e){toast('ID: '+id);}});
byId('kw-hud-avatar')?.addEventListener('click',openProfile);
byId('kw-hud-more')?.addEventListener('click',()=>setExpanded());

// Actualización por eventos/interacciones; no existe loop ni polling continuo.
const eventNames=['title:equipped','title:unequipped','title:unlocked','player:stat_changed','player:state_changed','profile:changed','clan:changed','nobility:changed','wallet:changed','economy:changed','combat:entity_damaged','combat:damage_applied'];
if(root.KeloEvents?.on)eventNames.forEach(name=>root.KeloEvents.on(name,refresh));
['kelo:character-customization-ready','pageshow','focus','online'].forEach(name=>root.addEventListener?.(name,refresh));
document.addEventListener('pointerup',()=>queueMicrotask(refresh),{capture:true,passive:true});
document.addEventListener('keyup',()=>queueMicrotask(refresh),{capture:true,passive:true});
refresh();
requestAnimationFrame(refresh);
root.KELO_LUXE_PLAYER_HUD=Object.freeze({version:'luxe-player-hud-v1.0.0',layout:'world-first-compact-v2',refresh,snapshot,setExpanded,owner:'Kelo Luxe Shell presentation',polling:false});
})(typeof globalThis!=='undefined'?globalThis:window);

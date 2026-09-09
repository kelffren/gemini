/* KELO-INDEX
 * area: UI / HUD
 * owner: Kelo Luxe Shell presentation
 * keys: COMBAT HUD PVP HP MANA GUIDE MOBILE RAIL BOUTIQUE MENU FULLSCREEN
 * purpose: prioriza el paisaje: en social no hay player HUD; en zonas PvP aparece únicamente Vida/Maná y el rail lateral conserva accesos persistentes
 * public-api: KELO_LUXE_PLAYER_HUD.refresh/snapshot
 * consumes: localPlayer, STATE, KeloPvPWorld, KeloEvents, Luxe Shell, KELO_ORIENTATION
 * state-owned: solo cache visual del último snapshot
 * reuse: reutiliza los botones/handlers reales de Boutique, Menú, PvP y Pantalla Completa; GUÍA es el único acceso añadido al mismo rail
 * do-not: NO gameplay state, NO polling/setInterval, NO player profile duplicado, NO oro/nobleza/título/clan permanentes
 * online: presentación solamente; la autoridad de combate/recursos permanece en sus owners
 */
(function(root){
'use strict';
if(typeof document==='undefined'||document.getElementById('kw-player-hud-wrap'))return;
const luxe=document.getElementById('kelo-luxe');
if(!luxe)return;
luxe.querySelector('.lx-gold')?.remove();
luxe.querySelector('.lx-presence')?.remove();
const rail=luxe.querySelector('.lx-rail');
const shop=document.getElementById('lx-shop');
const menu=document.getElementById('lx-side-menu');
const pvp=document.getElementById('lx-side-pvp');
const fullscreen=document.getElementById('kelo-orientation-btn');
let guide=document.getElementById('kw-player-guide');
if(shop){shop.classList.add('lx-side-shop');shop.textContent='Boutique';shop.setAttribute('aria-label','Abrir Boutique');shop.setAttribute('title','Boutique');}
if(!guide){guide=document.createElement('a');guide.id='kw-player-guide';guide.className='lx-side-guide';guide.href='guide.html';guide.setAttribute('aria-label','Abrir guía');guide.innerHTML='<b aria-hidden="true">▤</b><span>GUÍA</span>';}
if(rail)[shop,menu,pvp,guide,fullscreen].filter(Boolean).forEach(node=>rail.appendChild(node));
/* lx-top conserva un spacer decorativo aun tras mover Boutique; la superficie completa ya no tiene función. */
const oldTop=luxe.querySelector('.lx-top');if(oldTop)oldTop.remove();
const style=document.createElement('style');style.id='kw-player-hud-style';style.textContent=`
#kw-player-hud-wrap{position:absolute;top:max(7px,env(safe-area-inset-top));left:max(7px,env(safe-area-inset-left));width:clamp(146px,40vw,174px);z-index:86;pointer-events:none;color:#fff4d6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:none}
body:not(.social-mode) #kw-player-hud-wrap{display:block}
.kw-combat-hud{position:relative;padding:6px 7px;border:1px solid rgba(231,197,106,.58);border-radius:11px;background:linear-gradient(145deg,rgba(7,24,30,.91),rgba(4,13,18,.95));box-shadow:0 7px 18px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.025);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.kw-combat-hud:before{content:"";position:absolute;inset:3px;border:1px solid rgba(231,197,106,.08);border-radius:8px;pointer-events:none}
.kw-combat-row{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr);gap:5px;align-items:center}.kw-combat-row+.kw-combat-row{margin-top:5px}
.kw-combat-icon{width:14px;height:14px;display:grid;place-items:center;color:#f0dba1;font-size:8px;line-height:1}.kw-combat-main{min-width:0}.kw-combat-head{display:flex;align-items:baseline;justify-content:space-between;gap:5px;font-size:6px;line-height:1}.kw-combat-head b{color:#f5e8bf;font:800 7px/1 Georgia,serif}.kw-combat-head span{color:#d4ded8;font-size:6px;font-variant-numeric:tabular-nums}
.kw-combat-bar{display:block;width:100%;height:6px;margin-top:2px;border-radius:99px;overflow:hidden;background:rgba(0,6,9,.76);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}.kw-combat-bar i{display:block;height:100%;width:0;transition:width .16s ease}.kw-combat-hp i{background:linear-gradient(90deg,#941016,#ef473a);box-shadow:0 0 6px rgba(239,71,58,.24)}.kw-combat-mana i{background:linear-gradient(90deg,#0752a6,#22a6f5);box-shadow:0 0 6px rgba(34,166,245,.22)}.kw-combat-row.unavailable{opacity:.5}.kw-combat-row.unavailable .kw-combat-bar i{width:0!important}
#kelo-luxe .lx-rail{position:absolute!important;top:max(10px,env(safe-area-inset-top))!important;right:max(8px,env(safe-area-inset-right))!important;width:64px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important;pointer-events:auto!important}
#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{position:relative!important;isolation:isolate!important;width:64px!important;min-width:64px!important;height:58px!important;min-height:58px!important;margin:0!important;padding:5px 3px!important;border-radius:18px!important;border:1px solid rgba(231,197,106,.58)!important;background:linear-gradient(145deg,rgba(23,39,35,.96),rgba(6,14,17,.98))!important;color:#fff4d6!important;box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.035)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;text-decoration:none!important;pointer-events:auto!important;touch-action:manipulation!important;overflow:hidden!important}
#kelo-luxe .lx-side-menu:before,#kelo-luxe .lx-side-pvp:before,#kelo-luxe #lx-shop:before,#kelo-luxe .lx-side-guide:before,#kelo-luxe #kelo-orientation-btn:before{content:"";position:absolute;inset:-34%;z-index:-1;background:radial-gradient(circle,rgba(231,197,106,.13),transparent 60%)}
#kelo-luxe .lx-side-menu b,#kelo-luxe .lx-side-pvp b,#kelo-luxe .lx-side-guide b{color:#e7c56a!important;font:800 22px/1 Georgia,serif!important;text-shadow:0 0 10px rgba(231,197,106,.22)}
#kelo-luxe .lx-side-menu span,#kelo-luxe .lx-side-pvp span,#kelo-luxe .lx-side-guide span{display:block!important;color:#e8cf84!important;font:850 8px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.12em!important}
#kelo-luxe #lx-shop{font:800 12px/1 Georgia,serif!important;color:#f0d27d!important;letter-spacing:0!important}
#kelo-luxe #kelo-orientation-btn .kelo-fullscreen-icon{width:22px!important;height:22px!important;color:#e7c56a!important}#kelo-luxe #kelo-orientation-btn [data-fullscreen-primary]{display:block!important;color:#fff4d6!important;font-size:6px!important;line-height:1!important;letter-spacing:.07em!important}#kelo-luxe #kelo-orientation-btn [data-fullscreen-secondary]{display:block!important;color:#9eb0aa!important;font-size:5.4px!important;line-height:1!important;letter-spacing:.055em!important}
#kelo-luxe .lx-side-menu:active,#kelo-luxe .lx-side-pvp:active,#kelo-luxe #lx-shop:active,#kelo-luxe .lx-side-guide:active,#kelo-luxe #kelo-orientation-btn:active{transform:scale(.95)!important;border-color:#e7c56a!important}
@media(max-width:360px){#kw-player-hud-wrap{width:142px}#kelo-luxe .lx-rail{width:58px!important;right:max(6px,env(safe-area-inset-right))!important;gap:7px!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{width:58px!important;min-width:58px!important;height:54px!important;min-height:54px!important;border-radius:16px!important}#kelo-luxe #lx-shop{font-size:10.5px!important}}
@media(max-height:620px){#kelo-luxe .lx-rail{gap:5px!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{height:48px!important;min-height:48px!important;border-radius:15px!important}#kelo-luxe .lx-side-menu b,#kelo-luxe .lx-side-pvp b,#kelo-luxe .lx-side-guide b{font-size:18px!important}#kelo-luxe .lx-side-menu span,#kelo-luxe .lx-side-pvp span,#kelo-luxe .lx-side-guide span{font-size:7px!important}#kw-player-hud-wrap{top:max(5px,env(safe-area-inset-top));width:148px}.kw-combat-hud{padding:5px 6px}}
@media(max-height:430px) and (orientation:landscape){#kelo-luxe .lx-rail{top:max(4px,env(safe-area-inset-top))!important;gap:4px!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{width:54px!important;min-width:54px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}#kelo-luxe .lx-rail{width:54px!important}.kw-combat-row+.kw-combat-row{margin-top:3px}.kw-combat-bar{height:5px}}
@media(prefers-reduced-motion:reduce){.kw-combat-bar i{transition:none!important}}
`;document.head.appendChild(style);
const wrap=document.createElement('div');wrap.id='kw-player-hud-wrap';wrap.innerHTML=`<section class="kw-combat-hud" aria-label="Estado de combate"><div class="kw-combat-row kw-combat-hp" id="kw-hud-hp-row"><span class="kw-combat-icon" aria-hidden="true">♥</span><span class="kw-combat-main"><span class="kw-combat-head"><b>Vida</b><span id="kw-hud-hp-text">— / —</span></span><span class="kw-combat-bar" id="kw-hud-hp-bar" role="progressbar" aria-label="Vida"><i></i></span></span></div><div class="kw-combat-row kw-combat-mana" id="kw-hud-mana-row"><span class="kw-combat-icon" aria-hidden="true">◆</span><span class="kw-combat-main"><span class="kw-combat-head"><b>Maná</b><span id="kw-hud-mana-text">— / —</span></span><span class="kw-combat-bar" id="kw-hud-mana-bar" role="progressbar" aria-label="Maná"><i></i></span></span></div></section>`;luxe.appendChild(wrap);
const byId=id=>document.getElementById(id),finite=v=>Number.isFinite(Number(v))?Number(v):null,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let last=null;
function snapshot(){const p=typeof localPlayer!=='undefined'?localPlayer:null,state=typeof STATE!=='undefined'?STATE:{},hp=finite(p?.hp),maxHp=finite(p?.maxHp),mana=finite(p?.mana??state?.playerProfile?.mana),maxMana=finite(p?.maxMana??state?.playerProfile?.maxMana),pvpState=root.KeloPvPWorld?.state;return Object.freeze({hp,maxHp,mana,maxMana,combatEnabled:!!(root.KELO_COMBAT_ENABLED||pvpState?.combatEnabled),mode:pvpState?.mode||((document.body?.classList.contains('social-mode'))?'social':'combat')});}
function setBar(rowId,barId,textId,value,max){const row=byId(rowId),bar=byId(barId),text=byId(textId),fill=bar?.querySelector('i'),available=value!=null&&max!=null&&max>0;row?.classList.toggle('unavailable',!available);if(text)text.textContent=available?`${Math.round(value)} / ${Math.round(max)}`:'— / —';const pct=available?clamp((value/max)*100,0,100):0;if(fill)fill.style.width=pct+'%';if(bar){bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',available?String(max):'0');bar.setAttribute('aria-valuenow',available?String(value):'0');bar.setAttribute('aria-valuetext',available?`${Math.round(value)} de ${Math.round(max)}`:'No disponible');}}
function refresh(){last=snapshot();setBar('kw-hud-hp-row','kw-hud-hp-bar','kw-hud-hp-text',last.hp,last.maxHp);setBar('kw-hud-mana-row','kw-hud-mana-bar','kw-hud-mana-text',last.mana,last.maxMana);return last;}
const eventNames=['player:stat_changed','player:state_changed','combat:entity_damaged','combat:damage_applied','ability:cast','ability:resource_changed'];if(root.KeloEvents?.on)eventNames.forEach(name=>root.KeloEvents.on(name,refresh));['pageshow','focus','online'].forEach(name=>root.addEventListener?.(name,refresh));document.addEventListener('pointerup',()=>queueMicrotask(refresh),{capture:true,passive:true});document.addEventListener('keyup',()=>queueMicrotask(refresh),{capture:true,passive:true});refresh();requestAnimationFrame(refresh);
root.KELO_LUXE_PLAYER_HUD=Object.freeze({version:'luxe-player-hud-v1.1.0',layout:'pvp-only-combat-v1',visibility:'pvp-only',rail:'vertical-five',refresh,snapshot,owner:'Kelo Luxe Shell presentation',polling:false});
})(typeof globalThis!=='undefined'?globalThis:window);

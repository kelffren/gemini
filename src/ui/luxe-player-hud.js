/* KELO-INDEX
 * area: UI / HUD
 * owner: Kelo Luxe Shell presentation
 * keys: PLAYER HUD PROFILE NOBILITY TITLE CLAN HP MANA GOLD GUIDE MOBILE
 * purpose: subcomponente HUD del Luxe Shell; presenta identidad/recursos consumiendo owners existentes sin poseer gameplay
 * public-api: KELO_LUXE_PLAYER_HUD.refresh/snapshot
 * consumes: localPlayer, STATE, KeloNobility, KeloTitles, KeloEvents, legacy inspectPlayer adapter
 * state-owned: solo cache visual del último snapshot renderizado
 * extension-points: futuros owners pueden exponer avatar/clan/mana en localPlayer o STATE sin rehacer el HUD
 * reuse: HUD superior izquierdo único del jugador local
 * legacy: reemplaza las piezas .lx-gold/.lx-presence del shell anterior; no crea otra economía/HP/maná
 * do-not: NO mutar gameplay, NO polling/setInterval, NO inventar recursos ausentes
 * online: solo lectura/presentación; IDs/rangos/títulos/recursos siguen perteneciendo a sus capas de autoridad
 */
(function(root){
'use strict';
if(typeof document==='undefined'||document.getElementById('kw-player-hud-wrap'))return;

const luxe=document.getElementById('kelo-luxe');
if(!luxe)return;

// Retiro real del HUD compacto anterior: estas piezas dejan de existir en DOM; no se ocultan.
luxe.querySelector('.lx-gold')?.remove();
luxe.querySelector('.lx-presence')?.remove();

const style=document.createElement('style');
style.id='kw-player-hud-style';
style.textContent=`
#kw-player-hud-wrap{position:absolute;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));width:clamp(244px,74vw,306px);pointer-events:none;z-index:86;color:#fff4d6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.kw-player-hud{position:relative;overflow:hidden;padding:8px;border:1px solid rgba(231,197,106,.72);border-radius:18px;background:radial-gradient(circle at 52% 16%,rgba(39,76,72,.28),transparent 38%),linear-gradient(145deg,rgba(7,28,36,.965),rgba(5,16,23,.985) 68%);box-shadow:0 12px 34px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.035),inset 0 0 28px rgba(15,73,78,.12)}
.kw-player-hud:before{content:"";position:absolute;inset:4px;border:1px solid rgba(231,197,106,.13);border-radius:14px;pointer-events:none}.kw-player-hud:after{content:"◆";position:absolute;bottom:-5px;left:50%;transform:translateX(-50%) rotate(45deg);color:#e7c56a;font:8px Georgia,serif;text-shadow:0 0 8px rgba(231,197,106,.5)}
.kw-hud-top{position:relative;display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;align-items:start}.kw-hud-left{display:grid;gap:5px}.kw-hud-avatar{position:relative;width:62px;height:62px;padding:0;border-radius:15px;border:2px solid #d8b656;background:#07141a;overflow:hidden;box-shadow:0 5px 14px rgba(0,0,0,.34),0 0 12px rgba(231,197,106,.12);pointer-events:auto}.kw-hud-avatar-img{position:absolute;inset:0;background-repeat:no-repeat;background-position:0 0;background-size:cover}.kw-hud-avatar-img.sprite{background-size:400% 400%;background-position:0 0}.kw-hud-avatar:after{content:"◆";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%) rotate(45deg);font:7px Georgia,serif;color:#f3d57e;background:#0a1c23;padding:1px 3px}
.kw-hud-clan{min-height:31px;padding:4px 5px;border-radius:9px;border:1px solid rgba(231,197,106,.35);background:rgba(4,16,22,.72);display:grid;grid-template-columns:17px minmax(0,1fr);gap:4px;align-items:center}.kw-hud-clan-icon{width:17px;height:20px;display:grid;place-items:center;border:1px solid rgba(231,197,106,.55);border-radius:5px 5px 8px 8px;color:#e9c968;font:10px Georgia,serif}.kw-hud-clan-copy{min-width:0;line-height:1}.kw-hud-clan-copy small{display:block;color:#8fa39e;font-size:6px;text-transform:uppercase;letter-spacing:.08em}.kw-hud-clan-copy b{display:block;margin-top:2px;color:#f1dfaa;font:700 8px Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kw-hud-identity{min-width:0}.kw-hud-name-row{display:flex;align-items:flex-start;gap:5px}.kw-hud-name{min-width:0;flex:1;color:#fff3cb;font:800 clamp(13px,4vw,17px)/1.05 Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 12px rgba(231,197,106,.14)}.kw-hud-id-row{display:flex;align-items:center;gap:4px;margin-top:3px;color:#9eaea9;font-size:7px;letter-spacing:.05em}.kw-hud-copy{width:44px;height:44px;margin:-16px -6px -16px auto;border:1px solid rgba(231,197,106,.24);border-radius:11px;background:rgba(9,25,30,.58);color:#e7c56a;pointer-events:auto;font-size:11px}.kw-hud-copy:active,.kw-hud-avatar:active{transform:scale(.96)}.kw-hud-copy:focus-visible,.kw-hud-avatar:focus-visible,.kw-guide:focus-visible{outline:2px solid #f4d77f;outline-offset:2px}
.kw-hud-prestige{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(72px,.8fr);gap:5px;margin-top:6px}.kw-hud-nobility{position:relative;min-height:49px;padding:6px 7px 6px 41px;border:1px solid rgba(238,202,101,.92);border-radius:11px;background:radial-gradient(circle at 18% 45%,rgba(232,186,66,.26),transparent 35%),linear-gradient(145deg,rgba(38,47,32,.84),rgba(7,23,28,.94));box-shadow:0 0 18px rgba(231,197,106,.2),inset 0 0 0 1px rgba(255,231,160,.08)}.kw-hud-crown{position:absolute;left:7px;top:50%;transform:translateY(-52%);font:30px/1 Georgia,serif;color:#f3cd62;text-shadow:0 0 12px rgba(243,205,98,.5)}.kw-hud-nobility small,.kw-hud-title small{display:block;color:#e3c86f;font:700 6px Georgia,serif;text-transform:uppercase;letter-spacing:.1em}.kw-hud-nobility strong{display:block;margin-top:1px;color:#fff1b8;font:900 20px/1 Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 13px rgba(231,197,106,.3)}.kw-hud-title{min-width:0;padding:7px 7px;border:1px solid rgba(231,197,106,.38);border-radius:11px;background:rgba(6,20,26,.78);display:flex;flex-direction:column;justify-content:center}.kw-hud-title strong{display:block;margin-top:2px;color:#f5e6bd;font:800 11px/1.05 Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kw-hud-resources{display:grid;gap:5px;margin-top:6px}.kw-hud-resource{display:grid;grid-template-columns:25px minmax(0,1fr);gap:6px;align-items:center}.kw-hud-resource-icon{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(231,197,106,.48);background:#07151a;font-size:13px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}.kw-hud-resource-main{min-width:0}.kw-hud-resource-head{display:flex;justify-content:space-between;gap:6px;align-items:baseline;color:#d9e2dc;font-size:7px}.kw-hud-resource-head b{color:#f4e7bf;font:800 8px Georgia,serif}.kw-hud-bar{height:7px;margin-top:2px;border-radius:99px;overflow:hidden;border:1px solid rgba(231,197,106,.36);background:#061116;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)}.kw-hud-bar i{display:block;height:100%;width:0;transition:width .2s ease}.kw-hud-hp i{background:linear-gradient(90deg,#a81216,#f04436);box-shadow:0 0 8px rgba(239,68,54,.32)}.kw-hud-mana i{background:linear-gradient(90deg,#0759b8,#21a5ff);box-shadow:0 0 8px rgba(33,165,255,.28)}.kw-hud-resource.unavailable{opacity:.58}.kw-hud-resource.unavailable .kw-hud-bar i{width:0!important}
.kw-hud-gold{margin-top:6px;height:30px;padding:0 9px;border-radius:10px;border:1px solid rgba(231,197,106,.45);background:linear-gradient(90deg,rgba(9,26,30,.92),rgba(5,17,23,.92));display:flex;align-items:center;gap:7px}.kw-hud-gem{width:12px;height:12px;transform:rotate(45deg);background:linear-gradient(135deg,#ffe59a,#c48e27);box-shadow:0 0 9px rgba(231,197,106,.3)}.kw-hud-gold-label{color:#e8d391;font:800 10px Georgia,serif}.kw-hud-gold-value{margin-left:auto;color:#fff0bd;font:900 15px Georgia,serif}
.kw-guide{pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;margin-top:5px;padding:0 13px;border-radius:12px;border:1px solid rgba(231,197,106,.55);background:linear-gradient(145deg,rgba(13,34,37,.97),rgba(5,16,21,.98));box-shadow:0 7px 19px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.035);color:#edcf76;text-decoration:none;font:850 9px Georgia,serif;letter-spacing:.08em}.kw-guide:active{transform:scale(.97)}
@media(max-width:360px){#kw-player-hud-wrap{width:calc(100vw - 78px - max(16px,env(safe-area-inset-left)))}.kw-player-hud{padding:6px;border-radius:15px}.kw-hud-top{grid-template-columns:54px minmax(0,1fr);gap:6px}.kw-hud-avatar{width:54px;height:54px;border-radius:13px}.kw-hud-clan{padding:3px;grid-template-columns:15px minmax(0,1fr)}.kw-hud-clan-icon{width:15px;height:18px}.kw-hud-clan-copy b{font-size:7px}.kw-hud-prestige{gap:4px}.kw-hud-nobility{min-height:45px;padding-left:35px}.kw-hud-crown{left:5px;font-size:25px}.kw-hud-nobility strong{font-size:16px}.kw-hud-title{padding:5px}.kw-hud-title strong{font-size:9px}.kw-hud-resources{gap:4px;margin-top:5px}.kw-hud-resource{grid-template-columns:22px minmax(0,1fr);gap:5px}.kw-hud-resource-icon{width:22px;height:22px;font-size:11px}.kw-hud-gold{height:27px;margin-top:5px}.kw-hud-gold-value{font-size:13px}}
@media(max-height:520px) and (orientation:landscape){#kw-player-hud-wrap{width:270px}.kw-hud-clan{display:none}.kw-hud-top{grid-template-columns:48px minmax(0,1fr)}.kw-hud-avatar{width:48px;height:48px}.kw-hud-prestige{margin-top:3px}.kw-hud-resources{grid-template-columns:1fr 1fr;gap:6px}.kw-hud-gold{height:25px}.kw-guide{min-height:36px}}
`;
document.head.appendChild(style);

const wrap=document.createElement('div');
wrap.id='kw-player-hud-wrap';
wrap.innerHTML=`<section class="kw-player-hud" aria-label="Perfil rápido del héroe">
  <div class="kw-hud-top">
    <div class="kw-hud-left">
      <button class="kw-hud-avatar" id="kw-hud-avatar" type="button" aria-label="Abrir perfil"><span class="kw-hud-avatar-img sprite" id="kw-hud-avatar-img"></span></button>
      <div class="kw-hud-clan"><span class="kw-hud-clan-icon" aria-hidden="true">♜</span><span class="kw-hud-clan-copy"><small>Clan</small><b id="kw-hud-clan">Sin clan</b></span></div>
    </div>
    <div class="kw-hud-identity">
      <div class="kw-hud-name-row"><div class="kw-hud-name" id="kw-hud-name">Héroe</div></div>
      <div class="kw-hud-id-row"><span id="kw-hud-id">ID —</span><button class="kw-hud-copy" id="kw-hud-copy" type="button" aria-label="Copiar ID del jugador">⧉</button></div>
      <div class="kw-hud-prestige">
        <div class="kw-hud-nobility"><span class="kw-hud-crown" aria-hidden="true">♛</span><small>Nobleza</small><strong id="kw-hud-nobility">Sin nobleza</strong></div>
        <div class="kw-hud-title"><small>Título</small><strong id="kw-hud-title">Ninguno</strong></div>
      </div>
      <div class="kw-hud-resources">
        <div class="kw-hud-resource kw-hud-hp"><span class="kw-hud-resource-icon" aria-hidden="true">♥</span><span class="kw-hud-resource-main"><span class="kw-hud-resource-head"><b>Vida</b><span id="kw-hud-hp-text">— / —</span></span><span class="kw-hud-bar" role="progressbar" id="kw-hud-hp-bar" aria-label="Vida"><i></i></span></span></div>
        <div class="kw-hud-resource kw-hud-mana" id="kw-hud-mana-row"><span class="kw-hud-resource-icon" aria-hidden="true">◆</span><span class="kw-hud-resource-main"><span class="kw-hud-resource-head"><b>Maná</b><span id="kw-hud-mana-text">— / —</span></span><span class="kw-hud-bar" role="progressbar" id="kw-hud-mana-bar" aria-label="Maná"><i></i></span></span></div>
      </div>
    </div>
  </div>
  <div class="kw-hud-gold"><span class="kw-hud-gem" aria-hidden="true"></span><span class="kw-hud-gold-label">Oro</span><strong class="kw-hud-gold-value" id="lx-gold">0</strong></div>
</section><a class="kw-guide" id="kw-player-guide" href="guide.html" aria-label="Abrir guía de mecánicas"><span aria-hidden="true">▤</span> GUÍA</a>`;
luxe.appendChild(wrap);

const byId=id=>document.getElementById(id);
const el={name:byId('kw-hud-name'),id:byId('kw-hud-id'),clan:byId('kw-hud-clan'),nobility:byId('kw-hud-nobility'),title:byId('kw-hud-title'),hpText:byId('kw-hud-hp-text'),hpBar:byId('kw-hud-hp-bar'),manaText:byId('kw-hud-mana-text'),manaBar:byId('kw-hud-mana-bar'),manaRow:byId('kw-hud-mana-row'),gold:byId('lx-gold'),avatar:byId('kw-hud-avatar-img')};
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

byId('kw-hud-copy')?.addEventListener('click',async()=>{const id=snapshot().id;try{await navigator.clipboard.writeText(id);toast('ID copiado');}catch(e){toast('ID: '+id);}});
byId('kw-hud-avatar')?.addEventListener('click',openProfile);

// Actualización por eventos/interacciones; no existe loop ni polling continuo.
const eventNames=['title:equipped','title:unequipped','title:unlocked','player:stat_changed','player:state_changed','profile:changed','clan:changed','nobility:changed','wallet:changed','economy:changed','combat:entity_damaged','combat:damage_applied'];
if(root.KeloEvents?.on)eventNames.forEach(name=>root.KeloEvents.on(name,refresh));
['kelo:character-customization-ready','pageshow','focus','online'].forEach(name=>root.addEventListener?.(name,refresh));
document.addEventListener('pointerup',()=>queueMicrotask(refresh),{capture:true,passive:true});
document.addEventListener('keyup',()=>queueMicrotask(refresh),{capture:true,passive:true});
refresh();
requestAnimationFrame(refresh);
root.KELO_LUXE_PLAYER_HUD=Object.freeze({version:'luxe-player-hud-v1.0.0',refresh,snapshot,owner:'Kelo Luxe Shell presentation',polling:false});
})(typeof globalThis!=='undefined'?globalThis:window);

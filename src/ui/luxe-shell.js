(function () {
  if (document.getElementById('kelo-luxe')) return;

  const css = document.createElement('style');
  css.id = 'kelo-luxe-v3-style';
  css.textContent = `
    :root{--lx-ink:#101820;--lx-ink2:#17252a;--lx-forest:#173f36;--lx-gold:#e7c56a;--lx-ivory:#fff4d6;--lx-muted:#aab7ae}
    .top-bar,#kelo-chat,#kelo-stones-btn,#kelo-bag-btn,#kelo-online,.lx-mark,#kelo-minimap,.kelo-minimap,#minimap{display:none!important}
    #kelo-luxe{position:absolute;inset:0;z-index:80;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--lx-ivory)}
    #kelo-luxe *{box-sizing:border-box}
    #kelo-luxe button,#kelo-luxe input{font:inherit}
    .lx-top{position:absolute;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));height:42px;display:flex;align-items:center;gap:7px;pointer-events:auto}
    .lx-gold{height:38px;min-width:94px;padding:0 12px;border-radius:12px;display:flex;align-items:center;gap:7px;background:rgba(11,21,24,.93);border:1px solid rgba(231,197,106,.34);box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:13px;font-weight:800;color:var(--lx-ivory)}
    .lx-gold-dot{width:8px;height:8px;transform:rotate(45deg);background:var(--lx-gold);box-shadow:0 0 0 2px rgba(231,197,106,.14)}
    .lx-presence{height:30px;padding:0 9px;border-radius:999px;display:flex;align-items:center;gap:5px;background:rgba(11,21,24,.82);border:1px solid rgba(255,255,255,.08);font-size:10px;font-weight:700;color:#d7eadc}
    .lx-presence i{width:6px;height:6px;border-radius:50%;background:#88d27c;box-shadow:0 0 8px rgba(136,210,124,.55)}
    .lx-spacer{flex:1}
    .lx-top-btn{height:38px;padding:0 11px;border-radius:12px;border:1px solid rgba(231,197,106,.38);background:rgba(14,28,29,.93);color:var(--lx-gold);font-size:11px;font-weight:800;letter-spacing:.2px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
    .lx-top-btn:active{transform:translateY(1px)}
    .lx-rail{position:absolute;top:max(62px,calc(env(safe-area-inset-top) + 54px));right:max(8px,env(safe-area-inset-right));pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:8px}
    .lx-side-menu,.lx-side-pvp{width:64px;height:64px;padding:5px;border-radius:18px;border:1px solid rgba(231,197,106,.58);background:linear-gradient(145deg,rgba(28,31,25,.98),rgba(10,17,18,.98));color:var(--lx-ivory);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;box-shadow:0 10px 26px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.035);font-size:8px;font-weight:900;letter-spacing:.13em}
    .lx-side-menu b{display:block;color:var(--lx-gold);font-size:23px;line-height:20px;font-family:Georgia,serif;text-shadow:0 0 13px rgba(231,197,106,.24)}
    .lx-side-pvp{height:58px;border-color:rgba(231,197,106,.48)}
    .lx-side-pvp b{display:block;color:var(--lx-ivory);font-size:24px;line-height:21px;text-shadow:0 0 12px rgba(231,197,106,.18)}
    .lx-side-pvp span{color:var(--lx-gold);font-size:9px;letter-spacing:.14em}
    .lx-side-menu:active,.lx-side-pvp:active{transform:scale(.96);border-color:rgba(231,197,106,.9)}
    .lx-menu-panel{display:none;position:absolute;top:max(62px,calc(env(safe-area-inset-top) + 54px));right:max(80px,calc(env(safe-area-inset-right) + 72px));z-index:87;width:min(286px,calc(100vw - 96px));padding:12px;border-radius:18px;background:rgba(9,18,21,.97);border:1px solid rgba(231,197,106,.45);box-shadow:0 16px 36px rgba(0,0,0,.34);pointer-events:auto}
    .lx-menu-panel.open{display:block}
    .lx-menu-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:var(--lx-gold);font-size:12px;font-weight:900;letter-spacing:.13em}
    .lx-menu-close{width:32px;height:32px;border-radius:10px;border:1px solid rgba(231,197,106,.28);background:#111d21;color:var(--lx-ivory);font-size:18px;font-weight:800}
    .lx-menu-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .lx-menu-item{min-height:45px;padding:7px 8px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,rgba(23,63,54,.75),rgba(13,29,30,.96));color:var(--lx-ivory);font-size:10px;font-weight:800;text-align:left}
    .lx-menu-item:active{transform:scale(.98);border-color:rgba(231,197,106,.58)}
    .lx-chat-drawer{display:none;position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px));z-index:88;padding:9px;border-radius:14px;background:rgba(9,18,21,.96);border:1px solid rgba(231,197,106,.34);box-shadow:0 14px 34px rgba(0,0,0,.35);pointer-events:auto}
    .lx-chat-drawer.open{display:block}
    .lx-log{height:62px;overflow:auto;padding:2px 3px 7px;color:#e8ede8;font-size:11px;line-height:1.4}
    .lx-log:empty:before{content:'El chat aparecerá aquí';color:#789188}
    .lx-chat-form{display:flex;gap:6px}
    .lx-chat-form input{min-width:0;flex:1;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#111d21;color:#f6f2df;padding:0 10px;outline:none}
    .lx-chat-form input:focus{border-color:rgba(231,197,106,.58)}
    .lx-chat-form button{height:36px;min-width:48px;border-radius:10px;border:1px solid rgba(231,197,106,.52);background:var(--lx-forest);color:var(--lx-gold);font-weight:900}
    .action-bar{position:absolute!important;left:auto!important;right:max(10px,env(safe-area-inset-right))!important;bottom:max(10px,env(safe-area-inset-bottom))!important;transform:none!important;display:grid!important;grid-template-columns:repeat(5,44px)!important;grid-template-rows:44px!important;gap:6px!important;width:auto!important;height:44px!important;z-index:84!important;pointer-events:auto!important}
    .action-bar .stone-slot,.action-bar .stone-slot.ultimate{grid-column:auto!important;grid-row:auto!important;width:44px!important;height:44px!important;border-radius:13px!important;border:1px solid rgba(231,197,106,.56)!important;background:rgba(11,22,24,.92)!important;color:var(--lx-gold)!important;box-shadow:0 7px 18px rgba(0,0,0,.22),inset 0 0 0 1px rgba(255,255,255,.035)!important;font-size:7px!important}
    .action-bar .stone-slot.ultimate{border-color:rgba(231,197,106,.88)!important;background:linear-gradient(145deg,rgba(25,55,45,.96),rgba(11,22,24,.96))!important}
    .action-bar .stone-slot span[style*="opacity"]{font-size:13px!important;color:#69837b!important;opacity:.52!important}
    #kelo-bag,#kelo-builder{border-color:rgba(231,197,106,.45)!important;background:rgba(9,18,21,.97)!important;box-shadow:0 16px 36px rgba(0,0,0,.34)!important;color:#e8ede8!important}
    @media(max-width:360px){.lx-presence{display:none}.lx-top-btn{padding:0 8px}.lx-side-menu,.lx-side-pvp{width:58px}.lx-side-menu{height:58px}.lx-side-pvp{height:54px}.lx-menu-panel{right:72px;width:calc(100vw - 84px)}.action-bar{grid-template-columns:repeat(5,41px)!important;gap:5px!important}.action-bar .stone-slot,.action-bar .stone-slot.ultimate{width:41px!important;height:41px!important}}
  `;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.id = 'kelo-luxe';
  root.innerHTML = `
    <div class="lx-top">
      <div class="lx-gold"><span class="lx-gold-dot"></span><span id="lx-gold">Oro 0</span></div>
      <div class="lx-presence"><i></i><span>online</span></div>
      <div class="lx-spacer"></div>
      <button class="lx-top-btn" id="lx-shop">Boutique</button>
    </div>
    <div class="lx-rail">
      <button class="lx-side-menu" id="lx-side-menu" aria-label="Abrir menú" aria-expanded="false"><b>◆</b><span>MENÚ</span></button>
      <button class="lx-side-pvp" id="lx-side-pvp" aria-label="Entrar al mundo PvP"><b>⚔</b><span>PVP</span></button>
    </div>
    <div class="lx-menu-panel" id="lx-menu-panel" aria-hidden="true">
      <div class="lx-menu-head"><span>MENÚ</span><button class="lx-menu-close" id="lx-menu-close" aria-label="Cerrar menú">×</button></div>
      <div class="lx-menu-grid">
        <button class="lx-menu-item" data-tool="bag">Mochila</button>
        <button class="lx-menu-item" data-tool="abilities">Habilidades</button>
        <button class="lx-menu-item" data-tool="profile">Perfil</button>
        <button class="lx-menu-item" data-tool="chat">Chat</button>
        <button class="lx-menu-item" data-tool="market">Mercado</button>
        <button class="lx-menu-item" data-tool="missions">Misiones</button>
        <button class="lx-menu-item" data-tool="properties">Propiedades</button>
        <button class="lx-menu-item" data-tool="settings">Ajustes</button>
      </div>
    </div>
    <div class="lx-chat-drawer" id="lx-chat-drawer">
      <div class="lx-log" id="lx-log"></div>
      <form class="lx-chat-form" id="lx-form"><input id="lx-in" maxlength="80" placeholder="Escribe un mensaje…" autocomplete="off"><button>OK</button></form>
    </div>`;
  document.body.appendChild(root);

  const menuPanel = document.getElementById('lx-menu-panel');
  const menuButton = document.getElementById('lx-side-menu');
  function setMenuOpen(force) {
    const open = typeof force === 'boolean' ? force : !menuPanel.classList.contains('open');
    menuPanel.classList.toggle('open', open);
    menuPanel.setAttribute('aria-hidden', String(!open));
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const drawer = document.getElementById('lx-chat-drawer');
      if (drawer) drawer.classList.remove('open');
    }
    return open;
  }
  function closeLuxeMenu() { return setMenuOpen(false); }
  window.KELO_LUXE = Object.freeze({
    toggleMenu: setMenuOpen,
    closeMenu: closeLuxeMenu,
    isMenuOpen: function(){ return menuPanel.classList.contains('open'); }
  });

  function suppressLegacyUI() {
    const ids = ['kelo-chat','kelo-stones-btn','social-menu-toggle','kelo-online','kelo-minimap','minimap'];
    ids.forEach(function(id){ const el=document.getElementById(id); if(el) el.style.setProperty('display','none','important'); });
    const top=document.querySelector('.top-bar'); if(top) top.style.setProperty('display','none','important');
    Array.from(document.body.children).forEach(function(el){
      if(el.tagName==='BUTTON' && (el.textContent||'').trim()==='Mochila'){
        if(!el.id) el.id='kelo-bag-btn';
        el.style.setProperty('display','none','important');
      }
    });
  }
  suppressLegacyUI();
  const legacyObserver = new MutationObserver(suppressLegacyUI);
  legacyObserver.observe(document.body,{childList:true,subtree:false});

  function updateGold() {
    const el = document.getElementById('lx-gold');
    if (el && typeof STATE !== 'undefined') el.textContent = 'Oro ' + (STATE.gold || 0);
  }
  updateGold();
  setInterval(updateGold, 1200);

  menuButton.onclick = function () { setMenuOpen(); };
  document.getElementById('lx-menu-close').onclick = closeLuxeMenu;
  menuPanel.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    closeLuxeMenu();
    const tool = btn.getAttribute('data-tool');
    if (typeof openSocialTool === 'function') openSocialTool(tool);
    else if (typeof showToast === 'function') showToast('Menú todavía cargando');
  });

  document.getElementById('lx-side-pvp').onclick = function () {
    const drawer = document.getElementById('lx-chat-drawer');
    if (drawer) drawer.classList.remove('open');
    closeLuxeMenu();
    if (typeof window.enterPvPWorld === 'function') window.enterPvPWorld();
    else if (typeof showToast === 'function') showToast('PvP todavía cargando');
  };

  function appendChat(who,text){
    const log=document.getElementById('lx-log'); if(!log)return;
    const row=document.createElement('div');
    row.textContent=(who||'Tu')+': '+text;
    log.appendChild(row); log.scrollTop=log.scrollHeight;
    while(log.children.length>12) log.removeChild(log.firstChild);
  }
  const oldSay = window.keloSay;
  if (typeof oldSay === 'function' && !oldSay._luxeWrapped) {
    const wrapped=function(who,text){ oldSay(who,text); appendChat(who,text); };
    wrapped._luxeWrapped=true;
    window.keloSay=wrapped;
  }
  document.getElementById('lx-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const inp=document.getElementById('lx-in'); const text=(inp.value||'').trim(); if(!text)return;
    const who=(typeof localPlayer!=='undefined'&&localPlayer.name)||'Tu';
    if(typeof window.keloSay==='function') window.keloSay(who,text); else appendChat(who,text);
    inp.value='';
  });

  window.KELO_LUXE_AUDIT = Object.freeze({
    version:'luxe-shell-v3.5',
    palette:'forest-ivory-gold',
    hideKwBadge:true,
    hideLocalChip:true,
    hideFarmOverlay:false,
    ruralRenderer:'modular-authored-v1',
    legacyHudSuppressed:true,
    luxeMenuPanel:true,
    pvpRailButton:true
  });
})();

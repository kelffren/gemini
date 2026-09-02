(function () {
  if (document.getElementById('kelo-luxe')) return;
  const css = document.createElement('style');
  css.textContent = '#kelo-luxe{position:absolute;inset:0;z-index:70;pointer-events:none;font-family:-apple-system,sans-serif}#kelo-luxe *{pointer-events:auto}.lx-top{position:absolute;top:max(8px,env(safe-area-inset-top));left:8px;right:8px;display:flex;gap:6px;align-items:center}.lx-shop{background:linear-gradient(#ff4fa3,#c81e70);color:#fff;border:0;border-radius:14px;padding:8px 12px;font-weight:800;font-size:12px}.lx-pill{background:rgba(12,16,24,.92);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:14px;padding:7px 10px;font-weight:800;font-size:12px}.lx-side{position:absolute;top:max(58px,calc(env(safe-area-inset-top) + 50px));right:8px;display:flex;flex-direction:column;gap:8px}.lx-ico{width:44px;height:44px;border-radius:12px;border:1px solid rgba(231,197,106,.35);background:rgba(16,20,28,.92);color:#f3d48b;font-size:11px;font-weight:700}.lx-online{position:absolute;right:8px;bottom:max(118px,calc(env(safe-area-inset-bottom) + 110px));background:rgba(8,12,18,.88);color:#d7f7c2;border-radius:10px;padding:6px 8px;font-size:11px;font-weight:700}.lx-chat{position:absolute;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));display:flex;gap:6px}.lx-chat input{flex:1;height:40px;border-radius:12px;border:1px solid #3a465c;background:rgba(10,13,18,.92);color:#eee;padding:0 12px}.lx-chat button{height:40px;border:0;border-radius:12px;background:#6c4cff;color:#fff;padding:0 12px;font-weight:800}.lx-log{position:absolute;left:8px;right:70px;bottom:max(54px,calc(env(safe-area-inset-bottom) + 46px));max-height:92px;overflow:auto;background:rgba(8,12,18,.78);border-radius:12px;padding:8px;color:#eee;font-size:11px}.top-bar,#kelo-chat{opacity:.15}';
  document.head.appendChild(css);
  const root = document.createElement('div');
  root.id = 'kelo-luxe';
  root.innerHTML = '<div class="lx-top"><button class="lx-shop" id="lx-shop">SHOP</button><div class="lx-pill" id="lx-gold">Oro</div></div><div class="lx-side"><button class="lx-ico" id="lx-stones">Piedras</button><button class="lx-ico" id="lx-menu">Menu</button></div><div class="lx-online">plaza</div><div class="lx-log" id="lx-log"></div><form class="lx-chat" id="lx-form"><input id="lx-in" maxlength="80" placeholder="Escribe..."><button>OK</button></form>';
  document.body.appendChild(root);
  function gold() {
    const el = document.getElementById('lx-gold');
    if (el && typeof STATE !== 'undefined') el.textContent = 'Oro ' + (STATE.gold || 0);
  }
  gold();
  setInterval(gold, 1200);
  document.getElementById('lx-shop').onclick = function () { if (typeof showToast === 'function') showToast('Boutique pronto'); };
  document.getElementById('lx-stones').onclick = function () { var b = document.getElementById('kelo-stones-btn'); if (b) b.click(); };
  document.getElementById('lx-menu').onclick = function () { if (typeof toggleMenu === 'function') toggleMenu(); };
  document.getElementById('lx-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const inp = document.getElementById('lx-in');
    const t = (inp.value || '').trim();
    if (!t) return;
    const log = document.getElementById('lx-log');
    const row = document.createElement('div');
    row.textContent = ((typeof localPlayer !== 'undefined' && localPlayer.name) || 'Tu') + ': ' + t;
    log.appendChild(row);
    inp.value = '';
  });
})();

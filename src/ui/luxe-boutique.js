(function () {
  function ensureStyle(){
    if(document.getElementById('kelo-boutique-style'))return;
    var s=document.createElement('style');
    s.id='kelo-boutique-style';
    s.textContent=`
      #kelo-boutique{display:none;position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));top:max(60px,calc(env(safe-area-inset-top) + 52px));z-index:132;max-width:350px;max-height:calc(100vh - 130px);overflow:auto;margin:auto;padding:13px;border-radius:17px;background:linear-gradient(180deg,rgba(10,25,25,.985),rgba(8,17,20,.985));border:1px solid rgba(231,197,106,.52);box-shadow:0 22px 52px rgba(0,0,0,.42);color:#f5efd9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto}
      .lx-b-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(231,197,106,.16)}
      .lx-b-kicker{font-size:9px;letter-spacing:1.6px;text-transform:uppercase;color:#9eb9aa;font-weight:800}
      .lx-b-title{margin-top:2px;font-family:Georgia,serif;color:#e7c56a;font-size:19px;font-weight:700;letter-spacing:.4px}
      .lx-b-close{width:34px;height:34px;border-radius:11px;border:1px solid rgba(231,197,106,.28);background:rgba(255,255,255,.03);color:#e7c56a;font-weight:900}
      .lx-b-note{margin:9px 1px;color:#91a79d;font-size:10px}
      .lx-b-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .lx-b-card{min-height:106px;padding:10px;border-radius:14px;border:1px solid rgba(231,197,106,.18);background:linear-gradient(145deg,rgba(25,62,51,.58),rgba(15,26,29,.9));color:#f5efd9;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .lx-b-card:active{transform:translateY(1px)}
      .lx-b-icon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;margin-bottom:10px;border:1px solid rgba(231,197,106,.35);background:rgba(7,17,18,.52);color:#e7c56a;font-family:Georgia,serif;font-size:16px}
      .lx-b-name{display:block;font-size:11px;font-weight:800;color:#fff4d6}
      .lx-b-type{display:block;margin-top:2px;font-size:9px;color:#90a89e}
      .lx-b-price{display:inline-block;margin-top:7px;padding:3px 6px;border-radius:999px;background:rgba(231,197,106,.1);color:#e7c56a;font-size:9px;font-weight:800}
    `;
    document.head.appendChild(s);
  }
  function panel() {
    var p = document.getElementById('kelo-boutique');
    if (p) return p;
    ensureStyle();
    p = document.createElement('div');
    p.id = 'kelo-boutique';
    p.innerHTML = '<div class="lx-b-head"><div><div class="lx-b-kicker">Kelo World</div><div class="lx-b-title">Luxe Boutique</div></div><button class="lx-b-close" id="lx-b-x" aria-label="Cerrar">×</button></div><div class="lx-b-note">Colección de muestra · las compras todavía no descuentan oro.</div><div class="lx-b-grid" id="lx-b-list"></div>';
    document.body.appendChild(p);
    document.getElementById('lx-b-x').onclick = function () { p.style.display = 'none'; };
    var items = [
      { n:'Cadena de oro', t:'Joyería', c:400, i:'◇' },
      { n:'Reloj clásico', t:'Relojería', c:900, i:'◫' },
      { n:'Aretes', t:'Joyería', c:250, i:'••' },
      { n:'Corona Rey', t:'Colección', c:5000, i:'♢' }
    ];
    var list = document.getElementById('lx-b-list');
    items.forEach(function (it) {
      var card = document.createElement('button');
      card.className='lx-b-card';
      card.innerHTML='<span class="lx-b-icon">'+it.i+'</span><span class="lx-b-name">'+it.n+'</span><span class="lx-b-type">'+it.t+'</span><span class="lx-b-price">'+it.c+' oro</span>';
      card.onclick = function () { if (typeof showToast === 'function') showToast(it.n + ' · vista previa'); };
      list.appendChild(card);
    });
    return p;
  }
  function open() {
    var p = panel();
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
  }
  function hook() {
    var b = document.getElementById('lx-shop');
    if (!b || b._boutique) return;
    b._boutique = true;
    b.onclick = open;
  }
  hook();
  setTimeout(hook, 200);
  window.KELO_BOUTIQUE = { open: open, version:'luxe-boutique-v2.0' };
})();

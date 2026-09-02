(function () {
  function panel() {
    var p = document.getElementById('kelo-boutique');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'kelo-boutique';
    p.style.cssText = 'display:none;position:absolute;top:86px;left:8px;right:8px;z-index:130;max-width:360px;background:rgba(12,10,18,.96);border:1px solid #e7c56a;border-radius:14px;padding:12px;color:#eee;font-size:13px;pointer-events:auto';
    p.innerHTML = '<div style="display:flex;justify-content:space-between;color:#e7c56a;font-weight:800"><span>LUXE BOUTIQUE</span><span id="lx-b-x" style="cursor:pointer">X</span></div><div style="margin:8px 0;opacity:.8">Joyeria demo. No descuenta oro de verdad.</div><div id="lx-b-list"></div>';
    document.body.appendChild(p);
    document.getElementById('lx-b-x').onclick = function () { p.style.display = 'none'; };
    var items = [
      { n: 'Cadena oro', c: 400 },
      { n: 'Reloj', c: 900 },
      { n: 'Aretes', c: 250 },
      { n: 'Corona Rey', c: 5000 }
    ];
    var list = document.getElementById('lx-b-list');
    items.forEach(function (it) {
      var row = document.createElement('button');
      row.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;border-radius:10px;border:1px solid #3a465c;background:#16101c;color:#f3d48b;text-align:left';
      row.textContent = it.n + '  ·  ' + it.c + ' oro';
      row.onclick = function () {
        if (typeof showToast === 'function') showToast(it.n + ' (demo)');
      };
      list.appendChild(row);
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
  window.KELO_BOUTIQUE = { open: open };
})();

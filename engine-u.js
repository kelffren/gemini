(function () {
  const T = 32;
  const OX = 1024;
  const OY = 1216;
  const MW = 28;
  const MH = 20;
  window.KELO_TILE = T;

  if (typeof plazaArt !== 'undefined') {
    try { plazaArt.src = ''; } catch (e) {}
  }

  const atlas = document.createElement('canvas');
  atlas.width = 512;
  atlas.height = 512;
  let sheet = atlas;
  const paths = ['assets/tileset.png', 'assets/tileset.PNG', 'assets/tileset .PNG', 'assets/tileset.webp'];
  let pi = 0;
  const img = new Image();
  img.onload = function () { sheet = img; };
  img.onerror = function () {
    pi++;
    if (pi < paths.length) img.src = paths[pi];
  };
  img.src = paths[0];

  obstacles.push(
    { x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T },
    { x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T },
    { x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T }
  );

  function drawMap(ctx) {
    ctx.drawImage(sheet, OX, OY, MW * T, MH * T);
    ctx.fillStyle = '#c9a24a';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MERCADO', OX + 6.5 * T, OY + 2 * T - 6);
    ctx.fillText('BANCO', OX + 22 * T, OY + 5 * T - 6);
    ctx.fillText('ATELIER', OX + 4 * T, OY + 8 * T - 6);
  }

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    drawMap(ctx);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
    if (window.keloNpcs) keloNpcs.forEach(function (n) {
      renderAvatar({ name: n.name, x: n.x, y: n.y, gear: { bodyColor: n.color, armorColor: '#e7c56a' } }, false);
    });
    renderAvatar(localPlayer, true);
    ctx.restore();
  };
})();

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

  function drawMap(ctx) {
    ctx.drawImage(sheet, OX, OY, MW * T, MH * T);
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
    renderAvatar(localPlayer, true);
    ctx.restore();
  };
})();

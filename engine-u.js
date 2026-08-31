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
  atlas.width = 256;
  atlas.height = 128;
  const a = atlas.getContext('2d');

  function cell(id, fn) {
    const x = (id % 8) * T;
    const y = Math.floor(id / 8) * T;
    a.save();
    a.translate(x, y);
    fn(a);
    a.restore();
  }

  cell(1, function (g) {
    g.fillStyle = '#2a2c32'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#3a3d46';
    for (let i = 0; i < 10; i++) g.fillRect((i * 7) % 30, (i * 11) % 30, 6, 5);
    g.strokeStyle = '#1c1e24'; g.strokeRect(0.5, 0.5, T - 1, T - 1);
  });
  cell(2, function (g) {
    g.fillStyle = '#262830'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#4a4e58';
    g.fillRect(4, 4, 10, 8); g.fillRect(18, 16, 9, 7);
    g.strokeStyle = '#181a20'; g.strokeRect(0.5, 0.5, T - 1, T - 1);
  });
  cell(3, function (g) {
    g.fillStyle = '#2a2c32'; g.fillRect(0, 0, T, T);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(2, 2, T - 4, T - 4);
    g.fillStyle = '#e7c56a'; g.fillRect(14, 14, 4, 4);
  });
  cell(4, function (g) {
    g.fillStyle = '#3b342c'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#5a5044'; g.fillRect(0, 12, T, 8);
    g.strokeStyle = '#2a241c'; g.strokeRect(0.5, 0.5, T - 1, T - 1);
  });
  cell(5, function (g) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, T, T);
  });
  cell(6, function (g) {
    g.fillStyle = '#1a3048'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#3d7ea6'; g.beginPath(); g.arc(16, 16, 10, 0, Math.PI * 2); g.fill();
  });
  cell(7, function (g) {
    g.fillStyle = '#163044'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#5cb0d4'; g.beginPath(); g.arc(16, 14, 9, 0, Math.PI * 2); g.fill();
  });
  cell(8, function (g) {
    g.fillStyle = '#1a161c'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#3a3238'; g.fillRect(0, 0, T, 6);
    g.strokeStyle = '#8a7040'; g.strokeRect(0.5, 0.5, T - 1, T - 1);
  });

  const tiles = [];
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      let id = ((x + y) % 2) ? 1 : 2;
      if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) id = 3;
      if (x >= 12 && x <= 15 && y >= 8 && y <= 11) id = 6;
      if ((y === 9 || y === 14) && x > 2 && x < MW - 3) id = 4;
      if ((x === 8 || x === 19) && y > 2 && y < MH - 3) id = 4;
      tiles.push(id);
    }
  }

  function stampSolids() {
    const boxes = [
      { x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T },
      { x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T },
      { x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T }
    ];
    boxes.forEach(function (b) { obstacles.push(b); });
  }
  stampSolids();

  function blit(ctx, id, dx, dy) {
    const sx = (id % 8) * T;
    const sy = Math.floor(id / 8) * T;
    ctx.drawImage(atlas, sx, sy, T, T, dx, dy, T, T);
  }

  function drawMap(ctx) {
    const z = CONFIG.zoom || 1;
    const viewW = screenW / z;
    const viewH = screenH / z;
    const x0 = Math.max(0, Math.floor((camera.x - viewW / 2 - OX) / T));
    const y0 = Math.max(0, Math.floor((camera.y - viewH / 2 - OY) / T));
    const x1 = Math.min(MW - 1, Math.ceil((camera.x + viewW / 2 - OX) / T));
    const y1 = Math.min(MH - 1, Math.ceil((camera.y + viewH / 2 - OY) / T));
    const water = (Math.floor(Date.now() / 400) % 2) ? 6 : 7;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let id = tiles[y * MW + x];
        if (id === 6 || id === 7) id = water;
        blit(ctx, id, OX + x * T, OY + y * T);
      }
    }
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
    ctx.restore();
  };
})();

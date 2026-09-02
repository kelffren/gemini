CONFIG.zoom = 0.82;
const ZOOM_STEPS = [0.7, 0.82, 1];
function screenToWorld(sx, sy) {
  const z = CONFIG.zoom || 1;
  return { x: camera.x + (sx - screenW / 2) / z, y: camera.y + (sy - screenH / 2) / z };
}
function cycleZoom() {
  const i = ZOOM_STEPS.indexOf(CONFIG.zoom);
  CONFIG.zoom = ZOOM_STEPS[(i + 1) % ZOOM_STEPS.length];
  showToast('Zoom ' + CONFIG.zoom);
  closeMenu();
}
function toggleMenu() {
  const el = document.getElementById('menu-sheet');
  const open = el.style.display === 'block';
  document.querySelectorAll('.app-panel').forEach(p => p.style.display = 'none');
  el.style.display = open ? 'none' : 'block';
}
function closeMenu() {
  const el = document.getElementById('menu-sheet');
  if (el) el.style.display = 'none';
}
function openFromMenu(id) { closeMenu(); togglePanel(id); }
function openSocialTool(tool) {
  closeMenu();
  if (tool === 'bag') {
    if (window.KeloSocialUI && typeof window.KeloSocialUI.openBag === 'function') return window.KeloSocialUI.openBag();
    showToast('Mochila no disponible');
    return;
  }
  if (tool === 'stones' || tool === 'abilities') {
    if (window.KeloAbilities && typeof window.KeloAbilities.openStonePanel === 'function') return window.KeloAbilities.openStonePanel();
    showToast('Habilidades todavía cargando');
    return;
  }
  if (tool === 'profile') {
    if (typeof inspectPlayer === 'function') return inspectPlayer(localPlayer, true);
    showToast('Perfil no disponible');
    return;
  }
  if (tool === 'market') { showToast('Mercado · acceso social preparado'); return; }
  if (tool === 'properties') { showToast('Propiedades · acceso social preparado'); return; }
  if (tool === 'missions') { showToast('Misiones · acceso social preparado'); return; }
  if (tool === 'friends') { showToast('Amigos · acceso social preparado'); return; }
  if (tool === 'settings') { showToast('Ajustes · usa Zoom HD por ahora'); return; }
}
function quickTravel(dest) {
  closeMenu();
  if (dest === 'plaza') { localPlayer.x = 1400; localPlayer.y = 1600; camera.targetX = 1400; camera.targetY = 1600; showToast('Plaza Central'); }
  else if (dest === 'farm') { teleportToFarm(); showToast('Distrito Rural'); }
  else if (dest === 'house') { teleportToPlot(); showToast('Tu parcela'); }
  else if (dest === 'arena') { localPlayer.x = arenaPvP.x + 80; localPlayer.y = arenaPvP.y + arenaPvP.h / 2; camera.targetX = arenaPvP.x + arenaPvP.w / 2; camera.targetY = arenaPvP.y + arenaPvP.h / 2; showToast('Arena 1v1'); }
}
checkFarmTouch = function(sx, sy) {
  const w = screenToWorld(sx, sy);
  const farm = STATE.farm, now = Date.now();
  for (let i = 0; i < farm.crops.length; i++) {
    const c = farm.crops[i];
    const cx = farm.x + 20 + (i % 2) * 110;
    const cy = farm.y + 30 + Math.floor(i / 2) * 110;
    if (w.x >= cx && w.x <= cx + 90 && w.y >= cy && w.y <= cy + 90) {
      if (c.type) {
        const meta = CROP_TYPES[c.type];
        if ((now - c.plantedAt) / 1000 >= meta.growTime) {
          STATE.silo[c.type] = (STATE.silo[c.type] || 0) + 1;
          STATE.farmXp = (STATE.farmXp || 0) + meta.xp;
          if (STATE.farmXp >= STATE.farmLevel * 40) { STATE.farmLevel++; STATE.farmXp = 0; showToast('Granjero nivel ' + STATE.farmLevel); }
          c.type = null; saveState(); showToast('Cosechaste ' + meta.name); return true;
        }
      } else { c.type = 'wheat'; c.plantedAt = Date.now(); saveState(); showToast('Sembraste trigo'); return true; }
    }
  }
  return false;
};
checkSocialTouch = function(sx, sy) {
  const w = screenToWorld(sx, sy);
  for (const p of simulatedPlayers) {
    if (Math.hypot(w.x - p.x, w.y - p.y) < p.radius * 1.8) { openSocialModal(p, sx, sy); return; }
  }
  closeSocialModal();
};
handleBuildGridTap = function(sx, sy) {
  const w = screenToWorld(sx, sy);
  const plot = STATE.plot;
  if (w.x < plot.x || w.x > plot.x + plot.w || w.y < plot.y || w.y > plot.y + plot.h) return;
  const gx = Math.floor((w.x - plot.x) / TILE_SIZE);
  const gy = Math.floor((w.y - plot.y) / TILE_SIZE);
  STATE.plot.furniture = STATE.plot.furniture.filter(f => !(f.gx === gx && f.gy === gy));
  if (activeTool !== 'eraser') STATE.plot.furniture.push({ type: activeTool, gx: gx, gy: gy, gw: 1, gh: 1 });
  saveState();
};
const _render = render;
render = function() {
  ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, screenW, screenH);
  const z = CONFIG.zoom || 1;
  ctx.save(); ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y);
  let worldDrawn = false;
  if (window.KELO_WORLD_RENDERER && typeof window.KELO_WORLD_RENDERER.draw === 'function') {
    worldDrawn = window.KELO_WORLD_RENDERER.draw(ctx) === true;
  }
  if (!worldDrawn) {
    ctx.fillStyle = '#49c934'; ctx.fillRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
  }
  ctx.strokeStyle = '#8b3a3a'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
  if (Array.isArray(obstacles)) obstacles.forEach(function(b){ if(b) b.noDraw = true; });
  renderFarm(STATE.farm); renderPlot(STATE.plot, true); renderArena(arenaPvP);
  for (const pt of particles) { ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life / pt.maxLife; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.maxLife), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (isPvPActive && arenaPvP.rival) renderAvatar(arenaPvP.rival, false); else simulatedPlayers.forEach(p => renderAvatar(p, false));
  renderAvatar(localPlayer, true);
  ctx.restore();
  if (input.touchActive && !isBuildMode) {
    ctx.save(); ctx.strokeStyle = 'rgba(231,197,106,0.35)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(231,197,106,0.06)';
    ctx.beginPath(); ctx.arc(input.originX, input.originY, CONFIG.joystickRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const dx = input.currentX - input.originX, dy = input.currentY - input.originY;
    const dist = Math.hypot(dx, dy), clamped = Math.min(dist, CONFIG.joystickRadius), angle = Math.atan2(dy, dx);
    ctx.fillStyle = '#e7c56a'; ctx.beginPath();
    ctx.arc(input.originX + Math.cos(angle) * clamped, input.originY + Math.sin(angle) * clamped, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
};
const _updateSimulation = updateSimulation;
updateSimulation = function(dt) {
  _updateSimulation(dt);
  const now = Date.now();
  if (STATE.farm.coop && STATE.farm.coop.fedAt && (now - STATE.farm.coop.fedAt) / 1000 >= STATE.farm.coop.duration) {
    if (!STATE.farm.coop.ready) { STATE.farm.coop.ready = true; STATE.silo.eggs = (STATE.silo.eggs || 0) + 2; STATE.farm.coop.fedAt = 0; saveState(); showToast('+2 huevos'); }
  }
  if (STATE.farm.pen && STATE.farm.pen.fedAt && STATE.farm.pen.fedAt > 0 && (now - STATE.farm.pen.fedAt) / 1000 >= STATE.farm.pen.duration) {
    if (!STATE.farm.pen.ready) { STATE.farm.pen.ready = true; STATE.silo.pork = (STATE.silo.pork || 0) + 1; STATE.farm.pen.fedAt = 0; saveState(); showToast('+1 cerdo'); }
  }
};
localPlayer.title = 'Caballero';
const _renderAvatar = renderAvatar;
renderAvatar = function(p, isSelf) {
  _renderAvatar(p, isSelf);
  if (isSelf) { ctx.fillStyle = '#e7c56a'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.title || 'Caballero', p.x, p.y - p.radius - 18); }
};
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeMenu(); document.querySelectorAll('.app-panel').forEach(function(p){ p.style.display = 'none'; }); }
});
const _feedAnimals = feedAnimals;
feedAnimals = function(type) { _feedAnimals(type); if (type === 'chickens' && STATE.farm.coop) STATE.farm.coop.ready = false; if (type === 'pigs' && STATE.farm.pen) STATE.farm.pen.ready = false; };

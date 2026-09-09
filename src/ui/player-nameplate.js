/* KELO-INDEX
 * area: UI / AVATAR / IDENTITY
 * owner: KeloActorNameplate (presentation consumer); composition owner remains KeloAvatar
 * keys: NAMEPLATE NOBILITY TITLE NAME AVATAR MIDDLEWARE
 * purpose: dibuja rango de Nobleza + nombre + título equipado para actores locales/remotos sin decidir gameplay
 * public-api: KeloActorNameplate.resolve/draw
 * consumes: KeloAvatar, KeloNobility rank catalog, KeloTitleCatalog, actor replicated state
 * state-owned: ninguno; solo estilos compartidos de presentación
 * extension-points: resolve() admite futuras líneas clan/faction sin cambiar autoridad gameplay
 * reuse: jugador local, peers online y futuros actores con identidad pública
 * legacy: reemplaza el label self-only hardcodeado de engine-c
 * do-not: NO envolver renderAvatar; NO desbloquear/equipar títulos; NO decidir Nobleza
 */
(function (root) {
  'use strict';
  if (root.KeloActorNameplate || !root.KeloAvatar) return;
  const VERSION = 'actor-nameplate-v1';

  const RANK_STYLE = Object.freeze({
    knight: '#c9b178', baron: '#d6b77d', earl: '#dfc58d', duke: '#d5bdff', prince: '#f2d58f', king: '#ffd66b'
  });
  const TITLE_STYLE = Object.freeze({
    common: '#d5dde3', uncommon: '#9edca8', rare: '#8bc5ff', epic: '#cf9cff', legendary: '#ffd36a', mythic: '#ff9f8f'
  });

  function cleanName(value) { return String(value || 'Kelo').replace(/\s*\(Tu\)\s*$/i, '').slice(0, 28); }
  function rankMeta(id) {
    const key = String(id || 'none');
    if (!key || key === 'none') return null;
    const ranks = root.KeloNobility && Array.isArray(root.KeloNobility.ranks) ? root.KeloNobility.ranks : [];
    return ranks.find(function (rank) { return rank.id === key; }) || null;
  }
  function resolve(actor) {
    if (!actor) return Object.freeze({ name: '', nobility: null, title: null, rarity: null });
    const rank = rankMeta(actor.nobilityRank);
    const title = actor.equippedTitleId && root.KeloTitleCatalog ? root.KeloTitleCatalog.get(actor.equippedTitleId) : null;
    return Object.freeze({
      name: cleanName(actor.name),
      nobility: rank ? rank.name : (actor.nobilityRank && actor.nobilityRank !== 'none' && actor.nobilityTitle ? String(actor.nobilityTitle) : null),
      nobilityRank: rank ? rank.id : (actor.nobilityRank || 'none'),
      title: title ? title.name : null,
      titleId: title ? title.id : null,
      rarity: title ? title.rarity : null
    });
  }
  function paintText(text, x, y, font, fill, strokeWidth) {
    if (!text || typeof ctx === 'undefined') return;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth || 3;
    ctx.strokeStyle = 'rgba(3,5,8,.92)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }
  function draw(actor) {
    if (!actor || typeof ctx === 'undefined') return;
    const info = resolve(actor);
    if (!info.name) return;
    const x = Number(actor.x) || 0;
    const radius = Math.max(12, Number(actor.radius) || 20);
    const baseY = (Number(actor.y) || 0) - radius - 19;
    const lines = [];
    if (info.nobility) lines.push({ type: 'nobility', text: '♛ ' + info.nobility.toUpperCase() + ' ♛' });
    lines.push({ type: 'name', text: info.name });
    if (info.title) lines.push({ type: 'title', text: '《' + info.title + '》' });
    const spacing = 13;
    const startY = baseY - ((lines.length - 1) * spacing);
    ctx.save();
    ctx.globalAlpha = 0.98;
    lines.forEach(function (line, index) {
      const y = startY + index * spacing;
      if (line.type === 'nobility') paintText(line.text, x, y, '800 9px Georgia,serif', RANK_STYLE[info.nobilityRank] || '#d9c086', 3);
      else if (line.type === 'name') paintText(line.text, x, y, '800 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', '#f2f5f6', 3.5);
      else paintText(line.text, x, y, '700 9px Georgia,serif', TITLE_STYLE[info.rarity] || '#d5dde3', 3);
    });
    ctx.restore();
  }

  // La capa más externa llama next() primero y dibuja el nameplate después del avatar/auras.
  const middlewareId = root.KeloAvatar.use('actor-nameplate', function (actor, isSelf, next) {
    const result = next(actor, isSelf);
    draw(actor);
    return result;
  }, 500);

  root.KeloActorNameplate = Object.freeze({ version: VERSION, resolve: resolve, draw: draw, middlewareId: middlewareId });
  root.KELO_ACTOR_NAMEPLATE_AUDIT = Object.freeze({ version: VERSION, ready: true, middleware: true, priority: 500, localAndRemote: true, gameplayAuthority: false });
})(typeof globalThis !== 'undefined' ? globalThis : window);

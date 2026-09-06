/* KELO-INDEX
 * area: VISUAL
 * keys: LAB DEBUG GALLERY ANIMATION VFX PROJECTILE SEQUENCE STATUS SFX PREVIEW
 * hace: galería de desarrollo para reproducir piezas visuales sin combate ni piedras
 * online: N/A; solo aparece con ?visualLab=1 y no muta gameplay
 */
(function (root) {
  'use strict';

  let panel = null;
  function enabled() {
    try { return new URLSearchParams(root.location.search).get('visualLab') === '1'; }
    catch (e) { return false; }
  }
  if (!enabled()) return;

  function actor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }
  function originFor(direction, distance) {
    const p = actor(); if (!p) return { x: 1400, y: 1600 };
    return { x: p.x + direction.x * (distance || 0), y: p.y + direction.y * (distance || 0) };
  }
  function directionOf(value) {
    if (value === 'up') return { x: 0, y: -1 };
    if (value === 'down') return { x: 0, y: 1 };
    if (value === 'left') return { x: -1, y: 0 };
    return { x: 1, y: 0 };
  }
  function options(select, values) {
    select.innerHTML = '';
    values.forEach(function (value) { const option = document.createElement('option'); option.value = value.id || value; option.textContent = value.id || value; select.appendChild(option); });
  }
  function row(label, node) {
    const wrap = document.createElement('label'); wrap.style.cssText = 'display:grid;grid-template-columns:86px 1fr;gap:6px;align-items:center;margin:5px 0';
    const span = document.createElement('span'); span.textContent = label; span.style.color = '#a9b1bc'; wrap.appendChild(span); wrap.appendChild(node); return wrap;
  }
  function button(text, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;padding:7px 9px;font-weight:800'; b.onclick = fn; return b;
  }

  function build() {
    if (panel || !document.body) return;
    panel = document.createElement('div'); panel.id = 'kelo-visual-lab';
    panel.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;width:min(350px,calc(100vw - 16px));max-height:90vh;overflow:auto;z-index:100000;background:rgba(7,10,15,.97);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:11px;color:#e6edf3;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;touch-action:pan-y';
    const title = document.createElement('div'); title.innerHTML = '<b style="color:#e7c56a">VISUAL LAB</b><span style="float:right;color:#78808b">DEV ONLY</span>'; panel.appendChild(title);
    const hint = document.createElement('div'); hint.textContent = 'Piezas independientes · no requiere combate ni piedra equipada'; hint.style.cssText = 'color:#78808b;margin:4px 0 9px'; panel.appendChild(hint);

    const direction = document.createElement('select'); options(direction, ['right','down','left','up']);
    const scale = document.createElement('input'); scale.type = 'range'; scale.min = '0.5'; scale.max = '2'; scale.step = '0.1'; scale.value = '1';
    const speed = document.createElement('input'); speed.type = 'range'; speed.min = '0.25'; speed.max = '2'; speed.step = '0.25'; speed.value = '1';
    const loop = document.createElement('input'); loop.type = 'checkbox';
    const anchor = document.createElement('select'); options(anchor, ['foot','center','chest','head','hand','weapon','castOrigin','ground']); anchor.value = 'castOrigin';
    panel.appendChild(row('Dirección', direction)); panel.appendChild(row('Escala', scale)); panel.appendChild(row('Velocidad', speed)); panel.appendChild(row('Loop', loop)); panel.appendChild(row('Anchor', anchor));

    const animation = document.createElement('select'); options(animation, root.KeloAnimationRegistry ? root.KeloAnimationRegistry.list() : []); panel.appendChild(row('Animation', animation));
    panel.appendChild(button('▶ PLAY ANIMATION', function () {
      const p = actor(); if (!p || !root.KeloAnimation) return;
      p._face = direction.value; root.KeloAnimation.play(p, animation.value, { speed: Number(speed.value), loop: loop.checked, force: true, context: { actor: p, visual: { scale: Number(scale.value) } } });
    }));

    const fx = document.createElement('select'); options(fx, root.KeloFXRegistry ? root.KeloFXRegistry.list() : []); panel.appendChild(row('VFX', fx));
    panel.appendChild(button('✦ SPAWN VFX', function () {
      const p = actor(), dir = directionOf(direction.value), pos = originFor(dir, 70);
      const def = root.KeloFXRegistry && root.KeloFXRegistry.get(fx.value);
      const isActor = def && def.space === 'ACTOR';
      root.KeloFX && root.KeloFX.spawn(fx.value, { actor: isActor ? p : null, actorId: isActor && p ? p.id : null, origin: isActor ? null : pos, direction: dir, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: anchor.value, scale: Number(scale.value), loop: loop.checked });
    }));

    const projectile = document.createElement('select'); options(projectile, root.KeloProjectileVisualRegistry ? root.KeloProjectileVisualRegistry.list() : []); panel.appendChild(row('Projectile', projectile));
    panel.appendChild(button('➜ PREVIEW PROJECTILE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloProjectileVisuals && root.KeloProjectileVisuals.preview(projectile.value, { actor: p, actorId: p && p.id, origin: p && root.KeloAnchors ? root.KeloAnchors.get(p, anchor.value) : originFor(dir, 0), direction: dir, gameplay: { speed: 420 * Number(speed.value), range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } });
    }));

    const sequence = document.createElement('select'); options(sequence, root.KeloSequenceRegistry ? root.KeloSequenceRegistry.list() : []); panel.appendChild(row('Sequence', sequence));
    panel.appendChild(button('▶ PLAY SEQUENCE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloSequence && root.KeloSequence.play(sequence.value, { actor: p, actorId: p && p.id, origin: p ? { x: p.x, y: p.y } : originFor(dir, 0), direction: dir, target: originFor(dir, 100), gameplay: { speed: 420, range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { speed: Number(speed.value), loop: loop.checked });
    }));

    const status = document.createElement('select'); const statuses = Object.keys(root.KELO_VISUAL_MANIFESTS.statusVisuals || {}).map(function (id) { return { id: id }; }); options(status, statuses); panel.appendChild(row('Status', status));
    panel.appendChild(button('◉ PREVIEW STATUS', function () {
      const p = actor(), ref = root.KELO_VISUAL_MANIFESTS.statusVisuals[status.value];
      if (p && ref && root.KeloFX) root.KeloFX.spawn(ref, { actor: p, actorId: p.id, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: 'center', loop: loop.checked });
    }));

    const sfx = document.createElement('select'); options(sfx, root.KeloSFXRegistry ? root.KeloSFXRegistry.list() : []); panel.appendChild(row('SFX', sfx));
    panel.appendChild(button('♪ PLAY SFX', function () { root.KeloSFX && root.KeloSFX.play(sfx.value, { actor: actor() }); }));

    const actions = document.createElement('div'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px';
    actions.appendChild(button('Shake', function () { root.KeloScreenFX && root.KeloScreenFX.shake('impact_medium'); }));
    actions.appendChild(button('Flash', function () { root.KeloScreenFX && root.KeloScreenFX.flash('flash_warm_small'); })); panel.appendChild(actions);

    const audit = document.createElement('pre'); audit.style.cssText = 'white-space:pre-wrap;color:#8b949e;margin-top:9px;border-top:1px solid #252b35;padding-top:8px'; panel.appendChild(audit);
    setInterval(function () { if (panel && root.KELO_VISUAL_AUDIT) audit.textContent = JSON.stringify(root.KELO_VISUAL_AUDIT, null, 2); }, 500);
    document.body.appendChild(panel);
  }

  root.KeloVisualLab = Object.freeze({ version: 'visual-lab-v1.0.0', open: build, get enabled() { return enabled(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})(typeof globalThis !== 'undefined' ? globalThis : window);

/* KELO-INDEX
 * area: VISUAL
 * keys: LAB DEBUG GALLERY ANIMATION VFX PROJECTILE SEQUENCE STATUS SFX PREVIEW MOBILE MINIMIZE
 * hace: galería de desarrollo para reproducir piezas visuales sin combate ni piedras
 * online: N/A; solo aparece con ?visualLab=1 y no muta gameplay
 */
(function (root) {
  'use strict';

  let panel = null;
  let body = null;
  let collapsed = false;

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
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;padding:8px 9px;font-weight:800;touch-action:manipulation'; b.onclick = fn; return b;
  }

  function setCollapsed(value) {
    collapsed = value === true;
    if (!panel || !body) return;
    body.style.display = collapsed ? 'none' : 'block';
    panel.style.width = collapsed ? 'auto' : 'min(350px,calc(100vw - 16px))';
    panel.style.maxHeight = collapsed ? '54px' : '90vh';
    panel.style.overflow = collapsed ? 'hidden' : 'auto';
    const toggle = panel.querySelector('[data-visual-lab-toggle]');
    if (toggle) {
      toggle.textContent = collapsed ? '＋' : '−';
      toggle.setAttribute('aria-label', collapsed ? 'Abrir Visual Lab' : 'Minimizar Visual Lab');
    }
    const label = panel.querySelector('[data-visual-lab-dev-label]');
    if (label) label.style.display = collapsed ? 'none' : 'inline';
  }

  function collapseAfterPreview() {
    setTimeout(function () { setCollapsed(true); }, 40);
  }

  function playActivationEyePreview() {
    const p = actor();
    if (!p || !root.KeloFX) return;
    const spawn = function () {
      root.KeloFX.spawn('sword_swap_activation_eye_anim', {
        actor: p,
        actorId: p.id,
        visual: { scale: 1.35, seed: Date.now() & 65535 }
      }, {
        socket: 'head',
        scale: 1.35,
        loop: false,
        duration: 1.0
      });
      collapseAfterPreview();
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_activation_eye_anim_asset')) {
      root.KeloAssetRegistry.load('sword_swap_activation_eye_anim_asset').then(spawn);
    } else spawn();
  }

  function build() {
    if (panel || !document.body) return;
    panel = document.createElement('div'); panel.id = 'kelo-visual-lab';
    panel.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;width:min(350px,calc(100vw - 16px));max-height:90vh;overflow:auto;z-index:100000;background:rgba(7,10,15,.97);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:10px;color:#e6edf3;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;touch-action:pan-y;box-shadow:0 8px 28px rgba(0,0,0,.42)';

    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:28px';
    const title = document.createElement('button'); title.type = 'button'; title.textContent = '👁 VISUAL LAB'; title.style.cssText = 'flex:1;background:transparent;color:#e7c56a;border:0;padding:4px 2px;text-align:left;font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation'; title.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(title);
    const dev = document.createElement('span'); dev.dataset.visualLabDevLabel = '1'; dev.textContent = 'DEV ONLY'; dev.style.cssText = 'color:#78808b;white-space:nowrap'; header.appendChild(dev);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.visualLabToggle = '1'; toggle.textContent = '−'; toggle.setAttribute('aria-label', 'Minimizar Visual Lab'); toggle.style.cssText = 'width:34px;height:30px;background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;font-size:18px;font-weight:900;line-height:1;touch-action:manipulation'; toggle.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(toggle);
    panel.appendChild(header);

    body = document.createElement('div'); body.dataset.visualLabBody = '1'; panel.appendChild(body);
    const hint = document.createElement('div'); hint.textContent = 'Piezas independientes · toca PROBAR y la ventana se minimiza sola para que veas el efecto'; hint.style.cssText = 'color:#78808b;margin:4px 0 9px'; body.appendChild(hint);

    const eyeQuick = button('👁 PROBAR ACTIVATION EYE ANIMADO', playActivationEyePreview);
    eyeQuick.style.cssText += ';display:block;width:100%;margin:0 0 10px;background:#2b1740;border-color:#8b5cf6;color:#f0ddff;font-size:11px';
    body.appendChild(eyeQuick);

    const direction = document.createElement('select'); options(direction, ['right','down','left','up']);
    const scale = document.createElement('input'); scale.type = 'range'; scale.min = '0.5'; scale.max = '2'; scale.step = '0.1'; scale.value = '1';
    const speed = document.createElement('input'); speed.type = 'range'; speed.min = '0.25'; speed.max = '2'; speed.step = '0.25'; speed.value = '1';
    const loop = document.createElement('input'); loop.type = 'checkbox';
    const anchor = document.createElement('select'); options(anchor, ['foot','center','chest','head','hand','weapon','castOrigin','ground']); anchor.value = 'head';
    body.appendChild(row('Dirección', direction)); body.appendChild(row('Escala', scale)); body.appendChild(row('Velocidad', speed)); body.appendChild(row('Loop', loop)); body.appendChild(row('Anchor', anchor));

    const animation = document.createElement('select'); options(animation, root.KeloAnimationRegistry ? root.KeloAnimationRegistry.list() : []); body.appendChild(row('Animation', animation));
    body.appendChild(button('▶ PLAY ANIMATION', function () {
      const p = actor(); if (!p || !root.KeloAnimation) return;
      p._face = direction.value; root.KeloAnimation.play(p, animation.value, { speed: Number(speed.value), loop: loop.checked, force: true, context: { actor: p, visual: { scale: Number(scale.value) } } }); collapseAfterPreview();
    }));

    const fx = document.createElement('select'); options(fx, root.KeloFXRegistry ? root.KeloFXRegistry.list() : []); body.appendChild(row('VFX', fx));
    const eyeIndex = Array.from(fx.options).findIndex(function (option) { return option.value === 'sword_swap_activation_eye_anim'; });
    if (eyeIndex >= 0) fx.selectedIndex = eyeIndex;
    body.appendChild(button('✦ SPAWN VFX', function () {
      const p = actor(), dir = directionOf(direction.value), pos = originFor(dir, 70);
      const def = root.KeloFXRegistry && root.KeloFXRegistry.get(fx.value);
      const isActor = def && def.space === 'ACTOR';
      root.KeloFX && root.KeloFX.spawn(fx.value, { actor: isActor ? p : null, actorId: isActor && p ? p.id : null, origin: isActor ? null : pos, direction: dir, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: anchor.value, scale: Number(scale.value), loop: loop.checked });
      collapseAfterPreview();
    }));

    const projectile = document.createElement('select'); options(projectile, root.KeloProjectileVisualRegistry ? root.KeloProjectileVisualRegistry.list() : []); body.appendChild(row('Projectile', projectile));
    body.appendChild(button('➜ PREVIEW PROJECTILE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloProjectileVisuals && root.KeloProjectileVisuals.preview(projectile.value, { actor: p, actorId: p && p.id, origin: p && root.KeloAnchors ? root.KeloAnchors.get(p, anchor.value) : originFor(dir, 0), direction: dir, gameplay: { speed: 420 * Number(speed.value), range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }); collapseAfterPreview();
    }));

    const sequence = document.createElement('select'); options(sequence, root.KeloSequenceRegistry ? root.KeloSequenceRegistry.list() : []); body.appendChild(row('Sequence', sequence));
    const seqIndex = Array.from(sequence.options).findIndex(function (option) { return option.value === 'sequence_sword_swap_activation_eye_anim'; });
    if (seqIndex >= 0) sequence.selectedIndex = seqIndex;
    body.appendChild(button('▶ PLAY SEQUENCE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloSequence && root.KeloSequence.play(sequence.value, { actor: p, actorId: p && p.id, origin: p ? { x: p.x, y: p.y } : originFor(dir, 0), direction: dir, target: originFor(dir, 100), gameplay: { speed: 420, range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { speed: Number(speed.value), loop: loop.checked }); collapseAfterPreview();
    }));

    const status = document.createElement('select'); const statuses = Object.keys(root.KELO_VISUAL_MANIFESTS.statusVisuals || {}).map(function (id) { return { id: id }; }); options(status, statuses); body.appendChild(row('Status', status));
    body.appendChild(button('◉ PREVIEW STATUS', function () {
      const p = actor(), ref = root.KELO_VISUAL_MANIFESTS.statusVisuals[status.value];
      if (p && ref && root.KeloFX) root.KeloFX.spawn(ref, { actor: p, actorId: p.id, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: 'center', loop: loop.checked }); collapseAfterPreview();
    }));

    const sfx = document.createElement('select'); options(sfx, root.KeloSFXRegistry ? root.KeloSFXRegistry.list() : []); body.appendChild(row('SFX', sfx));
    body.appendChild(button('♪ PLAY SFX', function () { root.KeloSFX && root.KeloSFX.play(sfx.value, { actor: actor() }); }));

    const actions = document.createElement('div'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px';
    actions.appendChild(button('Shake', function () { root.KeloScreenFX && root.KeloScreenFX.shake('impact_medium'); collapseAfterPreview(); }));
    actions.appendChild(button('Flash', function () { root.KeloScreenFX && root.KeloScreenFX.flash('flash_warm_small'); collapseAfterPreview(); })); body.appendChild(actions);

    const audit = document.createElement('pre'); audit.style.cssText = 'white-space:pre-wrap;color:#8b949e;margin-top:9px;border-top:1px solid #252b35;padding-top:8px'; body.appendChild(audit);
    setInterval(function () { if (panel && root.KELO_VISUAL_AUDIT) audit.textContent = JSON.stringify(root.KELO_VISUAL_AUDIT, null, 2); }, 500);
    document.body.appendChild(panel);
    setCollapsed(false);
  }

  root.KeloVisualLab = Object.freeze({
    version: 'visual-lab-v1.2.0',
    open: build,
    minimize: function () { setCollapsed(true); },
    expand: function () { setCollapsed(false); },
    previewActivationEye: playActivationEyePreview,
    get enabled() { return enabled(); },
    get collapsed() { return collapsed; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})(typeof globalThis !== 'undefined' ? globalThis : window);

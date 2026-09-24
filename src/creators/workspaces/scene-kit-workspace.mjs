/* KELO-INDEX
 * area: CREATORS / SCENE KIT WORKSPACE
 * owner: Scene Kit workspace manifest + lightweight picker
 * owns: recipe picker UI and preview dispatch
 * does-not-own: Studio kernel, world publish, asset compiler
 */
import { listSceneKits } from '../assets/scene-kit-catalog.mjs';
import { instantiateSceneKit, clearSceneKitPreview, readSceneKitDraft } from '../assets/scene-kit-instancer.mjs';

function css() {
  return `#kelo-scene-kit{position:fixed;inset:0;z-index:2147482400;background:rgba(7,8,10,.96);color:#f5f3ea;font:750 14px/1.4 Inter,system-ui,-apple-system,sans-serif;display:grid;grid-template-rows:auto 1fr;padding:env(safe-area-inset-top) 16px 24px}
#kelo-scene-kit header{display:flex;align-items:center;gap:12px;min-height:58px}
#kelo-scene-kit h1{margin:0;font-size:18px;letter-spacing:.08em}
#kelo-scene-kit .sk-close{margin-left:auto;border:1px solid rgba(255,255,255,.14);background:#14161b;color:#fff;border-radius:12px;padding:8px 12px;font-weight:800}
#kelo-scene-kit .sk-lead{color:#9aa;margin:0 0 16px}
#kelo-scene-kit .sk-grid{display:grid;gap:10px}
#kelo-scene-kit button.sk-card{text-align:left;border:1px solid rgba(214,179,99,.35);background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02));color:#fff;border-radius:16px;padding:14px;font:inherit}
#kelo-scene-kit button.sk-card small{display:block;color:#8f9095;margin-top:6px}
#kelo-scene-kit .sk-clear{margin-top:14px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#ddd;border-radius:12px;padding:10px 12px;font-weight:800}`;
}

export function createSceneKitWorkspaceManifest() {
  return Object.freeze({
    id: 'scene-kit',
    label: 'Scene Kit',
    category: 'content',
    projectTypes: ['ENVIRONMENT'],
    capability: 'world.edit',
    availability: 'active',
    async open({ root = globalThis } = {}) {
      const doc = root.document;
      if (!doc?.body) throw new Error('SCENE_KIT_DOM_REQUIRED');
      doc.getElementById('kelo-scene-kit')?.remove();
      const style = doc.createElement('style');
      style.setAttribute('data-kelo-scene-kit', '1');
      style.textContent = css();
      const shell = doc.createElement('section');
      shell.id = 'kelo-scene-kit';
      shell.setAttribute('role', 'dialog');
      const draft = readSceneKitDraft(root);
      const kits = listSceneKits().map(kit =>
        `<button type="button" class="sk-card" data-kit="${kit.id}"><strong>${kit.label}</strong><small>${kit.pack} · ${kit.slots.length} piezas · preview local</small></button>`
      ).join('');
      shell.innerHTML = `<header><h1>SCENE KIT</h1><button type="button" class="sk-close" data-sk="close">CERRAR</button></header>
        <div><p class="sk-lead">Planta una receta al lado del jugador. Draft local, sin publicar. Colliders off.</p>
        <div class="sk-grid">${kits}</div>
        <button type="button" class="sk-clear" data-sk="clear">Quitar preview${draft ? ` (${draft.label})` : ''}</button></div>`;
      doc.head.append(style);
      doc.body.append(shell);
      const close = () => {
        try { style.remove(); } catch {}
        try { shell.remove(); } catch {}
      };
      shell.addEventListener('click', event => {
        const btn = event.target.closest('[data-kit],[data-sk]');
        if (!btn) return;
        if (btn.dataset.sk === 'close') { close(); return; }
        if (btn.dataset.sk === 'clear') {
          clearSceneKitPreview(root);
          root.showToast?.('Preview de escena quitado');
          close();
          return;
        }
        try {
          const draftNow = instantiateSceneKit(btn.dataset.kit, { root });
          root.showToast?.(`${draftNow.label} plantada (${draftNow.placements.length} piezas)`);
          try { root.document.getElementById('kelo-creators-hub')?.remove(); } catch {}
          close();
        } catch (error) {
          console.error('[Scene Kit]', error);
          root.showToast?.(String(error?.message || error));
        }
      });
      return Object.freeze({ id: 'scene-kit', root: shell, close });
    }
  });
}

export function registerSceneKitWorkspace(registry) {
  return registry.register(createSceneKitWorkspaceManifest());
}

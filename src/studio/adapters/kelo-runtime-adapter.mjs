/* KELO-INDEX
 * area: STUDIO / KELO ADAPTER
 * owns: only boundary from Studio to current Kelo globals/contracts
 * does-not-own: gameplay rules, editor state, rendering implementation
 * public-api: createKeloRuntimeAdapter()
 * online: persistent mutations delegate to KELO_WORLD_EDIT / system authorities
 * world-surgery: asset catalog is resolved live on every read so a cold phone boot cannot freeze an empty/partial catalog reference.
 */

export function createKeloRuntimeAdapter(root = globalThis) {
  const get = name => root[name] || null;
  const surgery = () => root.KELO_WORLD_SURGERY || null;
  const enabled = id => surgery()?.enabled?.(id) !== false;
  const mark = (id,status,meta={}) => surgery()?.markStatus?.(id,status,{phase:'runtime-adapter',...meta});
  const treeLike = item => /tree|arbol|árbol|oak|pine|willow|birch|forest|vegetation|bush|plant/i.test(`${item?.id||''} ${item?.label||''} ${item?.name||''} ${item?.category||''} ${item?.type||''} ${item?.kind||''}`);
  let commandMirror = null;

  function assetCatalog() {
    if (!enabled('assetCatalog')) {
      mark('assetCatalog','DISABLED',{reason:'kill-switch'});
      mark('treeCatalog','DISABLED',{reason:'assetCatalog-off'});
      return Object.freeze({ get: () => null, list: () => [], categories: () => [] });
    }

    mark('assetCatalog','ACTIVE');
    mark('treeCatalog',enabled('treeCatalog')?'ACTIVE':'DISABLED',{scope:'studio-filter'});
    const liveCatalog = () => get('KELO_PROPERTY_CATALOG');
    const allow = item => enabled('treeCatalog') || !treeLike(item);
    return Object.freeze({
      get(id) {
        const item = liveCatalog()?.get?.(id) || null;
        return item && allow(item) ? item : null;
      },
      list(filter) {
        const rows = liveCatalog()?.list?.(filter) || [];
        return enabled('treeCatalog') ? rows : rows.filter(allow);
      },
      categories() { return liveCatalog()?.categories?.() || []; }
    });
  }

  function worldEditRequest(op, payload) { const edit = get('KELO_WORLD_EDIT'); if (!edit?.request) throw new Error('STUDIO_WORLD_EDIT_NOT_READY'); return edit.request(op, payload || {}); }
  function propertyRequest(op, payload) { const property = get('KELO_PROPERTY_SYSTEM'); if (!property?.request) throw new Error('STUDIO_PROPERTY_NOT_READY'); return property.request(op, payload || {}); }
  function screenToWorld(clientX, clientY) { if (typeof root.screenToWorld === 'function') return root.screenToWorld(clientX, clientY); const zoom = Number(root.CONFIG?.zoom) || 1, camera = root.camera || { x: 0, y: 0 }, width = Number(root.screenW) || root.innerWidth || 0, height = Number(root.screenH) || root.innerHeight || 0; return { x: camera.x + (clientX - width / 2) / zoom, y: camera.y + (clientY - height / 2) / zoom }; }
  function installCommandMirror(fn) { if (fn != null && typeof fn !== 'function') throw new Error('STUDIO_COMMAND_MIRROR_INVALID'); commandMirror = fn || null; return () => { if (commandMirror === fn) commandMirror = null; }; }
  async function mirrorStudioEvent(event, context) { if (!commandMirror) return null; return commandMirror(event, context); }
  return Object.freeze({ assetCatalog: assetCatalog(), worldEditRequest, propertyRequest, screenToWorld, installCommandMirror, mirrorStudioEvent,
    get worldRenderer() { return get('KELO_WORLD_RENDERER'); }, get environmentLayers() { return get('KELO_ENVIRONMENT_LAYERS'); }, get collision() { return get('KELO_COLLISION'); }, get forge() { return get('KELO_FORGE_SYSTEM'); }, get inventory() { return get('KELO_INVENTORY_SYSTEM') || get('KELO_BACKPACK_SYSTEM'); }, get tileRegistry() { return get('KELO_TILE_REGISTRY'); } });
}

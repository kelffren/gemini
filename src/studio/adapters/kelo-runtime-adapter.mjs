/* KELO-INDEX
 * area: STUDIO / KELO ADAPTER
 * owns: only boundary from Studio to current Kelo globals/contracts
 * does-not-own: gameplay rules, editor state, rendering implementation
 * public-api: createKeloRuntimeAdapter()
 * online: persistent mutations delegate to KELO_WORLD_EDIT / system authorities
 */

export function createKeloRuntimeAdapter(root = globalThis) {
  const get = name => root[name] || null;
  let commandMirror = null;
  // Do not capture the catalog at adapter creation. Creator is lazy-loaded on mobile and
  // the property catalog may arrive a few milliseconds later; every read resolves the
  // current global so the library can grow without rebuilding the Studio session.
  function assetCatalog() {
    return {
      get: id => get('KELO_PROPERTY_CATALOG')?.get?.(id) || null,
      list: filter => get('KELO_PROPERTY_CATALOG')?.list?.(filter) || [],
      categories: () => get('KELO_PROPERTY_CATALOG')?.categories?.() || []
    };
  }
  function worldEditRequest(op, payload) { const edit = get('KELO_WORLD_EDIT'); if (!edit?.request) throw new Error('STUDIO_WORLD_EDIT_NOT_READY'); return edit.request(op, payload || {}); }
  function propertyRequest(op, payload) { const property = get('KELO_PROPERTY_SYSTEM'); if (!property?.request) throw new Error('STUDIO_PROPERTY_NOT_READY'); return property.request(op, payload || {}); }
  function screenToWorld(clientX, clientY) { if (typeof root.screenToWorld === 'function') return root.screenToWorld(clientX, clientY); const zoom = Number(root.CONFIG?.zoom) || 1, camera = root.camera || { x: 0, y: 0 }, width = Number(root.screenW) || root.innerWidth || 0, height = Number(root.screenH) || root.innerHeight || 0; return { x: camera.x + (clientX - width / 2) / zoom, y: camera.y + (clientY - height / 2) / zoom }; }
  function installCommandMirror(fn) { if (fn != null && typeof fn !== 'function') throw new Error('STUDIO_COMMAND_MIRROR_INVALID'); commandMirror = fn || null; return () => { if (commandMirror === fn) commandMirror = null; }; }
  async function mirrorStudioEvent(event, context) { if (!commandMirror) return null; return commandMirror(event, context); }
  return Object.freeze({ assetCatalog: assetCatalog(), worldEditRequest, propertyRequest, screenToWorld, installCommandMirror, mirrorStudioEvent,
    get worldRenderer() { return get('KELO_WORLD_RENDERER'); }, get environmentLayers() { return get('KELO_ENVIRONMENT_LAYERS'); }, get collision() { return get('KELO_COLLISION'); }, get forge() { return get('KELO_FORGE_SYSTEM'); }, get inventory() { return get('KELO_INVENTORY_SYSTEM') || get('KELO_BACKPACK_SYSTEM'); }, get tileRegistry() { return get('KELO_TILE_REGISTRY'); } });
}

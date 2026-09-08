/* KELO-INDEX
 * area: STUDIO / COMPILER
 * owns: deterministic authoring -> runtime projection
 * does-not-own: renderer, UI, persistence, gameplay authority
 * public-api: createWorldCompiler()
 * online: pure output can be validated server-side
 */

const clone = value => value == null ? value : structuredClone(value);

function chunkKey(x, y, chunkSize) { return `${Math.floor(x / chunkSize)},${Math.floor(y / chunkSize)}`; }
function rectOf(entity) { return { x: Number(entity.transform?.x) || 0, y: Number(entity.transform?.y) || 0, w: Math.max(1, Number(entity.bounds?.w) || 1), h: Math.max(1, Number(entity.bounds?.h) || 1) }; }

export function createWorldCompiler({ resolvePrefab = id => ({ id }) } = {}) {
  function compile(document, { onlyChunks = null } = {}) {
    const chunkSize = Math.max(64, Number(document.settings?.chunkSize) || 512);
    const allow = onlyChunks ? new Set(onlyChunks.map(x => typeof x === 'string' ? x : x.id)) : null;
    const chunks = new Map(); const dynamicEntities = []; const interactables = []; const colliders = []; const dependencies = new Set(document.dependencies || []);

    for (const source of document.entities || []) {
      const entity = clone(source); const rect = rectOf(entity); const ck = chunkKey(rect.x, rect.y, chunkSize);
      if (allow && !allow.has(ck)) continue;
      const prefab = entity.prefabId ? resolvePrefab(entity.prefabId) : null;
      if (entity.prefabId) dependencies.add(entity.prefabId);
      const components = { ...(prefab?.components || {}), ...(entity.components || {}) };
      const runtime = { id: entity.id, prefabId: entity.prefabId || null, transform: clone(entity.transform || {}), bounds: rect, components };
      if (!chunks.has(ck)) chunks.set(ck, { id: ck, staticEntities: [], dynamicEntities: [] });
      const isDynamic = Boolean(components.animation || components.ai || components.interaction || components.spawner || components.door || components.growZone);
      (isDynamic ? chunks.get(ck).dynamicEntities : chunks.get(ck).staticEntities).push(runtime);
      if (isDynamic) dynamicEntities.push(runtime);
      if (components.interaction || components.container || components.craftingStation) interactables.push(runtime.id);
      if (components.collider) colliders.push({ id: runtime.id, rect: clone(components.collider.rect || rect), blocksMovement: components.collider.blocksMovement !== false });
    }

    const sortedChunks = [...chunks.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const c of sortedChunks) { c.staticEntities.sort((a, b) => a.id.localeCompare(b.id)); c.dynamicEntities.sort((a, b) => a.id.localeCompare(b.id)); }
    return {
      schemaVersion: 1,
      worldId: document.worldId,
      chunkSize,
      chunks: sortedChunks,
      dynamicEntityIds: dynamicEntities.map(x => x.id).sort(),
      interactableIds: interactables.sort(),
      colliders: colliders.sort((a, b) => a.id.localeCompare(b.id)),
      dependencies: [...dependencies].sort(),
      gameRules: clone(document.gameRules || {}),
      generatedFromRevision: clone(document.revision || null)
    };
  }

  return Object.freeze({ compile });
}

/* KELO-INDEX
 * area: STUDIO / RUNTIME DIFF
 * owns: incremental diff between compiled RuntimeWorldBundles
 * does-not-own: renderer/collider application
 * public-api: diffRuntimeBundles()
 * online: no
 */

const signature = value => JSON.stringify(value ?? null);
const byId = rows => new Map((rows || []).map(row => [String(row.id), row]));

export function diffRuntimeBundles(previous, next) {
  const prevChunks = byId(previous?.chunks), nextChunks = byId(next?.chunks), upsertChunks = [], removeChunkIds = [];
  for (const [id, row] of nextChunks) if (!prevChunks.has(id) || signature(prevChunks.get(id)) !== signature(row)) upsertChunks.push(row);
  for (const id of prevChunks.keys()) if (!nextChunks.has(id)) removeChunkIds.push(id);

  const prevColliders = byId(previous?.colliders), nextColliders = byId(next?.colliders), upsertColliders = [], removeColliderIds = [];
  for (const [id, row] of nextColliders) if (!prevColliders.has(id) || signature(prevColliders.get(id)) !== signature(row)) upsertColliders.push(row);
  for (const id of prevColliders.keys()) if (!nextColliders.has(id)) removeColliderIds.push(id);

  const prevDeps = new Set(previous?.dependencies || []), nextDeps = new Set(next?.dependencies || []);
  return {
    worldId: next?.worldId || previous?.worldId || null,
    upsertChunks,
    removeChunkIds: removeChunkIds.sort(),
    upsertColliders,
    removeColliderIds: removeColliderIds.sort(),
    addDependencies: [...nextDeps].filter(id => !prevDeps.has(id)).sort(),
    removeDependencies: [...prevDeps].filter(id => !nextDeps.has(id)).sort()
  };
}

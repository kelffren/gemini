/* KELO-INDEX
 * area: STUDIO / SPATIAL
 * owns: chunk-based lookup for entities/colliders/zones/selection
 * does-not-own: collision resolution or rendering
 * public-api: createSpatialChunkIndex()
 * online: no
 */

export function createSpatialChunkIndex({ chunkSize = 512 } = {}) {
  chunkSize = Math.max(64, Number(chunkSize) || 512);
  const entries = new Map();
  const buckets = new Map();

  const key = (x, y) => `${x},${y}`;
  const rangeFor = r => ({ minX: Math.floor(r.x / chunkSize), minY: Math.floor(r.y / chunkSize), maxX: Math.floor((r.x + Math.max(0, r.w - 1)) / chunkSize), maxY: Math.floor((r.y + Math.max(0, r.h - 1)) / chunkSize) });
  const keysFor = r => { const q = rangeFor(r); const out = []; for (let y = q.minY; y <= q.maxY; y++) for (let x = q.minX; x <= q.maxX; x++) out.push(key(x, y)); return out; };

  function remove(id) {
    id = String(id); const old = entries.get(id); if (!old) return false;
    for (const k of old.__chunks) { const bucket = buckets.get(k); bucket?.delete(id); if (bucket?.size === 0) buckets.delete(k); }
    entries.delete(id); return true;
  }

  function upsert(entry) {
    if (!entry?.id || !entry.rect) throw new Error('STUDIO_SPATIAL_INVALID_ENTRY');
    const id = String(entry.id); remove(id);
    const rect = { x: Number(entry.rect.x) || 0, y: Number(entry.rect.y) || 0, w: Math.max(1, Number(entry.rect.w) || 1), h: Math.max(1, Number(entry.rect.h) || 1) };
    const chunks = keysFor(rect); const row = { ...entry, id, rect, __chunks: chunks };
    entries.set(id, row);
    for (const k of chunks) { if (!buckets.has(k)) buckets.set(k, new Set()); buckets.get(k).add(id); }
    return row;
  }

  function queryRect(rect, { category } = {}) {
    const ids = new Set(); for (const k of keysFor(rect)) for (const id of buckets.get(k) || []) ids.add(id);
    const x2 = rect.x + rect.w, y2 = rect.y + rect.h;
    return [...ids].map(id => entries.get(id)).filter(e => e && (!category || e.category === category) && e.rect.x < x2 && e.rect.x + e.rect.w > rect.x && e.rect.y < y2 && e.rect.y + e.rect.h > rect.y);
  }

  function queryPoint(x, y, options) { return queryRect({ x, y, w: 1, h: 1 }, options); }
  function clear() { entries.clear(); buckets.clear(); }

  return Object.freeze({ upsert, remove, queryRect, queryPoint, clear, get: id => entries.get(String(id)) || null, get chunkSize() { return chunkSize; }, stats: () => ({ entries: entries.size, buckets: buckets.size }) });
}

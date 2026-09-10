/* KELO-INDEX
 * area: STUDIO / SELECT TOOL
 * owns: entity selection from spatial hit testing
 * does-not-own: pointer listeners or drawing
 * public-api: createSelectTool()
 * online: local transient state only
 */

export function createSelectTool(kernel) {
  if (!kernel) throw new Error('STUDIO_SELECT_KERNEL_REQUIRED');

  let lastPick = null;
  const REPEAT_WINDOW_MS = 1200;
  const REPEAT_RADIUS = 12;

  return Object.freeze({
    id: 'select',
    selectPoint(x, y, { append = false, preserveExisting = true, cycle = true } = {}) {
      const px = Number(x) || 0;
      const py = Number(y) || 0;
      const hits = kernel.spatial.queryPoint(px, py, { category: 'entity' });
      const ordered = hits.slice().reverse();

      if (!ordered.length) {
        lastPick = null;
        if (!append) kernel.selection.clear();
        return null;
      }

      if (append) {
        const hit = ordered[0];
        kernel.selection.add(hit.id);
        lastPick = null;
        return hit.data || hit;
      }

      const now = Date.now();
      const stackKey = ordered.map(hit => String(hit.id)).join('\u0001');
      const currentIndex = ordered.findIndex(hit => kernel.selection.has(hit.id));
      const repeated = !!lastPick
        && lastPick.key === stackKey
        && now - lastPick.at <= REPEAT_WINDOW_MS
        && Math.hypot(px - lastPick.x, py - lastPick.y) <= REPEAT_RADIUS;

      let hit = ordered[0];
      if (cycle && repeated && ordered.length > 1 && currentIndex >= 0) {
        hit = ordered[(currentIndex + 1) % ordered.length];
      } else if (preserveExisting && currentIndex >= 0) {
        hit = ordered[currentIndex];
      }

      kernel.selection.set(hit.id);
      lastPick = { x: px, y: py, key: stackKey, at: now };
      return hit.data || hit;
    },
    clear() {
      lastPick = null;
      return kernel.selection.clear();
    }
  });
}

/* KELO-INDEX
 * area: STUDIO / SELECT TOOL
 * owns: entity selection from spatial hit testing
 * does-not-own: pointer listeners or drawing
 * public-api: createSelectTool()
 * online: local transient state only
 */

export function createSelectTool(kernel) {
  if (!kernel) throw new Error('STUDIO_SELECT_KERNEL_REQUIRED');
  return Object.freeze({
    id: 'select',
    selectPoint(x, y, { append = false, preserveExisting = true } = {}) {
      const hits = kernel.spatial.queryPoint(Number(x) || 0, Number(y) || 0, { category: 'entity' });
      const hit = hits[hits.length - 1] || null;
      if (!hit) { if (!append) kernel.selection.clear(); return null; }
      if (append) kernel.selection.add(hit.id);
      else if (!(preserveExisting && kernel.selection.has(hit.id))) kernel.selection.set(hit.id);
      return hit.data || hit;
    },
    clear: () => kernel.selection.clear()
  });
}

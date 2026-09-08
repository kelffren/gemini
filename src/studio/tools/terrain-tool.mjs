/* KELO-INDEX
 * area: STUDIO / TERRAIN TOOL
 * owns: one-cell terrain/path preview and confirmed Command creation
 * does-not-own: terrain rendering, autotile implementation or authority transport
 * public-api: createTerrainTool()
 * online: pointer movement is local preview; pointerup commits one reversible Command
 */

import { createSetSurfaceCellCommand } from '../document/world-surface-commands.mjs';

const snap = (value, size) => Math.floor(Math.max(0, Number(value) || 0) / size) * size;

export function createTerrainTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TERRAIN_KERNEL_REQUIRED');
  let material = 'grass', role = 'terrain', erase = false, preview = null;
  const tileSize = () => Math.max(1, Number(kernel.document.settings?.tileSize) || 32);
  function configure(next = {}) {
    if (next.material != null) material = String(next.material || material);
    if (next.role != null) role = next.role === 'path' ? 'path' : 'terrain';
    if (next.erase != null) erase = !!next.erase;
    if (preview) move(preview.x, preview.y);
    return state();
  }
  function move(x, y) {
    const size = tileSize(), sx = snap(x, size), sy = snap(y, size);
    preview = { x: sx, y: sy, w: size, h: size, material, role, erase };
    return { ...preview };
  }
  async function commit() {
    if (!preview) return null;
    const row = { ...preview, tileSize: tileSize() };
    const serialized = await kernel.execute(createSetSurfaceCellCommand(row));
    return serialized;
  }
  function cancel() { preview = null; }
  function state() { return { material, role, erase, preview: preview ? { ...preview } : null }; }
  return Object.freeze({ id: 'terrain', configure, move, commit, cancel, state, getPreview: () => preview ? { ...preview } : null });
}

/* KELO-INDEX
 * area: STUDIO / TRANSFORM TOOL
 * owns: local transform preview and commit-on-release semantics
 * does-not-own: pointer transport or renderer
 * public-api: createTransformTool()
 * online: drag preview is local; commit becomes one Command
 */

import { createMoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';

export function createTransformTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TRANSFORM_KERNEL_REQUIRED');
  let state = null;
  const find = id => kernel.document.entities.find(e => e.id === String(id)) || null;

  function begin(entityId) {
    const entity = find(entityId); if (!entity) throw new Error('STUDIO_ENTITY_NOT_FOUND');
    state = { entityId: entity.id, from: { ...(entity.transform || {}) }, preview: { ...(entity.transform || {}) } };
    return { ...state, from: { ...state.from }, preview: { ...state.preview } };
  }

  function previewMove(x, y, { snap = 1 } = {}) {
    if (!state) return null; const s = Math.max(1, Number(snap) || 1);
    state.preview.x = Math.round((Number(x) || 0) / s) * s; state.preview.y = Math.round((Number(y) || 0) / s) * s;
    return { ...state.preview };
  }

  function previewRotate(rotation) { if (!state) return null; state.preview.rotation = Number(rotation) || 0; return { ...state.preview }; }
  function cancel() { state = null; }

  async function commit() {
    if (!state) throw new Error('STUDIO_TRANSFORM_NOT_ACTIVE');
    const { entityId, from, preview } = state; state = null;
    const moved = Number(from.x) !== Number(preview.x) || Number(from.y) !== Number(preview.y);
    const rotated = Number(from.rotation || 0) !== Number(preview.rotation || 0);
    if (moved) await kernel.execute(createMoveEntityCommand(entityId, { x: preview.x, y: preview.y }));
    if (rotated) {
      const entity = find(entityId); await kernel.execute(createPatchEntityCommand(entityId, { transform: { ...(entity?.transform || {}), rotation: preview.rotation } }));
    }
    return { entityId, transform: { ...preview }, commands: Number(moved) + Number(rotated) };
  }

  return Object.freeze({ id: 'transform', begin, previewMove, previewRotate, commit, cancel, getPreview: () => state ? { entityId: state.entityId, ...state.preview } : null });
}

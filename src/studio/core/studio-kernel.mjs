/* KELO-INDEX
 * area: STUDIO / KERNEL
 * owns: composition of document, commands, history, selection, registries, spatial index, dirty chunks and tools
 * does-not-own: UI, gameplay implementation, network transport
 * public-api: createStudioKernel()
 * online: adapter can mirror serialized commands after local validation
 */

import { createHistoryManager } from './history-manager.mjs';
import { createCommandBus } from './command-bus.mjs';
import { createInputRouter } from './input-router.mjs';
import { createToolRegistry } from './tool-registry.mjs';
import { createSelectionManager } from './selection-manager.mjs';
import { createComponentRegistry } from '../entities/component-registry.mjs';
import { createPrefabRegistry } from '../entities/prefab-registry.mjs';
import { createSpatialChunkIndex } from '../spatial/spatial-chunk-index.mjs';
import { createDirtyChunkManager } from '../spatial/dirty-chunk-manager.mjs';
import { normalizeWorldDocument } from '../document/world-document.mjs';

const entityRect = e => ({ x: Number(e.transform?.x) || 0, y: Number(e.transform?.y) || 0, w: Math.max(1, Number(e.bounds?.w) || 1), h: Math.max(1, Number(e.bounds?.h) || 1) });

export function createStudioKernel({ document, adapter = null, historyBudgetBytes } = {}) {
  let current = normalizeWorldDocument(document || {}), spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize }), dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize });
  const history = createHistoryManager({ budgetBytes: historyBudgetBytes }), input = createInputRouter(), selection = createSelectionManager(), components = createComponentRegistry(), prefabs = createPrefabRegistry();
  let kernel = null;
  function rebuildSpatial() { spatial.clear(); for (const e of current.entities) if (e?.id) spatial.upsert({ id: e.id, category: 'entity', rect: entityRect(e), data: e }); }
  function syncEntity(id) { if (!id) return; const e = current.entities.find(row => row.id === id); if (e) spatial.upsert({ id: e.id, category: 'entity', rect: entityRect(e), data: e }); else spatial.remove(id); }
  function markRects(rects, reason) { for (const rect of rects || []) if (rect) dirty.markRect(rect, reason || 'edit'); }
  const commandBus = createCommandBus({ history, onAfterExecute: async event => { const s = event.command || {}; syncEntity(s.id || s.entity?.id); markRects(event.affectedRects, s.type || 'edit'); } });
  const execute = command => commandBus.execute(command, { document: current, kernel, adapter });
  async function undo() { const entry = await history.undo(); if (!entry) return null; rebuildSpatial(); markRects(entry.affectedRects, `undo:${entry.type || 'command'}`); return entry; }
  async function redo() { const entry = await history.redo(); if (!entry) return null; rebuildSpatial(); markRects(entry.affectedRects, `redo:${entry.type || 'command'}`); return entry; }
  function setDocument(next) { current = normalizeWorldDocument(next); spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize }); dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize }); history.clear(); selection.clear(); rebuildSpatial(); return current; }
  kernel = { version: 'studio-kernel-v1.2.0', execute, undo, redo, setDocument,
    get document() { return current; }, get adapter() { return adapter; }, get history() { return history; }, get commands() { return commandBus; }, get input() { return input; }, get selection() { return selection; }, get components() { return components; }, get prefabs() { return prefabs; }, get spatial() { return spatial; }, get dirty() { return dirty; } };
  kernel.tools = createToolRegistry({ kernel }); rebuildSpatial(); return Object.freeze(kernel);
}

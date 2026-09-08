/* KELO-INDEX
 * area: STUDIO / KERNEL
 * owns: composition of document, commands, history, spatial index, dirty chunks and tools
 * does-not-own: UI, gameplay implementation, network transport
 * public-api: createStudioKernel()
 * online: adapter can mirror serialized commands after local validation
 */

import { createHistoryManager } from './history-manager.mjs';
import { createCommandBus } from './command-bus.mjs';
import { createInputRouter } from './input-router.mjs';
import { createToolRegistry } from './tool-registry.mjs';
import { createSpatialChunkIndex } from '../spatial/spatial-chunk-index.mjs';
import { createDirtyChunkManager } from '../spatial/dirty-chunk-manager.mjs';
import { normalizeWorldDocument } from '../document/world-document.mjs';

function entityRect(e) { return { x: Number(e.transform?.x) || 0, y: Number(e.transform?.y) || 0, w: Math.max(1, Number(e.bounds?.w) || 1), h: Math.max(1, Number(e.bounds?.h) || 1) }; }

export function createStudioKernel({ document, adapter = null, historyBudgetBytes } = {}) {
  let current = normalizeWorldDocument(document || {});
  let spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize });
  let dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize });
  const history = createHistoryManager({ budgetBytes: historyBudgetBytes });
  const input = createInputRouter();
  let kernel = null;

  function rebuildSpatial() {
    spatial.clear();
    for (const e of current.entities) if (e?.id) spatial.upsert({ id: e.id, category: 'entity', rect: entityRect(e), data: e });
  }

  function syncEntity(id) {
    if (!id) return;
    const entity = current.entities.find(e => e.id === id);
    if (entity) spatial.upsert({ id: entity.id, category: 'entity', rect: entityRect(entity), data: entity });
    else spatial.remove(id);
  }

  function markRects(rects, reason) {
    for (const rect of rects || []) if (rect) dirty.markRect(rect, reason || 'edit');
  }

  const commandBus = createCommandBus({
    history,
    onAfterExecute: async event => {
      const serialized = event.command || {};
      syncEntity(serialized.id || serialized.entity?.id);
      markRects(event.affectedRects, serialized.type || 'edit');
    }
  });

  async function execute(command) {
    return commandBus.execute(command, { document: current, kernel, adapter });
  }

  async function undo() {
    const entry = await history.undo();
    if (!entry) return null;
    rebuildSpatial();
    markRects(entry.affectedRects, `undo:${entry.type || 'command'}`);
    return entry;
  }

  async function redo() {
    const entry = await history.redo();
    if (!entry) return null;
    rebuildSpatial();
    markRects(entry.affectedRects, `redo:${entry.type || 'command'}`);
    return entry;
  }

  function setDocument(next) {
    current = normalizeWorldDocument(next);
    spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize });
    dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize });
    history.clear(); rebuildSpatial();
    return current;
  }

  kernel = {
    version: 'studio-kernel-v1.0.0',
    execute, undo, redo, setDocument,
    get document() { return current; },
    get adapter() { return adapter; },
    get history() { return history; },
    get input() { return input; },
    get spatial() { return spatial; },
    get dirty() { return dirty; }
  };
  kernel.tools = createToolRegistry({ kernel });
  rebuildSpatial();
  return Object.freeze(kernel);
}

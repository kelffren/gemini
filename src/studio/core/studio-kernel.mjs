/* KELO-INDEX
 * area: STUDIO / KERNEL
 * owns: document, commands, history, selection, registries, spatial index, dirty chunks and tools
 * does-not-own: UI, gameplay implementation, network transport
 * public-api: createStudioKernel()
 * online: adapter mirror is transactional; failed authority writes roll local state back
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

function collectEntityIds(command, out = new Set()) {
  if (!command || typeof command !== 'object') return out;
  if (String(command.type || '').startsWith('entity.')) {
    if (command.id) out.add(String(command.id));
    if (command.entity?.id) out.add(String(command.entity.id));
  }
  if (Array.isArray(command.commands)) for (const child of command.commands) collectEntityIds(child, out);
  return out;
}

export function createStudioKernel({ document, adapter = null, historyBudgetBytes } = {}) {
  let current = normalizeWorldDocument(document || {}), spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize }), dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize });
  const history = createHistoryManager({ budgetBytes: historyBudgetBytes }), input = createInputRouter(), selection = createSelectionManager(), components = createComponentRegistry(), prefabs = createPrefabRegistry();
  let kernel = null;
  function rebuildSpatial() { spatial.clear(); for (const e of current.entities) if (e?.id) spatial.upsert({ id: e.id, category: 'entity', rect: entityRect(e), data: e }); }
  function syncEntity(id) { if (!id) return; const e = current.entities.find(row => row.id === id); if (e) spatial.upsert({ id: e.id, category: 'entity', rect: entityRect(e), data: e }); else spatial.remove(id); }
  function syncCommandEntities(command) { for (const id of collectEntityIds(command)) syncEntity(id); }
  function markRects(rects, reason) { for (const rect of rects || []) if (rect) dirty.markRect(rect, reason || 'edit'); }
  async function mirror(event) { if (typeof adapter?.mirrorStudioEvent === 'function') await adapter.mirrorStudioEvent(event, { document: current, kernel }); }
  const commandBus = createCommandBus({ history, onAfterExecute: async event => { await mirror(event); const s = event.command || {}; syncCommandEntities(s); markRects(event.affectedRects, s.type || 'edit'); }, onRollback: async event => { rebuildSpatial(); markRects(event.affectedRects, 'rollback'); } });
  const execute = command => commandBus.execute(command, { document: current, kernel, adapter });
  async function undo() { const entry = await history.undo(); if (!entry) return null; const event = { type: 'undo', command: entry.serialized, affectedRects: entry.affectedRects || [] }; try { await mirror(event); } catch (error) { await history.redo(); rebuildSpatial(); throw error; } rebuildSpatial(); markRects(event.affectedRects, `undo:${entry.type || 'command'}`); commandBus.emit(event); return entry; }
  async function redo() { const entry = await history.redo(); if (!entry) return null; const event = { type: 'redo', command: entry.serialized, affectedRects: entry.affectedRects || [] }; try { await mirror(event); } catch (error) { await history.undo(); rebuildSpatial(); throw error; } rebuildSpatial(); markRects(event.affectedRects, `redo:${entry.type || 'command'}`); commandBus.emit(event); return entry; }
  function setDocument(next) { current = normalizeWorldDocument(next); spatial = createSpatialChunkIndex({ chunkSize: current.settings.chunkSize }); dirty = createDirtyChunkManager({ chunkSize: current.settings.chunkSize }); history.clear(); selection.clear(); rebuildSpatial(); return current; }
  kernel = { version: 'studio-kernel-v1.5.0', execute, undo, redo, setDocument, get document() { return current; }, get adapter() { return adapter; }, get history() { return history; }, get commands() { return commandBus; }, get input() { return input; }, get selection() { return selection; }, get components() { return components; }, get prefabs() { return prefabs; }, get spatial() { return spatial; }, get dirty() { return dirty; } };
  kernel.tools = createToolRegistry({ kernel }); rebuildSpatial(); return Object.freeze(kernel);
}

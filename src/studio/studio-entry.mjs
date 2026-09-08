/* KELO-INDEX
 * area: STUDIO / ENTRY
 * owns: lazy Studio boot only
 * does-not-own: automatic game startup or legacy builder replacement
 * public-api: bootKeloStudio()
 * online: authority remains KELO_WORLD_EDIT
 */

import { createStudioKernel } from './core/studio-kernel.mjs';
import { createWorldDocument } from './document/world-document.mjs';
import { createWorldCompiler } from './compiler/world-compiler.mjs';
import { createStudioWorkerClient } from './compiler/worker-client.mjs';
import { createKeloRuntimeAdapter } from './adapters/kelo-runtime-adapter.mjs';

let session = null;

export async function bootKeloStudio({ mode = 'world', actorId = null, document = null, root = globalThis } = {}) {
  if (session) return session;
  const adapter = createKeloRuntimeAdapter(root);
  const initial = document || createWorldDocument({ worldId: mode === 'parcel' ? `parcel:${actorId || 'local'}` : 'world:kelo-main', metadata: { name: mode === 'parcel' ? 'My Parcel' : 'Kelo World', description: '', tags: [mode] }, settings: { tileSize: root.KELO_TILE_REGISTRY?.worldTileSize || 32, chunkSize: root.KELO_WORLD_RENDERER?.chunkSize || 512 } });
  const kernel = createStudioKernel({ document: initial, adapter });
  const resolvePrefab = id => kernel.prefabs.resolve(id) || adapter.assetCatalog.get(id) || { id };
  const compiler = createWorldCompiler({ resolvePrefab });
  const worker = createStudioWorkerClient({ resolvePrefab, prefabSnapshot: () => Object.fromEntries(kernel.prefabs.list().map(p => [p.id, kernel.prefabs.resolve(p.id)])) });
  session = Object.freeze({ version: 'kelo-studio-foundation-v1.1.0', mode, actorId, kernel, compiler, worker, adapter, compile: options => compiler.compile(kernel.document, options), compileAsync: options => worker.compile(kernel.document, options), close() { worker.close(); session = null; } });
  return session;
}

export function getKeloStudioSession() { return session; }
if (typeof window !== 'undefined') { window.KELO_STUDIO_LAZY_BOOT = bootKeloStudio; window.KELO_STUDIO_FOUNDATION_AUDIT = Object.freeze({ version: 'kelo-studio-foundation-v1.1.0', autoBoot: false, runtimeDependencyCount: 0, lazyEntry: true, workerReady: true }); }

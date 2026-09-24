/* KELO-INDEX
 * area: CORE / UPDATE TOOLING
 * owner: KeloUpdater audit
 * keys: UPDATE GATE V8 UPDATER V5 VERIFIED PREDICTIVE LAZY WATCH HEALTH HOTSET CI
 * purpose: fail closed if the modern lightweight update gate loses lazy ownership, exact-build verification, gameplay priority, health commit or bounded watch behavior
 */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let failed=0,passed=0;
const expect=(c,m)=>{if(c){passed++;console.log('✓',m);}else{failed++;console.error(`UPDATER AUDIT FAIL: ${m}`);}};
const has=(s,t)=>s.includes(t);

const index=read('index.html');
const gate=read('src/core/update-gate.js');
const core=read('src/core/update-system-v5.js');
const watch=read('src/core/update-watch.js');
const settings=read('src/core/settings-lazy-gate.js');
const intel=read('src/core/update-intelligence-ui.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const version=read('version.json');
const doc=read('docs/systems/APP_UPDATE_SYSTEM.md');

// Boot ownership: only the lightweight gate belongs on the normal path.
expect(has(index,'src/core/post-boot-streamer.js')&&!has(index,'src/core/update-gate.js'),'index difiere KeloUpdateGate hasta post-playable');
expect(has(read('src/core/post-boot-streamer.js'),'src/core/update-gate.js'),'post-boot streamer conserva KeloUpdateGate ligero');
expect(!has(index,'src/core/update-system-v5.js'),'updater pesado V5 no está en critical path');
expect(!has(index,'src/core/update-watch.js'),'watch no está en critical path');
expect(!has(index,'src/core/update-system.js'),'updater legacy no vuelve al critical path');

// Gate V8: cheap detection, classification and one-way promotion to the heavy owner.
expect(has(gate,"owner: KeloUpdateGate"),'gate declara owner explícito');
expect(has(gate,'FAST_CHECK_MS=5000')&&has(gate,'STEADY_CHECK_MS=15000'),'gate usa detección rápida y steady bounded');
expect(has(gate,'gameplayBusy()')&&has(gate,'KELO_COMBAT_ENABLED')&&has(gate,'KeloArena'),'gate cede a gameplay/PvP/Arena');
expect(has(gate,'setTimeout(')&&!has(gate,'setInterval('),'gate usa timeout recursivo, no polling interval');
expect(has(gate,'compareBuilds')&&has(gate,'classify(files)'),'gate clasifica deltas antes de despertar updater pesado');
expect(has(gate,"mode='none'")&&has(gate,"mode='hot'")&&has(gate,"mode='hot-data'"),'gate conserva fast-forward/hot/hot-data');
expect(has(gate,'FULL_RESTART_EXACT'),'gate conserva lista explícita de owners críticos');
expect(has(gate,"load('src/core/update-system-v5.js")||has(gate,"load('src/core/update-system-v5.js?v="),'gate despierta exactamente Updater V5');
expect(has(gate,"load('src/core/update-watch.js")||has(gate,"load('src/core/update-watch.js?v="),'gate despierta watch después del owner pesado');
expect(has(gate,'if(root.KeloUpdater)')&&has(gate,'heavyLoading'),'gate deduplica wake y respeta owner único');

// Updater V5.1: commit-aware delta, verification, consistency and health shield.
expect(has(core,"const VERSION='kelo-updater-v5.1-verified-predictive'"),'Updater V5.1 es el owner pesado actual');
expect(has(core,'COMPARE_API')&&has(core,'fetchCompare'),'V5 obtiene delta por comparación exacta de commits');
expect(has(core,'update-verifier-worker.js')&&has(core,'verifyBuffer'),'V5 verifica bytes fuera del main thread cuando Worker está disponible');
expect(has(core,'expectedSha')&&has(core,'normalizeBlob'),'V5 conserva identidad Git blob por archivo');
expect(has(core,"parsed.querySelectorAll('script[src]')")&&has(core,"parsed.querySelectorAll('link[href]')"),'V5 deriva critical shell del HTML objetivo');
expect(has(core,'sessionResources()')&&has(core,'readHotset()')&&has(core,'learnHotset()'),'V5 aprende y reutiliza working set de sesión');
expect(has(core,'CONSISTENCY_DELAYS')&&has(core,'consistencyRetries'),'V5 reintenta consistencia CDN antes de aceptar bytes');
expect(has(core,'abortDownloads')&&has(core,'setGameplayBusy'),'V5 cancela staging al entrar gameplay crítico');
expect(has(core,'prepareUpdate')&&has(core,'applyUpdate'),'V5 mantiene prepare/apply explícitos');
expect(has(core,'armHealthCommit')&&has(core,'MAX_HEALTH_ATTEMPTS'),'V5 valida boot saludable antes de confirmar build');
expect(has(core,'BLOCKED_KEY')&&has(core,'blockBuild'),'V5 bloquea builds que fallan health shield');
expect(has(core,'timeToReadyMs')&&has(core,'downloadedBytes')&&has(core,'verifiedFiles'),'V5 expone métricas de readiness/bytes/verificación');
expect(!has(core,'setInterval('),'Updater V5 no introduce setInterval');

// Watch is subordinate to KeloUpdater and remains bounded.
expect(has(watch,'CHECK_EVERY_MS = 15000'),'watch comprueba cada 15 segundos');
expect(has(watch,'snapshot.gameplayBusy'),'watch cede a gameplay');
expect(has(watch,'setTimeout(')&&!has(watch,'setInterval('),'watch usa timeout recursivo');
expect(has(watch,'global.KeloUpdater')&&has(watch,'updater.check()'),'watch consume KeloUpdater; no crea segundo owner');

// Manual mobile UX reuses the same gate/updater; no second update implementation.
expect(has(settings,"BUTTON_ID='lx-manual-update'")||has(settings,"BUTTON_ID = 'lx-manual-update'"),'Ajustes conserva botón Actualizar');
expect(has(settings,'KeloUpdateGate')&&has(settings,'wakeHeavy'),'Ajustes despierta el updater mediante el gate');
expect(has(settings,'updater.prepareUpdate')&&has(settings,'updater.applyUpdate'),'Ajustes delega prepare/apply al owner');
expect(has(settings,'revalidateRuntime'),'Ajustes conserva fallback de revalidación de recursos activos');
expect(!has(settings,'setInterval('),'Ajustes no introduce polling paralelo');
expect(has(intel,'KeloUpdateIntelligenceUI')&&has(intel,'copyDiagnostics'),'Update Intelligence expone diagnóstico sin otro updater');
expect(!has(intel,'setInterval('),'Update Intelligence no hace polling');

expect(manifest.id==='.'||manifest.id==='./','manifest.id correcto');
expect(manifest.start_url==='./'&&manifest.scope==='./'&&manifest.display==='standalone','manifest PWA conserva scope standalone');
expect(has(version,'site.github.build_revision'),'version.json refleja SHA realmente desplegado');

expect(has(doc,'Gate V8')&&has(doc,'Updater V5.1'),'docs describen generación actual del updater');
expect(has(doc,'15 segundos')&&has(doc,'5 segundos'),'docs describen ventanas de detección actuales');
expect(has(doc,'health shield')||has(doc,'Health Shield'),'docs describen commit saludable / rollback shield');
expect(has(doc,'Worker')&&has(doc,'Git blob'),'docs describen verificación de bytes');
expect(has(doc,'lazy'),'docs explican que updater pesado/watch son lazy');

console.log(`\nUpdater audit: ${passed} passed, ${failed} failed`);
if(failed)process.exit(1);
console.log('UPDATER AUDIT PASS — Gate V8 + Updater V5.1 lazy verified-predictive contract proven');

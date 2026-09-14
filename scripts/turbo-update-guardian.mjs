/* KELO-INDEX
 * area: CORE
 * owner: Turbo Update Guardian
 * keys: TURBO UPDATE DELTA HASH CACHE BUILD CHUNKS LAZY PRIORITY STORAGE HEADERS BROTLI METRICS CI TEST
 * purpose: fail closed until all 15 Turbo Update guarantees have concrete repository/build evidence
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => exists(p) ? fs.readFileSync(path.join(root, p), 'utf8') : '';
const has = (p, ...needles) => {
  const text = read(p);
  return needles.every((needle) => text.includes(needle));
};
const anyHas = (paths, needle) => paths.some((p) => read(p).includes(needle));
const regexAny = (paths, re) => paths.some((p) => re.test(read(p)));

const packageJson = (() => {
  try { return JSON.parse(read('package.json')); } catch { return {}; }
})();
const scripts = packageJson.scripts || {};
const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

const sourceFiles = ['src/core/update-system.js','src/core/update-watch.js','src/ui/update-ui.js','sw.js'];
const buildConfigs = ['vite.config.js','vite.config.mjs','vite.config.ts','rollup.config.js','rollup.config.mjs','webpack.config.js','webpack.config.cjs','esbuild.config.js','scripts/turbo-build.mjs'];
const headerConfigs = ['_headers','public/_headers','netlify.toml','vercel.json','firebase.json','nginx.conf','.github/workflows/pages.yml','.github/workflows/deploy-pages.yml'];
const contractDoc = 'docs/systems/TURBO_UPDATE_CONTRACT.md';
const hostingDoc = 'docs/evidence/TURBO_UPDATE_HOSTING_EVIDENCE.md';

function check(id, title, pass, evidence, blocker) {
  return { id, title, pass: !!pass, evidence, blocker: blocker || null };
}

const buildConfigPresent = buildConfigs.some(exists);
const productionBuildScript = typeof scripts.build === 'string' && scripts.build.trim().length > 0;
const manifestGenerator = exists('scripts/generate-turbo-manifest.mjs') || exists('scripts/turbo-build.mjs');
const deltaManifestRuntime = anyHas(sourceFiles, 'turbo-update-manifest') || anyHas(sourceFiles, 'delta-manifest');
const globalCache = anyHas(sourceFiles, 'kelo-turbo-assets-v1') || anyHas(sourceFiles, 'TURBO_ASSET_CACHE');
const contentHashConfig = regexAny(buildConfigs, /\[(?:content)?hash(?::\d+)?\]|entryFileNames[^\n]*hash|chunkFileNames[^\n]*hash|assetFileNames[^\n]*hash/);
const activationReuse = globalCache && (anyHas(sourceFiles, 'sha256') || anyHas(sourceFiles, 'contentHash') || anyHas(sourceFiles, 'hash'));
const minifyEvidence = regexAny(buildConfigs, /minify|terser|esbuild/) || ['vite','rollup','webpack','esbuild'].some((d) => dependencies[d]);
const treeShakeEvidence = regexAny(buildConfigs, /tree.?shak|treeshake/) || ['vite','rollup','esbuild'].some((d) => dependencies[d]);
const codeSplitEvidence = regexAny(buildConfigs, /manualChunks|splitChunks|codeSplitting|splitting\s*:\s*true/);
const legacyCompilerException = has(contractDoc, 'LEGACY_COMPILER_EXCEPTION', 'scope:', 'migration:');
const lazyEvidence = anyHas(['index.html', ...sourceFiles], 'import(') && ['studio','world','map-forge','visual'].every((term) => anyHas(['index.html', ...sourceFiles, contractDoc], term));
const adaptiveParallel = anyHas(sourceFiles, 'effectiveType') && anyHas(sourceFiles, 'saveData') && (anyHas(sourceFiles, 'concurrency') || anyHas(sourceFiles, 'parallel'));
const pvpAbsolutePause = regexAny(sourceFiles, /(combat|pvp|arena)[\s\S]{0,240}(concurrency\s*[:=]\s*0|return\s+0|allow\s*:\s*false)/i);
const fetchPriority = (anyHas(sourceFiles, "priority: 'high'") || anyHas(sourceFiles, 'priority: "high"')) && (anyHas(sourceFiles, "priority: 'low'") || anyHas(sourceFiles, 'priority: "low"'));
const persistentStorage = anyHas(sourceFiles, 'navigator.storage.persist') || anyHas(sourceFiles, 'storage.persist(');
const persistenceFallback = has(contractDoc, 'STORAGE_PERSIST_FALLBACK');
const immutableHeaders = regexAny(headerConfigs, /immutable/i);
const revalidateHeaders = regexAny(headerConfigs, /no-cache|max-age=0|must-revalidate/i);
const compressionEvidence = regexAny(headerConfigs, /brotli|gzip|content-encoding|\.br\b|\.gz\b/i) || regexAny(buildConfigs, /brotli|gzip/i);
const transportEvidence = regexAny(headerConfigs, /http\/2|http2|http\/3|http3|cdn/i) || has(hostingDoc, 'TRANSPORT_VERIFIED');
const transportLimitationPlan = has(hostingDoc, 'HOSTING_LIMITATION', 'MIGRATION_PLAN');
const metricsEvidence = anyHas(sourceFiles, 'Update Delta Bytes') && anyHas(sourceFiles, 'Time To Update Ready');
const guardianWorkflow = exists('.github/workflows/turbo-update-guardian.yml') && has('.github/workflows/turbo-update-guardian.yml', 'npm run audit:turbo');
const guardianScript = scripts['audit:turbo'] === 'node scripts/turbo-update-guardian.mjs';
const documentation = exists(contractDoc) && has(contractDoc, 'ACCEPTANCE CRITERIA', 'EVIDENCE', 'REGRESSION POLICY');
const deltaTestFile = exists('scripts/turbo-delta-test.mjs') || exists('tests/turbo-update-delta.spec.js') || exists('tests/turbo-update-delta.spec.mjs');
const deltaTestScript = typeof scripts['test:turbo-delta'] === 'string' && scripts['test:turbo-delta'].length > 0;
const deltaTestWired = exists('.github/workflows/turbo-update-guardian.yml') && has('.github/workflows/turbo-update-guardian.yml', 'npm run test:turbo-delta');
const deltaTestAssertions = deltaTestFile && regexAny(['scripts/turbo-delta-test.mjs','tests/turbo-update-delta.spec.js','tests/turbo-update-delta.spec.mjs'], /0\s*bytes|zero\s*bytes|deltaBytes\s*===\s*0|strictEqual\([^,]+,\s*0\)/i) && regexAny(['scripts/turbo-delta-test.mjs','tests/turbo-update-delta.spec.js','tests/turbo-update-delta.spec.mjs'], /single|one file|1 file|changed.*1|delta.*1/i);

const manifestPath = ['dist/turbo-update-manifest.json','turbo-update-manifest.json'].find(exists);
let manifestIntegrity = false;
let manifestEvidence = 'No generated manifest available in repository/workspace.';
if (manifestPath) {
  try {
    const manifest = JSON.parse(read(manifestPath));
    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    manifestIntegrity = entries.length > 0 && entries.every((entry) => {
      const identity = entry.sha256 || entry.hash || entry.contentHash;
      if (!entry || !(entry.path || entry.url) || !/^[a-f0-9]{32,64}$/i.test(String(identity || ''))) return false;
      const relative = entry.path || String(entry.url || '').replace(/^\.?\//, '');
      const file = path.join(root, relative);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
      if (String(identity).length !== 64) return true;
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      return actual === String(identity).toLowerCase();
    });
    manifestEvidence = manifestIntegrity ? `${manifestPath}: content identities verified against build bytes.` : `${manifestPath}: present but identities/bytes do not verify.`;
  } catch (error) {
    manifestEvidence = `${manifestPath}: invalid JSON (${error.message}).`;
  }
}

const checks = [
  check('TU-01','Delta manifest por archivo con identidad/hash de contenido', manifestGenerator && deltaManifestRuntime && manifestIntegrity, `${manifestGenerator ? 'generator present' : 'generator missing'}; ${deltaManifestRuntime ? 'runtime consumes manifest' : 'runtime does not consume manifest'}; ${manifestEvidence}`, 'Generate the production manifest and verify identities against emitted bytes.'),
  check('TU-02','Cache global content-addressed reutilizable entre builds', globalCache, globalCache ? 'Stable global content cache marker found.' : 'Only build-scoped staging cache is proven.', 'Use a stable content-addressed cache; unchanged objects must survive build changes and cost 0 network bytes.'),
  check('TU-03','Chunks/objetos hashados + activación reutilizable', contentHashConfig && activationReuse, `hashed naming=${contentHashConfig}; activation reuse=${activationReuse}`, 'Hash object URLs/names and make activation resolve/reuse those exact cached objects.'),
  check('TU-04','Compiler prod: minify + tree-shake + code split (or explicit legacy exception)', (productionBuildScript && buildConfigPresent && minifyEvidence && treeShakeEvidence && codeSplitEvidence) || legacyCompilerException, `build=${productionBuildScript}; config=${buildConfigPresent}; minify=${minifyEvidence}; treeShake=${treeShakeEvidence}; split=${codeSplitEvidence}; legacyException=${legacyCompilerException}`, 'Add a real production compiler, or document a narrowly scoped legacy exception with migration evidence.'),
  check('TU-05','Boot crítico separado de Studio/World Editor/Map Forge/Visual Lab lazy', lazyEvidence && codeSplitEvidence, `lazyEvidence=${lazyEvidence}; split=${codeSplitEvidence}`, 'Prove creator tools are absent from critical boot and loaded only on demand.'),
  check('TU-06','Paralelismo adaptativo + pausa absoluta en PVP/combate', adaptiveParallel && pvpAbsolutePause, `adaptive=${adaptiveParallel}; pvpPause=${pvpAbsolutePause}`, 'Implement a tested concurrency governor; PVP/combat must force zero updater transfers.'),
  check('TU-07','Fetch Priority low background / high explicit apply', fetchPriority, fetchPriority ? 'Both priority modes found.' : 'Queue ordering alone is insufficient.', 'Use RequestInit priority with graceful unsupported-browser fallback.'),
  check('TU-08','navigator.storage.persist() o fallback documentado', persistentStorage || persistenceFallback, `persist=${persistentStorage}; fallback=${persistenceFallback}`, 'Request persistence where supported and document behavior when denied/unavailable.'),
  check('TU-09','Cache-Control immutable hashados + revalidation HTML/version/manifests', immutableHeaders && revalidateHeaders, `immutable=${immutableHeaders}; revalidate=${revalidateHeaders}`, 'Provide deploy/header config and verify live headers.'),
  check('TU-10','Compresión Brotli/Gzip', compressionEvidence, `compression=${compressionEvidence}`, 'Produce/serve compressed JS/CSS/JSON and retain deploy evidence.'),
  check('TU-11','HTTP/2/HTTP/3/CDN o limitación + plan ejecutable', transportEvidence || transportLimitationPlan, `verifiedTransport=${transportEvidence}; limitationPlan=${transportLimitationPlan}`, 'Record live protocol/CDN evidence, or an explicit current-host limitation plus executable migration plan.'),
  check('TU-12','Update Delta Bytes + Time To Update Ready', metricsEvidence, metricsEvidence ? 'Both required metrics found in runtime.' : 'Required update metrics are not instrumented.', 'Expose both metrics in updater state/events and audit them.'),
  check('TU-13','CI/guardian fail-closed', guardianWorkflow && guardianScript, `workflow=${guardianWorkflow}; npmScript=${guardianScript}`, 'Wire the guardian to push/PR and make this command mandatory.'),
  check('TU-14','Documentación actualizada', documentation, documentation ? 'Contract document contains acceptance/evidence/regression sections.' : 'Contract documentation is absent or incomplete.', 'Maintain the Turbo contract as the acceptance source of truth.'),
  check('TU-15','Pruebas: 1 archivo => solo delta; build idéntica => 0 bytes', deltaTestFile && deltaTestScript && deltaTestWired && deltaTestAssertions, `file=${deltaTestFile}; script=${deltaTestScript}; wired=${deltaTestWired}; assertions=${deltaTestAssertions}`, 'Add deterministic tests that measure bytes, not just file counts, and run them in CI.')
];

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
console.log(`TURBO UPDATE GUARDIAN: ${passed}/${checks.length} guarantees proven`);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.title}`);
  console.log(`  evidence: ${c.evidence}`);
  if (!c.pass && c.blocker) console.log(`  blocker: ${c.blocker}`);
}

if (failed.length) {
  console.error(`TURBO UPDATE CONTRACT INCOMPLETE: ${failed.length} guarantee(s) lack sufficient evidence.`);
  process.exit(1);
}
console.log('TURBO UPDATE CONTRACT COMPLETE: all 15 guarantees have repository/build evidence.');
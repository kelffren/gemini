/* KELO-INDEX
 * area: CORE
 * owner: Turbo Update Guardian
 * keys: TURBO UPDATE DELTA HASH CACHE BUILD CHUNKS LAZY PRIORITY STORAGE HEADERS BROTLI METRICS CI
 * purpose: fail closed until every Turbo Update contract requirement has concrete repository/build evidence
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

const packageJson = (() => {
  try { return JSON.parse(read('package.json')); } catch { return {}; }
})();
const scripts = packageJson.scripts || {};
const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

const sourceFiles = [
  'src/core/update-system.js',
  'src/core/update-watch.js',
  'src/ui/update-ui.js',
  'sw.js'
];
const buildConfigs = ['vite.config.js','vite.config.mjs','vite.config.ts','rollup.config.js','rollup.config.mjs','webpack.config.js','webpack.config.cjs','esbuild.config.js','scripts/turbo-build.mjs'];
const headerConfigs = ['_headers','public/_headers','netlify.toml','vercel.json','firebase.json','nginx.conf','.github/workflows/pages.yml','.github/workflows/deploy-pages.yml'];

function check(id, title, pass, evidence, blocker) {
  return { id, title, pass: !!pass, evidence, blocker: blocker || null };
}

const buildConfigPresent = buildConfigs.some(exists);
const productionBuildScript = typeof scripts.build === 'string' && scripts.build.trim().length > 0;
const manifestGenerator = exists('scripts/generate-turbo-manifest.mjs') || exists('scripts/turbo-build.mjs');
const deltaManifestRuntime = anyHas(sourceFiles, 'turbo-update-manifest') || anyHas(sourceFiles, 'delta-manifest');
const globalCache = anyHas(sourceFiles, 'kelo-turbo-assets-v1') || anyHas(sourceFiles, 'TURBO_ASSET_CACHE');
const contentHashConfig = buildConfigs.some((p) => /\[(?:content)?hash(?::\d+)?\]|entryFileNames[^\n]*hash|chunkFileNames[^\n]*hash|assetFileNames[^\n]*hash/.test(read(p)));
const minifyEvidence = buildConfigs.some((p) => /minify|terser|esbuild/.test(read(p))) || ['vite','rollup','webpack','esbuild'].some((d) => dependencies[d]);
const codeSplitEvidence = buildConfigs.some((p) => /manualChunks|splitChunks|codeSplitting|splitting\s*:\s*true/.test(read(p)));
const lazyEvidence = anyHas(['index.html', ...sourceFiles], 'import(') && ['studio','world','map-forge','map forge'].some((term) => anyHas(['index.html', ...sourceFiles], term));
const adaptiveParallel = anyHas(sourceFiles, 'effectiveType') && anyHas(sourceFiles, 'saveData') && (anyHas(sourceFiles, 'concurrency') || anyHas(sourceFiles, 'parallel')) && anyHas(sourceFiles, 'gameplay');
const fetchPriority = anyHas(sourceFiles, "priority: 'high'") && anyHas(sourceFiles, "priority: 'low'");
const persistentStorage = anyHas(sourceFiles, 'navigator.storage.persist') || anyHas(sourceFiles, 'storage.persist(');
const immutableHeaders = headerConfigs.some((p) => /immutable/i.test(read(p)));
const revalidateHeaders = headerConfigs.some((p) => /no-cache|max-age=0|must-revalidate/i.test(read(p)));
const compressionEvidence = headerConfigs.some((p) => /brotli|gzip|content-encoding|\.br\b|\.gz\b/i.test(read(p))) || buildConfigs.some((p) => /brotli|gzip/i.test(read(p)));
const transportEvidence = headerConfigs.some((p) => /http\/2|http2|http\/3|http3|cdn/i.test(read(p))) || exists('docs/evidence/TURBO_UPDATE_HOSTING_EVIDENCE.md');
const metricsEvidence = anyHas(sourceFiles, 'Update Delta Bytes') && anyHas(sourceFiles, 'Time To Update Ready');
const guardianWorkflow = exists('.github/workflows/turbo-update-guardian.yml') && has('.github/workflows/turbo-update-guardian.yml', 'turbo-update-guardian.mjs');
const documentation = exists('docs/systems/TURBO_UPDATE_CONTRACT.md');

const manifestPath = ['dist/turbo-update-manifest.json','turbo-update-manifest.json'].find(exists);
let manifestIntegrity = false;
let manifestEvidence = 'No generated manifest available in repository/workspace.';
if (manifestPath) {
  try {
    const manifest = JSON.parse(read(manifestPath));
    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    manifestIntegrity = entries.length > 0 && entries.every((entry) => {
      if (!entry || !entry.path || !/^[a-f0-9]{64}$/i.test(String(entry.sha256 || ''))) return false;
      const file = path.join(root, entry.path);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      return actual === String(entry.sha256).toLowerCase();
    });
    manifestEvidence = manifestIntegrity ? `${manifestPath}: hashes verified against bytes.` : `${manifestPath}: present but hashes/bytes do not verify.`;
  } catch (error) {
    manifestEvidence = `${manifestPath}: invalid JSON (${error.message}).`;
  }
}

const checks = [
  check('TU-01','Delta manifest por archivo + SHA-256', manifestGenerator && deltaManifestRuntime && manifestIntegrity, `${manifestGenerator ? 'generator present' : 'generator missing'}; ${deltaManifestRuntime ? 'runtime consumes manifest' : 'runtime does not consume manifest'}; ${manifestEvidence}`, 'Generate the manifest from production output and verify every SHA-256.'),
  check('TU-02','Cache global reutilizable entre builds', globalCache, globalCache ? 'Stable content cache marker found.' : 'Only build-scoped staging cache detected; unchanged assets cannot be proven reusable.', 'Use a stable cache keyed by content-hashed URLs; never purge unchanged hashed assets merely because build SHA changes.'),
  check('TU-03','Content-hashed chunks/assets', contentHashConfig, contentHashConfig ? 'Hash naming configuration found.' : 'No production output naming rule containing content hash found.', 'Configure entry/chunk/asset file names with content hashes and inspect output.'),
  check('TU-04','Compilador prod: minify/tree-shake/code split', productionBuildScript && buildConfigPresent && minifyEvidence && codeSplitEvidence, `build script=${productionBuildScript}; config=${buildConfigPresent}; minify/tool=${minifyEvidence}; split=${codeSplitEvidence}`, 'Add a real production compiler and make CI build it.'),
  check('TU-05','Critical vs Studio/World/Map Forge lazy chunks', lazyEvidence && codeSplitEvidence, `dynamic lazy evidence=${lazyEvidence}; split config=${codeSplitEvidence}`, 'Studio, World Editor and Map Forge must be absent from critical boot chunk and loaded by dynamic import.'),
  check('TU-06','Paralelismo adaptativo red/gameplay', adaptiveParallel, adaptiveParallel ? 'Adaptive concurrency markers found.' : 'Network/gameplay gating exists, but no adaptive parallel worker pool is proven.', 'Select concurrency from effectiveType/downlink/saveData/gameplay state and test it.'),
  check('TU-07','Fetch priority low/high', fetchPriority, fetchPriority ? 'Both high/low fetch priority options found.' : 'Queue ordering is not fetch priority; no high/low fetch options proven.', 'Use fetch priority high for critical delta and low for background/lazy work with graceful fallback.'),
  check('TU-08','Storage persistence best-effort', persistentStorage, persistentStorage ? 'Persistent storage request found.' : 'navigator.storage.persist() not found.', 'Request persistent storage where supported and record the result.'),
  check('TU-09','Caching HTTP: immutable hashed + revalidate HTML/manifests', immutableHeaders && revalidateHeaders, `immutable=${immutableHeaders}; revalidate=${revalidateHeaders}`, 'Provide deploy/header configuration and verify live response headers.'),
  check('TU-10','Brotli/Gzip + HTTP2/3/CDN hosting evidence', compressionEvidence && transportEvidence, `compression=${compressionEvidence}; hosting transport evidence=${transportEvidence}`, 'Provide deploy configuration plus live evidence; hosting-dependent claims may remain UNPROVEN rather than fabricated.'),
  check('TU-11','Metrics: Update Delta Bytes + Time To Update Ready', metricsEvidence, metricsEvidence ? 'Both required metric names found.' : 'Required update metrics are not instrumented.', 'Measure transferred delta bytes and elapsed time from update discovery to staged/ready.'),
  check('TU-12','CI/guardian fail-closed', guardianWorkflow, guardianWorkflow ? 'Turbo guardian workflow is wired.' : 'Dedicated Turbo guardian workflow not found.', 'Wire this guardian to push/PR and production build output.'),
  check('TU-13','Contrato/documentación', documentation, documentation ? 'Turbo contract document exists.' : 'Turbo contract document missing.', 'Document acceptance criteria, evidence commands, hosting limitations and regression policy.')
];

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
console.log(`TURBO UPDATE GUARDIAN: ${passed}/${checks.length} requirements proven`);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.title}`);
  console.log(`  evidence: ${c.evidence}`);
  if (!c.pass && c.blocker) console.log(`  blocker: ${c.blocker}`);
}

if (failed.length) {
  console.error(`TURBO UPDATE CONTRACT INCOMPLETE: ${failed.length} requirement(s) lack sufficient evidence.`);
  console.error('Administrative firewall override allows work to continue; it does NOT convert missing evidence into PASS.');
  process.exit(1);
}
console.log('TURBO UPDATE CONTRACT COMPLETE: all requirements have repository/build evidence. Live-hosting claims still require the documented external verification step.');

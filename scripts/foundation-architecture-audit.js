/* KELO-INDEX
 * area: QA / FOUNDATION
 * owner: FOUNDATION CI
 * purpose: impide que cambios nuevos reintroduzcan deuda arquitectónica prohibida
 * public-api: CLI `node scripts/foundation-architecture-audit.js`
 * consumes: git diff, AGENTS.md, docs/KELO_FOUNDATION.md, ENGINE_MAP.md, index.html
 * state-owned: ninguno
 * extension-points: añadir reglas pequeñas y deterministas; no convertir en linter general
 * reuse: ejecutar en PR y localmente antes de merge
 * legacy: N/A
 * do-not: no usar este audit para justificar reescrituras masivas
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function fail(message) {
  failures += 1;
  console.error('FOUNDATION_FAIL:', message);
}
function ok(message) { console.log('FOUNDATION_OK:', message); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function requireText(rel, needles) {
  if (!exists(rel)) { fail(rel + ' missing'); return; }
  const text = read(rel);
  needles.forEach((needle) => {
    if (!text.includes(needle)) fail(rel + ' missing required marker: ' + needle);
  });
}

// 1) La ley del repo debe existir y enlazarse desde el punto de entrada.
requireText('docs/KELO_FOUNDATION.md', [
  '1 RESPONSABILIDAD = 1 OWNER',
  '¿QUÉ OWNER EXISTENTE DEBERÍA HACER ESTO?',
  'CONTENIDO',
  'CAPACIDAD',
  'IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR'
]);
requireText('AGENTS.md', ['docs/KELO_FOUNDATION.md', '1 RESPONSABILIDAD = 1 OWNER']);
requireText('ENGINE_MAP.md', ['docs/KELO_FOUNDATION.md', 'OWNER LIVE']);
requireText('src/ui/force-unlock-move.js', ['HOTFIX TEMPORAL', 'NO REUTILIZAR']);

// 2) Todo script local declarado por index debe existir. Evita load-order roto por renombres/limpieza.
if (exists('index.html')) {
  const html = read('index.html');
  const scriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    const src = match[1].split('?')[0];
    if (/^(https?:)?\/\//.test(src)) continue;
    if (!exists(src)) fail('index.html references missing script: ' + src);
  }
}

function git(args) {
  try { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (_) { return ''; }
}

function resolveBase() {
  const envBase = process.env.KELO_FOUNDATION_BASE;
  if (envBase && git(['rev-parse', '--verify', envBase])) return envBase;
  const ghBase = process.env.GITHUB_BASE_REF;
  if (ghBase && git(['rev-parse', '--verify', 'origin/' + ghBase])) return 'origin/' + ghBase;
  if (git(['rev-parse', '--verify', 'HEAD^'])) return 'HEAD^';
  return null;
}

const base = resolveBase();
if (!base) {
  console.warn('FOUNDATION_WARN: no git base found; static checks only');
} else {
  const diff = git(['diff', '--unified=0', base + '...HEAD', '--', '*.js', '*.html']);
  const nameStatus = git(['diff', '--name-status', base + '...HEAD']);

  // Parse only ADDED lines. Existing debt is migrated separately; this prevents new debt now.
  let currentFile = '';
  const added = [];
  diff.split('\n').forEach((line) => {
    if (line.startsWith('+++ b/')) { currentFile = line.slice(6); return; }
    if (!line.startsWith('+') || line.startsWith('+++')) return;
    added.push({ file: currentFile, line: line.slice(1) });
  });

  const forbidden = [
    {
      name: 'new direct core wrapper',
      test: (x) => /\b(render|renderAvatar|updateSimulation|processInput)\s*=\s*function\b/.test(x.line)
    },
    {
      name: 'new watchdog/timer used as state repair',
      test: (x) => /setInterval\s*\(/.test(x.line) && /unlock|lock|restore|repair|force|fix/i.test(x.line)
    },
    {
      name: 'UI directly mutates player position/HP',
      test: (x) => /^src\/ui\//.test(x.file) && /\blocalPlayer\.(x|y|hp|maxHp)\s*=/.test(x.line)
    },
    {
      name: 'UI directly pushes physical obstacle',
      test: (x) => /^src\/ui\//.test(x.file) && /\bobstacles\.push\s*\(/.test(x.line)
    },
    {
      name: 'new engine-v2 style parallel core file',
      test: (x) => /(^|\/)engine[-_]?v?2/i.test(x.file)
    }
  ];

  added.forEach((entry) => {
    if (/FOUNDATION-ALLOW\b/.test(entry.line)) return;
    forbidden.forEach((rule) => {
      if (rule.test(entry)) fail(rule.name + ' in ' + entry.file + ': ' + entry.line.trim());
    });
  });

  // Archivos JS/HTML NUEVOS deben auto-documentarse con KELO-INDEX.
  nameStatus.split('\n').filter(Boolean).forEach((row) => {
    const parts = row.split('\t');
    const status = parts[0];
    const file = parts[parts.length - 1];
    if (status === 'A' && /\.(js|html)$/.test(file) && exists(file)) {
      if (!read(file).includes('KELO-INDEX')) fail('new code file missing KELO-INDEX: ' + file);
    }
  });

  ok('diff guard inspected changes against ' + base);
}

if (failures) {
  console.error('\nKelo Foundation architecture audit failed with ' + failures + ' violation(s).');
  process.exit(1);
}

ok('Kelo Foundation architecture contract passed');

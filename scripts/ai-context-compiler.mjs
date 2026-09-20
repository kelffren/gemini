#!/usr/bin/env node
/**
 * Kelo AI Context Compiler
 *
 * Generates a compact machine-readable repository map from source metadata.
 * It is intentionally stdlib-only so a fresh agent can run it without adding
 * dependencies or touching runtime code.
 *
 * Sources:
 * - KELO-INDEX blocks / metadata embedded in source
 * - owner/global symbols (Kelo*, KELO_*)
 * - import/export edges
 * - package.json audit/test commands
 *
 * Output: docs/generated/AI_CODE_MAP.json
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs/generated/AI_CODE_MAP.json');
const MD_OUT = path.join(ROOT, 'docs/generated/AI_CODE_MAP.md');
const ROOTS = ['src', 'scripts', 'server', 'tests'];
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor']);
const MAX_BYTES = 768 * 1024;

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const uniq = xs => [...new Set(xs)].sort();

async function walk(dir, out = []) {
  let rows;
  try { rows = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const row of rows) {
    if (SKIP.has(row.name)) continue;
    const full = path.join(dir, row.name);
    if (row.isDirectory()) await walk(full, out);
    else if (EXT.has(path.extname(row.name))) out.push(full);
  }
  return out;
}

function parseIndex(text) {
  const lines = text.split(/\r?\n/).slice(0, 140);
  const meta = {};
  let saw = false;
  for (const raw of lines) {
    if (/KELO-INDEX/i.test(raw)) saw = true;
    if (!saw) continue;
    const m = raw.match(/\b(owner|owns|does-not-own|public-api|online|status|system|purpose|qa|tags?)\s*:\s*(.+?)\s*(?:\*\/|-->)*$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].replace(/^[-*\s]+|\s*\*\/$/g, '').trim();
  }
  return meta;
}

function parseFile(file, text) {
  const imports = [];
  for (const m of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)) imports.push(m[1]);
  const exports = [];
  for (const m of text.matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) exports.push(m[1]);
  const owners = [];
  for (const m of text.matchAll(/\b(?:globalThis\.|window\.)?((?:KELO_[A-Z0-9_]+)|(?:Kelo[A-Z][A-Za-z0-9_]+))\b/g)) owners.push(m[1]);
  const events = [];
  for (const m of text.matchAll(/['"]((?:kelo|studio|pvp|creator):[a-z0-9:_-]+)['"]/ig)) events.push(m[1]);
  const meta = parseIndex(text);
  const stat = { path: rel(file), bytes: Buffer.byteLength(text), ...meta };
  if (imports.length) stat.imports = uniq(imports).slice(0, 40);
  if (exports.length) stat.exports = uniq(exports).slice(0, 40);
  if (owners.length) stat.ownerSymbols = uniq(owners).slice(0, 60);
  if (events.length) stat.events = uniq(events).slice(0, 40);
  return stat;
}

const files = [];
for (const root of ROOTS) await walk(path.join(ROOT, root), files);
const entries = [];
for (const file of files.sort()) {
  const st = await fs.stat(file);
  if (st.size > MAX_BYTES) continue;
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  entries.push(parseFile(file, text));
}

let pkg = {};
try { pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')); } catch {}
const commands = Object.entries(pkg.scripts || {})
  .filter(([k]) => /^(test|audit|bug|recovery|lint|typecheck|deps)(:|$)/.test(k))
  .map(([name, command]) => ({ name, command }));

const ownerIndex = {};
for (const e of entries) {
  for (const owner of e.ownerSymbols || []) (ownerIndex[owner] ||= []).push(e.path);
  if (e.owner) (ownerIndex[e.owner] ||= []).push(e.path);
}
for (const key of Object.keys(ownerIndex)) ownerIndex[key] = uniq(ownerIndex[key]).slice(0, 80);

const payload = {
  schema: 'kelo-ai-code-map-v1',
  generatedAt: new Date().toISOString(),
  generatedBy: 'scripts/ai-context-compiler.mjs',
  sourceRoots: ROOTS,
  rules: {
    runtimeTruth: 'index.html + Foundation owners override documentation',
    navigation: 'AI_CONTEXT.md -> AGENTS.md -> ENGINE_MAP.md -> task owner -> direct consumers',
    warning: 'Presence in this map does not prove a file is LIVE.'
  },
  stats: {
    filesIndexed: entries.length,
    filesWithKeloIndex: entries.filter(e => Object.keys(e).some(k => ['owner','owns','public-api','online','status','system','purpose','qa','tags'].includes(k))).length,
    ownerSymbols: Object.keys(ownerIndex).length,
    commands: commands.length
  },
  ownerIndex,
  commands,
  files: entries
};
const canonical = JSON.stringify(payload, null, 2) + '\n';
payload.contentHash = crypto.createHash('sha256').update(canonical).digest('hex');
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`AI context map: ${entries.length} files, ${Object.keys(ownerIndex).length} owner symbols -> ${rel(OUT)}`);

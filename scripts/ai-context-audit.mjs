#!/usr/bin/env node
import { promises as fs } from 'node:fs';

const required = ['AI_CONTEXT.md', 'AGENTS.md', 'ENGINE_MAP.md', 'docs/CODE_INDEX.md'];
const missing = [];
for (const file of required) {
  try { await fs.access(file); } catch { missing.push(file); }
}
if (missing.length) {
  console.error('AI context audit failed. Missing:', missing.join(', '));
  process.exit(1);
}

const ctx = await fs.readFile('AI_CONTEXT.md', 'utf8');
for (const needle of ['Task → owner', 'Fast search protocol', 'Fresh-session response contract']) {
  if (!ctx.includes(needle)) {
    console.error('AI context audit failed: AI_CONTEXT.md missing section:', needle);
    process.exit(1);
  }
}

let map;
try { map = JSON.parse(await fs.readFile('docs/generated/AI_CODE_MAP.json', 'utf8')); }
catch {
  console.error('AI context audit failed: run npm run context:build');
  process.exit(1);
}
if (map.schema !== 'kelo-ai-code-map-v1' || !Array.isArray(map.files) || !map.files.length) {
  console.error('AI context audit failed: generated map is invalid');
  process.exit(1);
}
console.log(`AI context audit OK: ${map.stats?.filesIndexed || map.files.length} indexed files.`);

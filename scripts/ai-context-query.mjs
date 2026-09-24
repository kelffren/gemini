#!/usr/bin/env node
/**
 * Ask the generated Kelo context map where to start for a task.
 * Usage: npm run context:ask -- "editor scene placement"
 */
import { promises as fs } from 'node:fs';

const query = process.argv.slice(2).join(' ').trim().toLowerCase();
if (!query) {
  console.error('Usage: npm run context:ask -- "what you need to change"');
  process.exit(1);
}
let map;
try { map = JSON.parse(await fs.readFile('docs/generated/AI_CODE_MAP.json','utf8')); }
catch {
  console.error('Missing generated map. Run: npm run context:build');
  process.exit(1);
}
const stop = new Set(['the','and','for','with','from','para','como','esta','este','que','una','unos','las','los','del','por']);
const terms = [...new Set(query.split(/[^a-z0-9_:-]+/).filter(x=>x.length>2&&!stop.has(x)))];
function score(e) {
  const fields = {
    path: e.path || '',
    owner: e.owner || '',
    system: e.system || '',
    purpose: e.purpose || '',
    tags: e.tags || '',
    symbols: (e.ownerSymbols || []).join(' '),
    exports: (e.exports || []).join(' '),
    events: (e.events || []).join(' ')
  };
  let s=0;
  for (const t of terms) {
    if (fields.owner.toLowerCase().includes(t)) s+=12;
    if (fields.system.toLowerCase().includes(t)) s+=10;
    if (fields.tags.toLowerCase().includes(t)) s+=8;
    if (fields.path.toLowerCase().includes(t)) s+=7;
    if (fields.purpose.toLowerCase().includes(t)) s+=6;
    if (fields.symbols.toLowerCase().includes(t)) s+=5;
    if (fields.exports.toLowerCase().includes(t)) s+=3;
    if (fields.events.toLowerCase().includes(t)) s+=2;
  }
  return s;
}
const ranked = map.files.map(e=>({e,s:score(e)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,12);
if (!ranked.length) {
  console.log('No strong context match. Start with AI_CONTEXT.md and search owner symbols.');
  process.exit(0);
}
console.log('KELO CONTEXT ROUTE');
console.log('Query:', query);
for (const {e,s} of ranked) {
  const risk=map.riskIndex?.[e.path];
  console.log(`\n[${s}] ${e.path}`);
  if (e.owner) console.log('  owner:',e.owner);
  if (e.system) console.log('  system:',e.system);
  if (e.purpose) console.log('  purpose:',e.purpose);
  if (risk) {
    console.log('  risk:',risk.level,`(${risk.score})`);
    if (risk.directDependents?.length) console.log('  dependents:',risk.directDependents.slice(0,5).join(', '));
    if (risk.suggestedQa?.length) console.log('  QA:',risk.suggestedQa.join(', '));
  }
}

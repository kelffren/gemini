/* KELO-INDEX
 * area: QA / CI SUPPLY CHAIN
 * owner: Evergreen CI contract
 * purpose: garantiza que los workflows activos fijan actions externas a commits inmutables y no vuelven a tags flotantes
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir=path.join(process.cwd(),'.github','workflows');
const files=fs.readdirSync(dir).filter(name=>/\.ya?ml$/i.test(name)).sort();
assert.ok(files.length>0,'no active workflows found');

const violations=[];
const actionUses=[];
for(const name of files){
  const text=fs.readFileSync(path.join(dir,name),'utf8');
  if(/^\s*permissions:\s*write-all\s*$/mi.test(text))violations.push(`${name}: permissions write-all is forbidden`);
  for(const match of text.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#\s*(.*))?$/gm)){
    const ref=match[1];
    if(ref.startsWith('./')||ref.startsWith('docker://'))continue;
    const at=ref.lastIndexOf('@');
    if(at<1){violations.push(`${name}: action without ref ${ref}`);continue;}
    const action=ref.slice(0,at);
    const revision=ref.slice(at+1);
    actionUses.push({name,action,revision});
    if(!/^[0-9a-f]{40}$/i.test(revision))violations.push(`${name}: ${action} must be pinned to a 40-char commit SHA, got ${revision}`);
  }
}
assert.equal(violations.length,0,`CI supply-chain violations:\n${violations.join('\n')}`);
assert.ok(actionUses.some(row=>row.action==='actions/checkout'),'checkout action missing from active workflows');
assert.ok(actionUses.some(row=>row.action==='actions/setup-node'),'setup-node action missing from active workflows');
console.log(`CI SUPPLY CHAIN PASS workflows=${files.length} pinnedActions=${actionUses.length}`);

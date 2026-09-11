/* KELO-INDEX
 * area: QA / EVOLUTION / SANDBOX AUDIT
 * owner: Kelo Evolution CI
 * purpose: prove allowlist rejection, before-hash verification and detached-worktree execution
 * public-api: CLI
 * consumes: code patch contract + sandbox runner
 * state-owned: none; sandbox runner cleans temporary worktree
 * do-not: no production writes or network
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createCodePatchCandidate,validateCodePatchCandidate} from '../src/creators/evolution/code-patch-candidate.mjs';
import {sha256Text,runCodePatchSandbox} from './kelo-code-evolution-sandbox.mjs';

const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),target='src/creators/evolution/code-patch-candidate.mjs',before=await fs.readFile(target,'utf8');
const candidate=createCodePatchCandidate({id:'sandbox-smoke',baseSha:head,objective:'prove isolated syntax-safe patch evaluation',changes:[{path:target,beforeHash:sha256Text(before),afterContent:`${before}\n// sandbox-smoke-only\n`}],tests:['syntax']});
const report=await runCodePatchSandbox({candidate});
assert.equal(report.ok,true,JSON.stringify(report));assert.equal(report.sandboxIsolated,true);assert.match(report.diff,/sandbox-smoke-only/);
const denied=validateCodePatchCandidate(createCodePatchCandidate({id:'denied',baseSha:head,changes:[{path:'.env',beforeHash:'x',afterContent:'SECRET=x'}]}));
assert.equal(denied.valid,false);assert.ok(denied.errors.some(error=>error.includes('path_')));
console.log(JSON.stringify({ok:true,head,target,sandboxIsolated:report.sandboxIsolated,tests:report.tests.map(row=>({id:row.id,ok:row.ok})),deniedErrors:denied.errors},null,2));

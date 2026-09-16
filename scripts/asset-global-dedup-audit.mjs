/* KELO-INDEX
 * area: BUILD / CREATOR ASSET QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET GLOBAL DEDUP AUDIT SHA256 RGBA CHAMPION
 * purpose: deterministic regression proof for exact blob dedup and RGBA convergence planning
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */
import {buildAssetGlobalDedupPlan} from '../src/creators/assets/asset-global-dedup.mjs';
function assert(value,message){if(!value)throw new Error(message);}
const report={files:[
  {file:'a.png',sha256:'blob-a',rgbaSha256:'rgba-1',width:64,height:64,storedBytes:100},
  {file:'b.png',sha256:'blob-a',rgbaSha256:'rgba-1',width:64,height:64,storedBytes:100},
  {file:'c.png',sha256:'blob-c',rgbaSha256:'rgba-2',width:32,height:32,storedBytes:90},
  {file:'d.png',sha256:'blob-d',rgbaSha256:'rgba-2',width:32,height:32,storedBytes:60},
  {file:'different-shape.png',sha256:'blob-e',rgbaSha256:'rgba-2',width:16,height:64,storedBytes:40}
]};
const plan=buildAssetGlobalDedupPlan(report);
assert(plan.totals.logicalStoredBytes===390,'logical bytes mismatch');
assert(plan.byteExactGroups.length===1,'expected one byte-exact group');
assert(plan.totals.byteExactSavingBytes===100,'byte-exact saving mismatch');
assert(plan.rgbaExactConvergenceCandidates.length===1,'dimension-aware RGBA grouping failed');
assert(plan.rgbaExactConvergenceCandidates[0].champion.file==='d.png','smallest RGBA representation must win advisory champion');
assert(plan.rgbaExactConvergenceCandidates[0].potentialSavingBytes===90,'RGBA convergence saving mismatch');
assert(plan.invariants.sourceMutation===false,'planner must never mutate SOURCE');
console.log('ASSET_GLOBAL_DEDUP_AUDIT_PASS');

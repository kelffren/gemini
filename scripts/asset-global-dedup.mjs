/* KELO-INDEX
 * area: BUILD / CREATOR ASSET QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET GLOBAL DEDUP CLI CONTENT ADDRESS SHA256
 * purpose: emit an exact shared-blob plan and RGBA-equivalence convergence candidates
 * public-api: CLI
 * state-owned: report only
 * online: N/A
 */
import fs from 'node:fs';
import path from 'node:path';
import {buildAssetGlobalDedupPlan} from '../src/creators/assets/asset-global-dedup.mjs';
const args=process.argv.slice(2),argument=(name,fallback)=>{const p=`--${name}=`;const t=args.find(v=>v.startsWith(p));return t?t.slice(p.length):fallback;};
const input=path.resolve(argument('input','test-results/asset-space-budget-head/report.json'));
const output=path.resolve(argument('report','test-results/asset-global-dedup/report.json'));
if(!fs.existsSync(input)){console.error(`ASSET_GLOBAL_DEDUP_INPUT_NOT_FOUND — ${input}`);process.exit(2);}
const plan=buildAssetGlobalDedupPlan(JSON.parse(fs.readFileSync(input,'utf8')));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(plan,null,2));
console.log(`ASSET_GLOBAL_DEDUP_DONE files=${plan.fileCount} byteExactSaving=${plan.totals.byteExactSavingBytes} rgbaCandidateSaving=${plan.totals.rgbaConvergenceCandidateBytes}`);

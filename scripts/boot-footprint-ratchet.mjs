/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: BOOT FOOTPRINT RATCHET CLI REGRESSION REPLACEMENT PLAN DELIVERY
 * purpose: compare base/head first-playable footprint snapshots and fail on critical-path growth while validating declared exact delivery substitutions
 * public-api: CLI
 * state-owned: report only
 * online: N/A
 */
import fs from 'node:fs';import path from 'node:path';import {compareBootFootprints} from '../src/build/boot-footprint-ratchet.mjs';
const args=process.argv.slice(2),arg=(n,f)=>{const p=`--${n}=`;const t=args.find(v=>v.startsWith(p));return t?t.slice(p.length):f;};
const basePath=path.resolve(arg('base','/tmp/boot-footprint-base.json')),headPath=path.resolve(arg('head','test-results/boot-footprint-head/report.json')),output=path.resolve(arg('report','test-results/boot-footprint-ratchet/report.json')),tolerance=Math.max(0,Number(arg('html-tolerance','512'))||0),planPath=path.resolve(arg('replacement-plan','config/instant-delivery-plaza.json'));
for(const file of [basePath,headPath])if(!fs.existsSync(file)){console.error(`BOOT_FOOTPRINT_RATCHET_INPUT_NOT_FOUND — ${file}`);process.exit(2);}
const replacements=fs.existsSync(planPath)?(JSON.parse(fs.readFileSync(planPath,'utf8')).assets||[]).filter(item=>item?.source&&item?.delivery?.path):[];
const result=compareBootFootprints(JSON.parse(fs.readFileSync(basePath,'utf8')),JSON.parse(fs.readFileSync(headPath,'utf8')),{maxHtmlPrefixGrowthBytes:tolerance,replacements});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(`BOOT_FOOTPRINT_RATCHET_${result.pass?'PASS':'FAIL'} externalDelta=${result.summary.externalDeltaBytes} resources=${result.summary.baseResourceCount}->${result.summary.headResourceCount} replacements=${result.summary.replacementCount||0} regressions=${result.regressions.length}`);if(!result.pass)process.exitCode=4;

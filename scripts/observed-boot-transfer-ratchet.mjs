/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET CLI BASE HEAD PAYLOAD REQUESTS
 * purpose: compare base/head browser-observed preboot transfer reports and fail on deterministic local growth
 * public-api: CLI --base --head --report
 * state-owned: report only
 * online: N/A
 */
import fs from 'node:fs';import path from 'node:path';import {compareObservedBootTransfers} from '../src/build/observed-boot-transfer-ratchet.mjs';
const args=process.argv.slice(2),arg=(n,f=null)=>{const p=`--${n}=`;const t=args.find(v=>v.startsWith(p));return t?t.slice(p.length):f;};
const basePath=path.resolve(arg('base','test-results/observed-boot-transfer-base/report.json')),headPath=path.resolve(arg('head','test-results/observed-boot-transfer-head/report.json')),out=path.resolve(arg('report','test-results/observed-boot-transfer-ratchet/report.json'));
if(!fs.existsSync(basePath)||!fs.existsSync(headPath)){console.error('OBSERVED_BOOT_TRANSFER_RATCHET_INPUT_MISSING');process.exit(2);}
const base=JSON.parse(fs.readFileSync(basePath,'utf8')),head=JSON.parse(fs.readFileSync(headPath,'utf8'));
const result=compareObservedBootTransfers(base,head,{payloadToleranceBytes:Number(arg('byte-tolerance','0'))||0,requestTolerance:Number(arg('request-tolerance','0'))||0});
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));const s=result.summary;
console.log(`OBSERVED_BOOT_TRANSFER_RATCHET_${result.pass?'PASS':'FAIL'} payload=${s.basePayloadBytes}->${s.headPayloadBytes} delta=${s.payloadDeltaBytes} requests=${s.baseRequestCount}->${s.headRequestCount} resources=${s.baseResourceCount}->${s.headResourceCount} regressions=${result.regressions.length}`);
for(const item of result.regressions.slice(0,20))console.error('REGRESSION',JSON.stringify(item));if(!result.pass)process.exitCode=3;

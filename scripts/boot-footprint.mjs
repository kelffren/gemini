/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: BOOT FOOTPRINT CLI FIRST PLAYABLE BYTES
 * purpose: measure index resources referenced before boot-ready
 * public-api: CLI
 * state-owned: report only
 * online: N/A
 */
import fs from 'node:fs';import path from 'node:path';import {measureBootFootprint} from '../src/build/boot-footprint-ratchet.mjs';
const args=process.argv.slice(2),arg=(n,f)=>{const p=`--${n}=`;const t=args.find(v=>v.startsWith(p));return t?t.slice(p.length):f;};
const root=path.resolve(arg('root','.')),output=path.resolve(arg('report','test-results/boot-footprint/report.json'));
const report=measureBootFootprint(root,{htmlPath:arg('html','index.html')});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(`BOOT_FOOTPRINT_DONE resources=${report.resourceCount} external=${report.externalStoredBytes} htmlPrefix=${report.htmlPrefixBytes} total=${report.totalMeasuredCriticalBytes} missing=${report.missing.length}`);if(report.missing.length)process.exitCode=3;

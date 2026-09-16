/* KELO-INDEX
 * area: QA / CREATOR ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG DIFFERENTIAL SHARP PNGCHECK CONSENSUS
 * purpose: prove representative strict outputs with independent decoders/validators so Kelo is not its own sole authority
 * online: N/A; CI audit
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {comparePngsIndependent} from '../src/creators/assets/png-independent-validator.mjs';

const files=process.argv.slice(2).filter(value=>!value.startsWith('--'));
const targets=files.length?files:[
  'assets/hero.PNG',
  'assets/cespedsindivisiones.PNG',
  'assets/world/trees/kelo-tree-pack-01/tree-apple-red.png'
].filter(fs.existsSync);
assert.ok(targets.length>0,'no representative PNGs available');
const results=[];
for(const file of targets){
  const source=fs.readFileSync(file),optimized=optimizePngLossless(source,{filterStrategies:['adaptive']});
  assert.notEqual(optimized.report.status,'skipped',`${file}: optimizer skipped unexpectedly`);
  const independent=await comparePngsIndependent(source,optimized.buffer,{requirePngcheck:true,requireSharp:true,requireExactSrgb:true});
  assert.equal(independent.pass,true,`${file}: independent consensus failed: ${JSON.stringify(independent)}`);
  results.push({file,sourceBytes:source.length,outputBytes:optimized.buffer.length,winner:optimized.report.winner,independent});
}
console.log(JSON.stringify({status:'ASSET_PNG_INDEPENDENT_AUDIT_OK',files:results},null,2));

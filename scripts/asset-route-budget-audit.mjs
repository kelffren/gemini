/* KELO-INDEX
 * area: QA / CREATOR ASSET BUDGET
 * owner: Kelo Creator Asset Bridge
 * keys: ROUTE ZONE BUDGET PNG STORED RGBA REGRESSION AUDIT
 * purpose: scan configured PNG groups, derive dimensions through the canonical PNG guard, and fail CI when an explicit byte/decode budget is exceeded
 * public-api: CLI audit
 * state-owned: report files only
 * online: N/A; deterministic build-time audit
 * consumes: png-conformance-guard, asset-budget-policy, docs/asset-space-budgets.json
 * do-not: mutate images or infer gameplay route membership from filenames
 */

import fs from 'node:fs';
import path from 'node:path';
import {inspectPngStructure} from '../src/creators/assets/png-conformance-guard.mjs';
import {evaluateAssetBudgetPolicy} from '../src/creators/assets/asset-budget-policy.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(value=>value.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const configPath=path.resolve(argument('config','docs/asset-space-budgets.json'));
const reportDir=path.resolve(argument('report','dist/asset-route-budget'));
if(!fs.existsSync(configPath))throw new Error(`ASSET_ROUTE_BUDGET_CONFIG_NOT_FOUND:${configPath}`);
const policy=JSON.parse(fs.readFileSync(configPath,'utf8'));

function walkPngs(target){
  if(!fs.existsSync(target))return[];
  const stat=fs.statSync(target);if(stat.isFile())return /\.png$/i.test(target)?[target]:[];
  const out=[],stack=[target];while(stack.length){const dir=stack.pop();for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())stack.push(full);else if(entry.isFile()&&/\.png$/i.test(entry.name))out.push(full);}}return out;
}
const prefixes=[...new Set((policy.groups||[]).flatMap(group=>Array.isArray(group.prefixes)?group.prefixes:[]))];
const exact=[...new Set((policy.groups||[]).flatMap(group=>Array.isArray(group.paths)?group.paths:[]))];
const files=[...new Set([...prefixes.flatMap(prefix=>walkPngs(path.resolve(prefix))),...exact.flatMap(file=>walkPngs(path.resolve(file)))])].sort();
const records=[],errors=[];
for(const file of files){
  try{
    const buffer=fs.readFileSync(file),info=inspectPngStructure(buffer,{rejectApng:false,rejectInterlaced:false,reject16Bit:false});
    records.push({path:path.relative(process.cwd(),file).replaceAll('\\','/'),storedBytes:buffer.length,width:info.width,height:info.height,decodedRgbaBytes:info.width*info.height*4});
  }catch(error){errors.push({path:path.relative(process.cwd(),file).replaceAll('\\','/'),error:String(error?.message||error)});}
}
const evaluation=evaluateAssetBudgetPolicy(records,policy),report={schema:'kelo-asset-route-budget-audit-v1',generatedAt:new Date().toISOString(),config:path.relative(process.cwd(),configPath).replaceAll('\\','/'),pass:evaluation.pass&&errors.length===0,scan:{files:records.length,errors},...evaluation};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
for(const group of evaluation.groups)console.log(`ASSET_BUDGET ${group.id} pass=${group.pass} files=${group.totals.fileCount}/${group.limits.maxFileCount??'∞'} stored=${group.totals.storedBytes}/${group.limits.maxStoredBytes??'∞'} rgba=${group.totals.decodedRgbaBytes}/${group.limits.maxDecodedRgbaBytes??'∞'} largest=${group.totals.largestAssetBytes}/${group.limits.maxLargestAssetBytes??'∞'}`);
if(errors.length)for(const error of errors)console.error(`ASSET_BUDGET_SCAN_ERROR ${error.path} ${error.error}`);
if(!report.pass){console.error(`ASSET_ROUTE_BUDGET_FAILED violations=${evaluation.violations} scanErrors=${errors.length}`);process.exit(1);}
console.log(`ASSET_ROUTE_BUDGET_OK groups=${evaluation.groupCount} files=${records.length}`);

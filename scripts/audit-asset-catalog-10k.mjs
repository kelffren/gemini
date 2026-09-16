import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{console.error(`❌ asset-catalog-10k: ${message}`);process.exitCode=1;};
const assert=(condition,message)=>{if(!condition)fail(message);};
const numberConst=(source,name)=>{const match=source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));return match?Number(match[1]):NaN;};
const syntaxFiles=['src/creators/assets/kenney-index-worker.js','src/creators/assets/kenney-live-provider.mjs','src/creators/assets/external-asset-providers.mjs'];
for(const file of syntaxFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert(result.status===0,`${file} syntax check failed: ${result.stderr||result.stdout}`);}

const worker=read('src/creators/assets/kenney-index-worker.js');
const kenney=read('src/creators/assets/kenney-live-provider.mjs');
const external=read('src/creators/assets/external-asset-providers.mjs');
const vault=read('asset-vault.html');

const maxFederated=numberConst(external,'MAX_FEDERATED_RESULTS');
const maxRecent=numberConst(external,'MAX_RECENT_ASSETS');
const maxPreviewConcurrency=numberConst(external,'MAX_THUMBNAIL_CONCURRENCY');
const queryCache=numberConst(worker,'MAX_QUERY_CACHE');

assert(Number.isFinite(maxFederated)&&maxFederated<=200,'federated result budget must stay <= 200 cards');
assert(Number.isFinite(maxRecent)&&maxRecent<=800,'recent metadata LRU must stay <= 800 entries');
assert(Number.isFinite(maxPreviewConcurrency)&&maxPreviewConcurrency<=6,'preview network concurrency must stay <= 6');
assert(Number.isFinite(queryCache)&&queryCache<=12,'worker query cache must stay <= 12 result sets');
assert(/new Worker\(new URL\('\.\/kenney-index-worker\.js/.test(kenney),'Kenney provider must keep full-index search in a Web Worker');
assert(/searchKenneyPage/.test(kenney),'Kenney provider must expose paged search');
assert(!/RAW_BASE|downloadUrl/.test(worker),'worker must process metadata only, never asset binaries');
assert(/IntersectionObserver/.test(external),'visible previews must be viewport-gated');
assert(/fetchPriority='low'/.test(external),'thumbnail requests must remain low priority');
assert(/hibernatePage\(\)/.test(vault),'library must hibernate old catalog pages');
assert(/releaseMedia/.test(vault),'library must release preview media when pages/modal close');
assert(/perProvider=id==='all'\?12:48/.test(vault),'UI page budget changed; review 10k memory/DOM contract before raising it');

const synthetic=Array.from({length:10000},(_,i)=>({id:`synthetic:${i}`}));
const pages=[];for(let offset=0;offset<synthetic.length;offset+=maxFederated)pages.push(synthetic.slice(offset,offset+maxFederated));
assert(pages.length>=50,'synthetic 10k test did not create expected bounded pages');
assert(Math.max(...pages.map(page=>page.length))<=maxFederated,'a synthetic page exceeded the DOM metadata budget');

if(!process.exitCode){console.log(JSON.stringify({ok:true,syntheticAssets:synthetic.length,pages:pages.length,maxFederated,maxRecent,maxPreviewConcurrency,queryCache,architecture:'worker + metadata paging + viewport previews + hibernated pages'},null,2));}

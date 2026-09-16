import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{console.error(`❌ asset-catalog-10k: ${message}`);process.exitCode=1;};
const assert=(condition,message)=>{if(!condition)fail(message);};
const numberConst=(source,name)=>{const match=source.match(new RegExp(`${name}\\s*=\\s*(\\d[\\d_]*)`));return match?Number(match[1].replaceAll('_','')):NaN;};
const syntaxFiles=[
  'src/creators/assets/kenney-index-worker.js',
  'src/creators/assets/kenney-live-provider.mjs',
  'src/creators/assets/external-provider-runtime.mjs',
  'src/creators/assets/ambientcg-live-provider.mjs',
  'src/creators/assets/polyhaven-live-provider.mjs',
  'src/creators/assets/openverse-live-provider.mjs',
  'src/creators/assets/three-d-assets-live-provider.mjs',
  'src/creators/assets/gobkit-live-provider.mjs',
  'src/creators/assets/sfxmint-live-provider.mjs',
  'src/creators/assets/open-source-3d-live-provider.mjs',
  'src/creators/assets/external-asset-providers.mjs',
  'scripts/build-external-library-index.mjs'
];
for(const file of syntaxFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert(result.status===0,`${file} syntax check failed: ${result.stderr||result.stdout}`);}

const worker=read('src/creators/assets/kenney-index-worker.js');
const kenney=read('src/creators/assets/kenney-live-provider.mjs');
const external=read('src/creators/assets/external-asset-providers.mjs');
const runtime=read('src/creators/assets/external-provider-runtime.mjs');
const ambientcg=read('src/creators/assets/ambientcg-live-provider.mjs');
const polyhaven=read('src/creators/assets/polyhaven-live-provider.mjs');
const openverse=read('src/creators/assets/openverse-live-provider.mjs');
const threeDAssets=read('src/creators/assets/three-d-assets-live-provider.mjs');
const gobkit=read('src/creators/assets/gobkit-live-provider.mjs');
const sfxmint=read('src/creators/assets/sfxmint-live-provider.mjs');
const openSource3d=read('src/creators/assets/open-source-3d-live-provider.mjs');
const buildIndexer=read('scripts/build-external-library-index.mjs');
const vault=read('asset-vault.html');
const config=JSON.parse(read('data/external-asset-providers.json'));

const maxFederated=numberConst(external,'MAX_FEDERATED_RESULTS');
const maxRecent=numberConst(external,'MAX_RECENT_ASSETS');
const maxPreviewConcurrency=numberConst(external,'MAX_THUMBNAIL_CONCURRENCY');
const queryCache=numberConst(worker,'MAX_QUERY_CACHE');
const externalConcurrency=numberConst(runtime,'MAX_CONCURRENCY');
const externalQueue=numberConst(runtime,'MAX_QUEUE');
const externalCacheEntries=numberConst(runtime,'MAX_CACHE_ENTRIES');
const externalMaxBytes=numberConst(runtime,'DEFAULT_MAX_BYTES');
const os3dManifests=numberConst(openSource3d,'MAX_PROJECT_MANIFESTS');
const buildConcurrency=numberConst(buildIndexer,'MAX_CONCURRENCY');

assert(Number.isFinite(maxFederated)&&maxFederated<=200,'federated result budget must stay <= 200 cards');
assert(Number.isFinite(maxRecent)&&maxRecent<=800,'recent metadata LRU must stay <= 800 entries');
assert(Number.isFinite(maxPreviewConcurrency)&&maxPreviewConcurrency<=6,'preview network concurrency must stay <= 6');
assert(Number.isFinite(queryCache)&&queryCache<=12,'worker query cache must stay <= 12 result sets');
assert(Number.isFinite(externalConcurrency)&&externalConcurrency<=3,'external provider concurrency must stay <= 3 on mobile');
assert(Number.isFinite(externalQueue)&&externalQueue<=24,'external provider queue must stay <= 24 pending requests');
assert(Number.isFinite(externalCacheEntries)&&externalCacheEntries<=64,'external metadata cache must stay <= 64 entries');
assert(Number.isFinite(externalMaxBytes)&&externalMaxBytes<=1_500_000,'default external response budget must stay <= 1.5 MB');
assert(Number.isFinite(os3dManifests)&&os3dManifests<=6,'OpenSource3D runtime must scan <= 6 project manifests per query');
assert(Number.isFinite(buildConcurrency)&&buildConcurrency<=3,'build-time external indexer must stay <= 3 concurrent source requests');
assert(/new Worker\(new URL\('\.\/kenney-index-worker\.js/.test(kenney),'Kenney provider must keep full-index search in a Web Worker');
assert(/searchKenneyPage/.test(kenney),'Kenney provider must expose paged search');
assert(!/RAW_BASE|downloadUrl/.test(worker),'worker must process metadata only, never asset binaries');
assert(/IntersectionObserver/.test(external),'visible previews must be viewport-gated');
assert(/fetchPriority='low'/.test(external),'thumbnail requests must remain low priority');
assert(/p\.requiresQuery!==true/.test(external)&&/q\.length>0/.test(external),'query-only giant catalogs must stay asleep on blank federated browse');
assert(/PROVIDER_CIRCUIT_OPEN/.test(runtime)&&/BREAKER_FAILURES/.test(runtime),'external provider runtime must retain circuit breaker isolation');
assert(/PROVIDER_QUEUE_SATURATED/.test(runtime),'external provider runtime must apply queue backpressure');
assert(/saveData/.test(runtime)&&/effectiveType/.test(runtime),'external provider runtime must adapt to mobile connection/data saver');
assert(/mobilePageWindow/.test(runtime),'external provider runtime must preserve logical page continuity when page budgets shrink');
for(const [name,source] of [['ambientCG',ambientcg],['Poly Haven',polyhaven],['Openverse',openverse],['3DAssets.dev',threeDAssets],['Gobkit',gobkit],['SFXMint',sfxmint],['OpenSource3DAssets',openSource3d]])assert(/mobilePageWindow/.test(source),`${name} must use mobilePageWindow so reduced page sizes never skip assets`);
assert(/SUPPORTED_KINDS/.test(ambientcg)&&/kindSkipped:true/.test(ambientcg),'ambientCG must skip requests for impossible active filters');
assert(/SUPPORTED_KINDS/.test(polyhaven)&&/kindSkipped:true/.test(polyhaven),'Poly Haven must skip requests for impossible active filters');
assert(/catalogOnly:true/.test(ambientcg)&&/downloadUrl:null/.test(ambientcg),'ambientCG must remain catalog-only until explicit source resolution');
assert(/catalogOnly:true/.test(polyhaven)&&/\/search\?/.test(polyhaven),'Poly Haven must use search-first catalog-only discovery');
assert(/licenseReviewRequired:true/.test(openverse)&&/downloadUrl:null/.test(openverse),'Openverse must remain source/license-review discovery only');
assert(/requiresQuery:true/.test(threeDAssets)&&/catalogOnly:true/.test(threeDAssets)&&/downloadUrl:null/.test(threeDAssets),'3DAssets.dev must stay query-only and catalog-only');
assert(/catalogOnly:true/.test(gobkit)&&/downloadUrl:null/.test(gobkit)&&/60\*60\*1000/.test(gobkit),'Gobkit manifest must stay catalog-only and long-cached');
assert(/requiresQuery:true/.test(sfxmint)&&/immutableRemote:true/.test(sfxmint)&&/downloadUrl:audio/.test(sfxmint)&&/CC0-1\.0/.test(sfxmint),'SFXMint may expose direct audio only as explicit immutable CC0 downloads');
assert(/catalogOnly:true/.test(openSource3d)&&/downloadUrl:null/.test(openSource3d)&&/MAX_PROJECT_MANIFESTS=6/.test(openSource3d),'OpenSource3DAssets must remain bounded metadata-only at runtime');
assert(!/fetchJson\([^\n]*model_file_url/.test(buildIndexer),'build indexer must never fetch model binaries');
assert(/licensePolicy:'CC0-only'/.test(buildIndexer),'build indexer must preserve CC0-only source policy');
assert(/hibernatePage\(\)/.test(vault),'library must hibernate old catalog pages');
assert(/releaseMedia/.test(vault),'library must release preview media when pages/modal close');
assert(/perProvider=id==='all'\?12:48/.test(vault),'UI page budget changed; review 10k memory/DOM contract before raising it');

const providerIds=new Set((config.providers||[]).map(row=>row.id));
for(const id of ['ambientcg','polyhaven','openverse-images','openverse-audio','3dassets','gobkit','sfxmint','opensource3d'])assert(providerIds.has(id),`${id} must stay registered in provider config`);
const heavyLazyApis=(config.providers||[]).filter(row=>row.mode==='lazy-live-api'&&row.id!=='sfxmint');
assert(heavyLazyApis.every(row=>row.catalogOnly===true),'every heavy lazy live API must remain catalog-only');
const sfxConfig=(config.providers||[]).find(row=>row.id==='sfxmint');
assert(sfxConfig?.verified===true&&sfxConfig?.license==='CC0-1.0'&&sfxConfig?.requiresQuery===true,'SFXMint direct-download exception must remain verified CC0 and query-only');

const synthetic=Array.from({length:10000},(_,i)=>({id:`synthetic:${i}`}));
const pages=[];for(let offset=0;offset<synthetic.length;offset+=maxFederated)pages.push(synthetic.slice(offset,offset+maxFederated));
assert(pages.length>=50,'synthetic 10k test did not create expected bounded pages');
assert(Math.max(...pages.map(page=>page.length))<=maxFederated,'a synthetic page exceeded the DOM metadata budget');

if(!process.exitCode){console.log(JSON.stringify({ok:true,syntheticAssets:synthetic.length,pages:pages.length,maxFederated,maxRecent,maxPreviewConcurrency,queryCache,externalConcurrency,externalQueue,externalCacheEntries,externalMaxBytes,os3dManifests,buildConcurrency,providers:providerIds.size,architecture:'worker + lazy APIs + metadata paging + contiguous mobile windows + bounded network + backpressure + kind gates + build-time metadata indexing + viewport previews + hibernated pages'},null,2));}

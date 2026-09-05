import fs from 'node:fs';

const registry=fs.readFileSync('src/environment/tile-registry.js','utf8');
const contract=fs.readFileSync('src/environment/atlas-contract.js','utf8');
const manifest=JSON.parse(fs.readFileSync('src/environment/art-asset-manifest.json','utf8'));
const errors=[];

for(const token of ["kelo-atlas-contract-v1","maxDimension:2048","small:Object.freeze({maxDimension:256","medium:Object.freeze({maxDimension:1024","packedSprites:Object.freeze({paddingMin:1,spacingMin:1","lazy-when-district-needed","allowSilentMissing:false"]){
  if(!contract.includes(token))errors.push(`atlas contract missing policy token: ${token}`);
}

const productionPngs=manifest.assets.filter(a=>String(a.path||'').toLowerCase().endsWith('.png'));
for(const asset of productionPngs){
  if(!(asset.width>0&&asset.height>0))errors.push(`${asset.id}: invalid dimensions`);
  if(Math.max(asset.width,asset.height)>2048)errors.push(`${asset.id}: exceeds atlas max dimension 2048`);
  if(asset.sampling!=='nearest')errors.push(`${asset.id}: sampling must be nearest`);
  if(asset.frames?.mode==='grid'){
    if(!(asset.cellWidth>0&&asset.cellHeight>0&&asset.columns>0&&asset.rows>0))errors.push(`${asset.id}: incomplete grid metadata`);
    const expectedW=(asset.padding||0)*2+asset.columns*asset.cellWidth+Math.max(0,asset.columns-1)*(asset.spacing||0);
    const expectedH=(asset.padding||0)*2+asset.rows*asset.cellHeight+Math.max(0,asset.rows-1)*(asset.spacing||0);
    if(expectedW!==asset.width||expectedH!==asset.height)errors.push(`${asset.id}: grid/padding/spacing does not match dimensions`);
  }
  if(asset.cache?.strategy==='query'&&(!asset.cache.key||asset.cache.value===undefined))errors.push(`${asset.id}: incomplete query cache metadata`);
}

const srcMatches=[...registry.matchAll(/src:'([^']+)'/g)].map(m=>m[1]);
if(srcMatches.length<8)errors.push(`TileRegistry atlas coverage unexpectedly low: ${srcMatches.length}`);
for(const src of srcMatches){
  if(!/[?&](art|v)=/.test(src))errors.push(`TileRegistry asset lacks cache-busting token: ${src}`);
}

const giantAtlas=productionPngs.filter(a=>Math.max(a.width,a.height)>1024);
if(giantAtlas.length>2)errors.push(`too many >1024px production assets (${giantAtlas.length}); split by family before growth`);

const families=new Set(productionPngs.map(a=>a.family));
if(families.size<5)errors.push(`asset families unexpectedly collapsed: ${families.size}`);

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(JSON.stringify({policy:'kelo-atlas-contract-v1',productionPngs:productionPngs.length,registryVersionedSources:srcMatches.length,families:families.size,largeAssets:giantAtlas.map(a=>a.id)},null,2));
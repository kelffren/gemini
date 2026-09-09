/* KELO-INDEX
 * area: TEST / CREATORS / ASSET LIBRARY
 * owner: Creator Asset Library contract audit
 * purpose: prove shared-catalog binding, immutable repository IDs and owner boundaries without browser/runtime mutation
 * online: protects replaceable repository/publish boundary and stable asset IDs
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createIndexedDbCreatorAssetRepository} from '../src/creators/assets/indexeddb-creator-asset-repository.mjs';
import {bindMapForgeAssets,buildMapForgeCatalogSnapshot} from '../src/world/map-forge/map-forge-asset-binding.mjs';
import {createMapForgeWorkerClient} from '../src/world/map-forge/map-forge-worker-client.mjs';

const catalogRows=[
  {id:'official:tree:oak',label:'Oak Tree',category:'nature',family:'tree',districts:['*'],source:'official'},
  {id:'creator:test:tree@r1-a1',label:'Royal White Tree',category:'nature',family:'tree',districts:['*'],source:'creator-library'},
  {id:'official:bush:1',label:'Bush',category:'nature',family:'bush',districts:['*'],source:'official'},
  {id:'official:rock:1',label:'Rock',category:'nature',family:'rock',districts:['*'],source:'official'},
  {id:'official:flower:1',label:'Flower Planter',category:'nature',family:'flower',districts:['*'],source:'official'},
  {id:'official:crate:1',label:'Crate',category:'decor',family:'crate',districts:['*'],source:'official'},
  {id:'official:lamp:1',label:'Lamp',category:'decor',family:'lamp',districts:['*'],source:'official'},
  {id:'official:bench:1',label:'Bench',category:'decor',family:'bench',districts:['*'],source:'official'},
  {id:'official:market:1',label:'Market Cart',category:'architecture',family:'market_prop',districts:['*'],source:'official'},
  {id:'official:barrel:1',label:'Barrel',category:'decor',family:'barrel',districts:['*'],source:'official'}
];
const compact=buildMapForgeCatalogSnapshot(catalogRows);
assert.equal(compact.length,catalogRows.length);
assert(Object.isFrozen(compact[0].districts),'catalog snapshot must be immutable');

const fakeMap={metadata:{layoutHash:'layout:test',assetCatalogVersion:'old'},decorations:[{id:'dec:0',district:'forest',family:'tree',x:100,y:120,rotation:90},{id:'dec:1',district:'forest',family:'rock',x:180,y:220,rotation:0}],prefabPlacements:[],generationStats:{decorationCount:2}};
const boundA=bindMapForgeAssets(fakeMap,compact,{catalogVersion:'catalog-v1'}),boundB=bindMapForgeAssets(fakeMap,compact,{catalogVersion:'catalog-v1'});
assert.deepEqual(boundA,boundB,'same map + same catalog must bind identically');
assert.equal(boundA.prefabPlacements.length,2);
assert.equal(boundA.generationStats.unresolvedDecorationCount,0);
assert(boundA.prefabPlacements.every(row=>row.assetId&&row.placementId),'bound rows need stable catalog IDs');
assert.equal(boundA.metadata.assetCatalogVersion,'catalog-v1');
assert(boundA.metadata.assetBindingHash,'binding must have its own deterministic hash');

const root={KELO_PROPERTY_CATALOG:{version:'property-test-v1',list:()=>catalogRows}};
const client=createMapForgeWorkerClient({root});
const run1=await client.generate('KELO_FOREST_V1',{seed:92811,count:3}),run2=await client.generate('KELO_FOREST_V1',{seed:92811,count:3});
assert(run1.best?.validation?.valid,'Map Forge should still produce a valid best candidate');
assert.equal(run1.best.metadata.layoutHash,run2.best.metadata.layoutHash,'catalog-aware generation remains deterministic');
assert.equal(run1.best.metadata.assetBindingHash,run2.best.metadata.assetBindingHash,'binding remains deterministic');
assert(run1.best.prefabPlacements.length>0,'semantic decorations must become real prefabPlacements');
assert.equal(run1.best.prefabPlacements.length,run1.best.generationStats.assetPlacementCount);
assert(run1.best.metadata.assetCatalogVersion.startsWith('property-test-v1+'),'real catalog version must replace UI placeholder');
client.close();

const repo=createIndexedDbCreatorAssetRepository({indexedDBFactory:null});
const blob=new Blob(['asset-bytes'],{type:'image/png'}),row={assetId:'creator:test:tree@r1-deadbeef',familyId:'creator:test:tree',ownerId:'test',status:'private',createdAt:1,blob};
await repo.put(row);assert.equal((await repo.get(row.assetId)).assetId,row.assetId);assert.equal((await repo.list({ownerId:'test'})).length,1);await repo.remove(row.assetId);assert.equal((await repo.list()).length,0);await repo.close();

const service=fs.readFileSync('src/creators/assets/creator-asset-library.mjs','utf8'),entry=fs.readFileSync('src/creators/creator-entry.mjs','utf8'),hub=fs.readFileSync('src/creators/ui/creator-hub.mjs','utf8'),workspace=fs.readFileSync('src/creators/workspaces/asset-library-workspace.mjs','utf8'),ui=fs.readFileSync('src/creators/ui/asset-library-workspace.mjs','utf8'),workerClient=fs.readFileSync('src/world/map-forge/map-forge-worker-client.mjs','utf8');
assert(service.includes('KELO_PROPERTY_CATALOG')&&service.includes('KELO_ATLAS_CONTRACT'),'Creator assets must bridge into existing runtime owners');
assert(service.includes("status:'private'")&&service.includes("row.status='review'")&&service.includes("row.status='global'"),'private → review → global flow required');
assert(service.includes('CREATOR_ASSET_GLOBAL_REVISION_IMMUTABLE'),'published revisions must be immutable');
assert(entry.includes('registerAssetLibraryWorkspace')&&entry.includes('assetLibrary,openWorkspace'),'Creator composition root must inject the library');
assert(hub.includes("['asset-library','Asset Library','active']")&&hub.includes('renderAssets'),'Hub must expose the live library');
assert(workspace.includes("capability:'creators.access'"),'upload UI requires creator permission');
assert(ui.includes('IMPORTAR A MI BIBLIOTECA')&&ui.includes('PUBLICAR GLOBAL'),'manual import and global publication UI required');
assert(workerClient.includes('bindMapForgeAssets')&&workerClient.includes('KELO_PROPERTY_CATALOG'),'Map Forge must consume the same shared catalog');
for(const source of[service,fs.readFileSync('src/world/map-forge/map-forge-asset-binding.mjs','utf8')])for(const bad of['KELO_PROPERTY_SYSTEM.request','KELO_WORLD_RENDERER=','KELO_COLLISION.replaceOwner','obstacles.push'])assert(!source.includes(bad),`forbidden direct owner mutation: ${bad}`);

console.log(JSON.stringify({ok:true,catalog:compact.length,mapForgePlacements:run1.best.prefabPlacements.length,bindingHash:run1.best.metadata.assetBindingHash,repository:'memory-fallback-pass'},null,2));

/* KELO-INDEX
 * area: TEST / MAP FORGE / SETTLEMAKER
 * owner: Map Forge Settlemaker provider contract audit
 * purpose: prove deterministic GeoJSON adaptation and HTTP best-of without embedding a second renderer or world authority
 * online: mocks the external service boundary; no live network dependency in CI
 */
import assert from 'node:assert/strict';
import {getMapForgeRecipe} from '../src/world/map-forge/map-forge-recipes.mjs';
import {SETTLEMAKER_SERVICE_URL,settlemakerGeoJsonToMapDefinition,generateSettlemakerBestOf} from '../src/world/map-forge/map-forge-settlemaker-provider.mjs';

const recipe=getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1');
const geojson={
  type:'FeatureCollection',
  metadata:{schema_version:4,settlemaker_version:'2.3.0',local_bounds:{min_x:-120,min_y:-100,max_x:120,max_y:100},degraded_flags:[]},
  features:[
    {type:'Feature',properties:{layer:'ward',wardType:'Market',label:'Market'},geometry:{type:'Polygon',coordinates:[[[-60,-35],[0,-35],[0,35],[-60,35],[-60,-35]]]}},
    {type:'Feature',properties:{layer:'ward',wardType:'Craftsmen',label:'Craftsmen'},geometry:{type:'Polygon',coordinates:[[[0,-35],[60,-35],[60,35],[0,35],[0,-35]]]}},
    {type:'Feature',properties:{layer:'ward',wardType:'Patriciate',label:'Citadel'},geometry:{type:'Polygon',coordinates:[[[-25,-85],[25,-85],[25,-40],[-25,-40],[-25,-85]]]}},
    {type:'Feature',properties:{layer:'street',streetType:'artery',street_id:'s1'},geometry:{type:'LineString',coordinates:[[-110,0],[-45,0],[0,0],[45,0],[110,0]]}},
    {type:'Feature',properties:{layer:'street',streetType:'road',street_id:'s2'},geometry:{type:'LineString',coordinates:[[0,-90],[0,-42],[0,0],[0,90]]}},
    {type:'Feature',properties:{layer:'street',streetType:'road',street_id:'s3'},geometry:{type:'LineString',coordinates:[[-55,-28],[-20,-10],[25,12],[55,28]]}},
    {type:'Feature',properties:{layer:'building',wardType:'Market',building_id:'b1'},geometry:{type:'Polygon',coordinates:[[[-48,-28],[-32,-28],[-32,-12],[-48,-12],[-48,-28]]]}},
    {type:'Feature',properties:{layer:'building',wardType:'Market',building_id:'b2'},geometry:{type:'Polygon',coordinates:[[[-24,12],[-8,12],[-8,29],[-24,29],[-24,12]]]}},
    {type:'Feature',properties:{layer:'building',wardType:'Craftsmen',building_id:'b3'},geometry:{type:'Polygon',coordinates:[[[12,-28],[30,-28],[30,-10],[12,-10],[12,-28]]]}},
    {type:'Feature',properties:{layer:'building',wardType:'Patriciate',building_id:'b4'},geometry:{type:'Polygon',coordinates:[[[-12,-72],[12,-72],[12,-52],[-12,-52],[-12,-72]]]}},
    {type:'Feature',properties:{layer:'poi',poi_id:'p1',kind:'market',ward_type:'Market',building_id:'b1'},geometry:{type:'Point',coordinates:[-40,-20]}},
    {type:'Feature',properties:{layer:'tower',wallType:'city_wall'},geometry:{type:'Point',coordinates:[52,30]}},
    {type:'Feature',properties:{layer:'entrance',entrance_id:'g0',kind:'land',bearing_deg:180,arrival_local:[0,82]},geometry:{type:'Point',coordinates:[0,92]}}
  ]
};

const payload=seed=>({service:'kelo-settlemaker-service',schemaVersion:1,generator:'settlemaker',kind:'settlement',seed,degradedFlags:[],originShift:null,geojson});
const a=settlemakerGeoJsonToMapDefinition(payload(12345),recipe,{assetCatalogVersion:'audit'}),b=settlemakerGeoJsonToMapDefinition(payload(12345),recipe,{assetCatalogVersion:'audit'});
assert.deepEqual(a,b,'same Settlemaker response must adapt deterministically');
assert.equal(a.metadata.sourceGenerator,'settlemaker@2.3.0');
assert.equal(a.metadata.sourceSchemaVersion,4);
assert(a.validation.valid,`adapted map must be valid: ${a.validation.errors.join(', ')}`);
assert(a.districts.length===3,'wards must become Kelo districts');
assert(a.roads.length===3&&a.roads.some(r=>r.class==='arterial'),'Settlemaker streets must become Kelo roads');
assert(a.blocks.length===4&&a.parcels.length===4,'building polygons must remain structured blocks/parcels');
assert(a.landmarks.length>=1,'POIs/towers must become semantic landmarks');
assert(a.exits.length===1&&a.navigation.nodes.some(n=>n.id==='exit:g0'),'entrances must become reachable Kelo exits');
assert(a.terrain.cells.length>20,'ward structure must project to deterministic terrain cells');
assert(Number.isFinite(a.quality.total)&&a.quality.total>=0&&a.quality.total<=100,'existing Map Forge scorer must score external candidates');

let calls=0;
const fetchImpl=async(url,options)=>{
  calls++;assert.equal(url,`${SETTLEMAKER_SERVICE_URL}/generate`);assert.equal(options.method,'POST');
  const request=JSON.parse(options.body);assert(Number.isFinite(request.seed)&&request.population>1000,'provider must request deterministic city generation');
  return{ok:true,status:200,json:async()=>payload(request.seed)};
};
const run=await generateSettlemakerBestOf(recipe,{seed:77,count:2,assetCatalogVersion:'audit',fetchImpl});
assert.equal(calls,2,'remote best-of must request one deterministic city per candidate');
assert.equal(run.requested,2);assert.equal(run.validCount,2);assert.equal(run.provider,'settlemaker');assert(run.best?.validation?.valid);assert.notEqual(run.candidates[0].metadata.layoutHash,run.candidates[1].metadata.layoutHash,'candidate seed must participate in Kelo layout identity');

console.log(JSON.stringify({ok:true,provider:'settlemaker-http',districts:a.districts.length,roads:a.roads.length,blocks:a.blocks.length,landmarks:a.landmarks.length,score:a.quality.total,bestOf:run.requested},null,2));

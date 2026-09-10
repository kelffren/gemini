/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: KeloMapForge external generation provider
 * purpose: request Settlemaker geometry over HTTP and adapt it into the existing MapDefinition contract
 * public-api: SETTLEMAKER_SERVICE_URL, settlemakerGeoJsonToMapDefinition(), generateSettlemakerCandidate(), generateSettlemakerBestOf()
 * consumes: external Settlemaker HTTP service + Map Forge deterministic primitives + existing validator/scorer
 * state-owned: none
 * online: external generator returns base-world data only; Kelo authority/persistence/rendering remain unchanged
 * do-not: no renderer, DOM, collision writes, Property mutation, gameplay authority or embedded Settlemaker/GPL runtime
 */
import {clamp,round,dist,freezeDeep,stableStringify,hashString,seed32} from './map-forge-prng.mjs';
import {nearestRoadDistance} from './map-forge-geometry.mjs';
import {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';

export const SETTLEMAKER_SERVICE_URL='https://kelo-settlemaker-service.onrender.com';
export const SETTLEMAKER_PROVIDER_VERSION='1.0.0';
const MAX_REMOTE_CANDIDATES=4;
const TERRAIN_CELL=256;

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const text=v=>String(v??'').trim();
const slug=v=>text(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'unknown';
const polygonRing=f=>f?.geometry?.type==='Polygon'&&Array.isArray(f.geometry.coordinates?.[0])?f.geometry.coordinates[0]:[];
const pointCoords=f=>f?.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)?f.geometry.coordinates:null;
const lineCoords=f=>f?.geometry?.type==='LineString'&&Array.isArray(f.geometry.coordinates)?f.geometry.coordinates:[];

function walkCoordinates(value,visit){
  if(!Array.isArray(value))return;
  if(value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))){visit(Number(value[0]),Number(value[1]));return;}
  for(const child of value)walkCoordinates(child,visit);
}
function sourceBounds(geojson){
  const m=geojson?.metadata?.local_bounds;
  if([m?.min_x,m?.min_y,m?.max_x,m?.max_y].every(Number.isFinite))return{minX:m.min_x,minY:m.min_y,maxX:m.max_x,maxY:m.max_y};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const f of geojson?.features||[])walkCoordinates(f?.geometry?.coordinates,(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);});
  if(!Number.isFinite(minX))return{minX:-100,minY:-100,maxX:100,maxY:100};
  return{minX,minY,maxX,maxY};
}
function createTransform(geojson,bounds){
  const src=sourceBounds(geojson),sw=Math.max(1,src.maxX-src.minX),sh=Math.max(1,src.maxY-src.minY),pad=Math.min(128,Math.max(48,Math.min(bounds.w,bounds.h)*.04)),aw=Math.max(1,bounds.w-pad*2),ah=Math.max(1,bounds.h-pad*2),scale=Math.min(aw/sw,ah/sh),ox=bounds.x+(bounds.w-sw*scale)/2,oy=bounds.y+(bounds.h-sh*scale)/2;
  return ([x,y])=>({x:round(clamp(ox+(num(x)-src.minX)*scale,bounds.x+8,bounds.x+bounds.w-8),1),y:round(clamp(oy+(num(y)-src.minY)*scale,bounds.y+8,bounds.y+bounds.h-8),1)});
}
function bbox(points){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);if(!points.length)return{x:0,y:0,w:1,h:1};
  const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);return{x:round(minX,1),y:round(minY,1),w:round(Math.max(1,maxX-minX),1),h:round(Math.max(1,maxY-minY),1)};
}
function centerOf(points){const b=bbox(points);return{x:round(b.x+b.w/2,1),y:round(b.y+b.h/2,1)};}
function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;}return inside;}
function nearestDistrict(point,districts){let best=districts[0]||null,bestD=Infinity;for(const d of districts){if(d.polygon?.length>=3&&pointInPolygon(point,d.polygon))return d;const dd=dist(point,d.center);if(dd<bestD){bestD=dd;best=d;}}return best;}
function districtKind(raw){const s=slug(raw);if(/market|merchant|craft|commercial/.test(s))return'commerce';if(/castle|patric|administr|military/.test(s))return'royal';if(/park|green|garden/.test(s))return'plaza';if(/farm/.test(s))return'farm';if(/harbour|harbor|dock/.test(s))return'harbor';if(/slum/.test(s))return'residential';return'residential';}
function terrainMaterial(kind){return['commerce','royal','plaza'].includes(kind)?'stone':'grass';}
function roadLength(road){let n=0;for(let i=1;i<road.polyline.length;i++)n+=dist(road.polyline[i-1],road.polyline[i]);return n;}
function roadBearing(direction){return({north:0,northeast:45,east:90,southeast:135,south:180,southwest:225,west:270,northwest:315})[String(direction||'').toLowerCase()];}
function mstEdges(districts){
  if(districts.length<2)return[];const seen=new Set([districts[0].id]),edges=[];
  while(seen.size<districts.length){let best=null;for(const a of districts)if(seen.has(a.id))for(const b of districts)if(!seen.has(b.id)){const d=dist(a.center,b.center);if(!best||d<best.cost)best={from:a.id,to:b.id,cost:round(d,1)};}if(!best)break;edges.push(best);seen.add(best.to);}return edges;
}
function chooseSpawnDistrict(districts,bounds){const c={x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2};return nearestDistrict(c,districts)||districts[0];}
function safeLandmarkBounds(position,size,bounds){const s=Math.max(48,size),x=clamp(position.x-s/2,bounds.x,bounds.x+bounds.w-s),y=clamp(position.y-s/2,bounds.y,bounds.y+bounds.h-s);return{x:round(x,1),y:round(y,1),w:s,h:s};}
function buildChunkIndex(map,chunkSize=512){
  const groups={terrain:{},roads:{},blocks:{},parcels:{},landmarks:{},decorations:{}},key=(x,y)=>`${Math.floor(x/chunkSize)},${Math.floor(y/chunkSize)}`,add=(g,x,y,id)=>{const k=key(x,y);(groups[g][k]||(groups[g][k]=[])).push(id);};
  for(const t of map.terrain.cells)add('terrain',t.x,t.y,`${t.x}:${t.y}`);for(const r of map.roads){const p=r.polyline[Math.floor(r.polyline.length/2)];add('roads',p.x,p.y,r.id);}for(const b of map.blocks)add('blocks',b.bounds.x+b.bounds.w/2,b.bounds.y+b.bounds.h/2,b.id);for(const p of map.parcels)add('parcels',p.buildableArea.x,p.buildableArea.y,p.id);for(const l of map.landmarks)add('landmarks',l.position.x,l.position.y,l.id);for(const d of map.decorations)add('decorations',d.x,d.y,d.id);return{chunkSize,buckets:groups};
}
function recipeRequest(recipe,seed,style={}){
  const type=String(recipe?.type||'capital'),density=clamp(Number(style.density??recipe?.style?.density??.6),0,1),hasHarbor=(recipe?.districts||[]).some(d=>/harbou?r|port/.test(`${d.id} ${d.kind}`)),population=type==='capital'?Math.round(14000+density*9000):type==='village'?Math.round(2200+density*2200):Math.round(3500+density*2600),roadBearings=(recipe?.exits||[]).map(e=>roadBearing(e.direction)).filter(Number.isFinite);
  return{name:`Kelo ${recipe?.label||'World'} ${seed}`,seed,population,walls:type==='capital',plaza:true,citadel:type==='capital',temple:type!=='forest',capital:type==='capital',port:hasHarbor,harbourSize:hasHarbor?'large':undefined,oceanBearing:hasHarbor?45:undefined,roadBearings:roadBearings.length?roadBearings:undefined,urbanDensity:round(2.5+density*5.5,2),coreCapacity:type==='capital'?12000:undefined,biome:String(recipe?.biome||'temperate').replace(/_/g,' ')};
}

export function settlemakerGeoJsonToMapDefinition(serviceResult,recipe,{assetCatalogVersion='catalog-unbound',style={}}={}){
  const geojson=serviceResult?.geojson;if(geojson?.type!=='FeatureCollection'||!Array.isArray(geojson.features))throw new Error('SETTLEMAKER_GEOJSON_INVALID');
  const seed=Number.isFinite(Number(serviceResult.seed))?Number(serviceResult.seed):1,bounds={...recipe.worldBounds},tx=createTransform(geojson,bounds),features=geojson.features;
  const wardFeatures=features.filter(f=>f?.properties?.layer==='ward'&&polygonRing(f).length>=3),districts=wardFeatures.map((f,i)=>{const poly=polygonRing(f).map(tx),b=bbox(poly),kind=districtKind(f.properties?.wardType);return{id:`ward:${i}`,label:text(f.properties?.label)||`Ward ${i+1}`,kind,region:'settlemaker',weight:1,terrainProfile:terrainMaterial(kind)==='stone'?'central':'gardens',required:true,center:centerOf(poly),bounds:b,polygon:poly,sourceWardType:text(f.properties?.wardType)||'Ward'};});
  if(!districts.length){districts.push({id:'ward:0',label:'Settlement',kind:'residential',region:'settlemaker',weight:1,terrainProfile:'gardens',required:true,center:{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2},bounds:{...bounds},polygon:[{x:bounds.x,y:bounds.y},{x:bounds.x+bounds.w,y:bounds.y},{x:bounds.x+bounds.w,y:bounds.y+bounds.h},{x:bounds.x,y:bounds.y+bounds.h}],sourceWardType:'Settlement'});}

  const roads=[];for(const [i,f] of features.filter(x=>x?.properties?.layer==='street').entries()){const raw=lineCoords(f);if(raw.length<2)continue;const points=[];for(const c of raw){const p=tx(c),last=points[points.length-1];if(!last||dist(last,p)>.5)points.push(p);}if(points.length<2)continue;const artery=f.properties?.streetType==='artery',from=nearestDistrict(points[0],districts)?.id||districts[0].id,to=nearestDistrict(points[points.length-1],districts)?.id||districts[0].id;roads.push({id:`settlemaker:road:${text(f.properties?.street_id)||i}`,from,to,class:artery?'arterial':'collector',width:artery?recipe.road.arterialWidth:recipe.road.collectorWidth,material:artery?'royal_stone':'stone',priority:artery?4:2,polyline:points,source:'settlemaker'});}
  roads.sort((a,b)=>(b.class==='arterial')-(a.class==='arterial')||roadLength(b)-roadLength(a)||a.id.localeCompare(b.id));

  const buildingFeatures=features.filter(f=>f?.properties?.layer==='building'&&polygonRing(f).length>=3).slice(0,240),blocks=[],parcels=[];let bi=0;
  for(const f of buildingFeatures){const poly=polygonRing(f).map(tx),b=bbox(poly);if(b.w<3||b.h<3)continue;const center=centerOf(poly),district=nearestDistrict(center,districts)||districts[0],id=`settlemaker:block:${text(f.properties?.building_id)||bi}`;blocks.push({id,district:district.id,bounds:b,roadAccess:nearestRoadDistance(center,roads)<Math.max(180,recipe.road.collectorWidth*2.5),polygon:poly,source:'settlemaker-building'});const inset=Math.min(8,b.w*.12,b.h*.12);parcels.push({id:`settlemaker:parcel:${bi++}`,blockId:id,district:district.id,roadFrontage:true,width:round(b.w,1),depth:round(b.h,1),buildableArea:{x:round(b.x+inset,1),y:round(b.y+inset,1),w:round(Math.max(1,b.w-inset*2),1),h:round(Math.max(1,b.h-inset*2),1)},orientation:'south',allowedPrefabFamilies:[district.kind==='commerce'?'shop':'building'],density:round(Number(style.density??recipe.style?.density??.6),2),sourceWardType:text(f.properties?.wardType)});}

  const landmarkCandidates=[];for(const f of features){const layer=f?.properties?.layer,coord=pointCoords(f);if(!coord||!['poi','tower'].includes(layer))continue;const position=tx(coord),district=nearestDistrict(position,districts)||districts[0],kind=layer==='poi'?text(f.properties?.kind)||'poi':'tower';landmarkCandidates.push({position,district,kind,sourceId:text(f.properties?.poi_id)||`${layer}:${landmarkCandidates.length}`,label:text(f.properties?.kind)||text(f.properties?.ward_type)||kind});}
  const landmarks=[];for(const row of landmarkCandidates){if(landmarks.length>=10)break;if(landmarks.some(l=>dist(l.position,row.position)<118))continue;const first=landmarks.length===0;landmarks.push({id:`settlemaker:landmark:${row.sourceId}`,type:row.kind,label:row.label,role:first?'primary_anchor':'district_anchor',district:row.district.id,region:'settlemaker',position:row.position,bounds:safeLandmarkBounds(row.position,72,bounds),clearance:{radius:82},frontage:{facing:'south'},roadConnection:nearestRoadDistance(row.position,roads)<260,hero:first||landmarks.length<4,source:'settlemaker'});}

  const entranceFeatures=features.filter(f=>f?.properties?.layer==='entrance'&&pointCoords(f)),exits=[];for(const [i,f] of entranceFeatures.entries()){const p=tx(f.properties?.arrival_local||pointCoords(f)),district=nearestDistrict(p,districts)||districts[0];exits.push({id:text(f.properties?.entrance_id)||`gate_${i}`,x:p.x,y:p.y,direction:`bearing:${round(num(f.properties?.bearing_deg),1)}`,target:'settlemaker-route',district:district.id,kind:text(f.properties?.kind)||'land'});}

  const spawnDistrict=chooseSpawnDistrict(districts,bounds),spawnPoints=[{id:'spawn:primary',type:'player',x:spawnDistrict.center.x,y:spawnDistrict.center.y,district:spawnDistrict.id,facing:'south'}],navTree=mstEdges(districts),navigationEdges=navTree.map((e,i)=>({...e,roadId:`settlemaker:nav:${i}`}));for(const e of exits)navigationEdges.push({from:e.district,to:`exit:${e.id}`,cost:round(dist(districts.find(d=>d.id===e.district)?.center||spawnDistrict.center,e),1),roadId:null});
  const navigation={nodes:[...districts.map(d=>({id:d.id,x:d.center.x,y:d.center.y})),...exits.map(e=>({id:`exit:${e.id}`,x:e.x,y:e.y}))],edges:navigationEdges,spawnNode:spawnDistrict.id};
  const semanticNodes=[...districts.map(d=>({id:`district:${d.id}`,kind:'district',refId:d.id,required:true,region:'settlemaker'})),{id:'spawn:primary',kind:'spawn',refId:'primary',required:true},...landmarks.map(l=>({id:`landmark:${l.id}`,kind:'landmark',refId:l.id,required:false,district:l.district,hero:!!l.hero})),...exits.map(e=>({id:`exit:${e.id}`,kind:'exit',refId:e.id,required:true,district:e.district}))],semanticEdges=[{from:'spawn:primary',to:`district:${spawnDistrict.id}`,type:'required',role:'arrival'},...navTree.map(e=>({from:`district:${e.from}`,to:`district:${e.to}`,type:'required',role:'district-access'})),...landmarks.map(l=>({from:`district:${l.district}`,to:`landmark:${l.id}`,type:'preferred',role:'contains'})),...exits.map(e=>({from:`district:${e.district}`,to:`exit:${e.id}`,type:'required',role:'egress'}))];
  const semanticGraph={version:'semantic-graph-settlemaker-v1',nodes:semanticNodes,edges:semanticEdges,intentRef:{recipeId:recipe.id,seed}};

  const terrainCells=[];for(let y=bounds.y+TERRAIN_CELL/2;y<bounds.y+bounds.h;y+=TERRAIN_CELL)for(let x=bounds.x+TERRAIN_CELL/2;x<bounds.x+bounds.w;x+=TERRAIN_CELL){const d=nearestDistrict({x,y},districts)||spawnDistrict;terrainCells.push({x:round(x,1),y:round(y,1),district:d.id,material:terrainMaterial(d.kind),variation:round(seed32(`${seed}|terrain|${x}|${y}`)/4294967295,3)});}
  const terrain={mode:'settlemaker-ward-field-v1',cellSize:TERRAIN_CELL,cells:terrainCells},decorations=[],scenicVistas=landmarks.length?[{id:'vista:0',fromRef:'spawn',toRef:landmarks[0].id,from:{x:spawnPoints[0].x,y:spawnPoints[0].y},to:{...landmarks[0].position},weight:1,reserved:true}]:[];
  const uniqueRoadLinks=new Set(roads.filter(r=>r.from!==r.to).map(r=>[r.from,r.to].sort().join('|'))),generationStats={roadLoops:Math.max(0,uniqueRoadLinks.size-Math.max(0,districts.length-1)),roadCount:roads.length,blockCount:blocks.length,parcelCount:parcels.length,decorationCount:0,sourceFeatureCount:features.length};
  const base={metadata:{mapId:`map:${recipe.id}:${seed}:settlemaker`,seed,generatorVersion:`settlemaker-provider-${SETTLEMAKER_PROVIDER_VERSION}`,recipeId:recipe.id,recipeVersion:recipe.version,assetCatalogVersion:String(assetCatalogVersion||'catalog-unbound'),sourceGenerator:`settlemaker@${geojson.metadata?.settlemaker_version||'2.3.0'}`,sourceSchemaVersion:geojson.metadata?.schema_version??null,layoutHash:null},worldBounds:bounds,semanticGraph,districts,terrain,roads,blocks,parcels,landmarks,prefabPlacements:[],decorations,interactions:[],spawnPoints,exits,collisionDescriptors:[],navigation,scenicVistas,debug:{provider:'settlemaker-http',degradedFlags:serviceResult?.degradedFlags||geojson.metadata?.degraded_flags||[],originShift:serviceResult?.originShift||geojson.metadata?.local_origin_shift||null},generationStats};
  base.chunkIndex=buildChunkIndex(base,512);base.metadata.layoutHash=hashString(stableStringify({...base,metadata:{...base.metadata,layoutHash:null}}));
  const scoringRecipe={...recipe,districts:districts.map(d=>({id:d.id,kind:d.kind,required:true})),style:{...recipe.style,...style}};base.validation=validateMapDefinition(base,scoringRecipe);base.quality=scoreMapDefinition(base,scoringRecipe);return freezeDeep(base);
}

export async function generateSettlemakerCandidate(recipe,{seed=1,assetCatalogVersion='catalog-unbound',style={},serviceUrl=SETTLEMAKER_SERVICE_URL,fetchImpl=globalThis.fetch,timeoutMs=45000}={}){
  if(!recipe?.id)throw new Error('SETTLEMAKER_RECIPE_REQUIRED');if(typeof fetchImpl!=='function')throw new Error('SETTLEMAKER_FETCH_UNAVAILABLE');
  const controller=typeof AbortController!=='undefined'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),Math.max(1000,timeoutMs)):null;
  try{const response=await fetchImpl(`${String(serviceUrl).replace(/\/$/,'')}/generate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(recipeRequest(recipe,seed,style)),signal:controller?.signal});let payload=null;try{payload=await response.json();}catch{}if(!response.ok)throw new Error(`SETTLEMAKER_HTTP_${response.status}${payload?.error?`:${payload.error}`:''}`);if(payload?.generator!=='settlemaker'||!payload?.geojson)throw new Error('SETTLEMAKER_RESPONSE_INVALID');return settlemakerGeoJsonToMapDefinition(payload,recipe,{assetCatalogVersion,style});}
  catch(error){if(error?.name==='AbortError')throw new Error('SETTLEMAKER_TIMEOUT');throw error;}finally{if(timer)clearTimeout(timer);}
}
function candidateSeed(seed,index){return index===0?(Number.isFinite(Number(seed))?Number(seed):seed32(seed)):seed32(`${seed}|settlemaker|candidate|${index}`);}
export async function generateSettlemakerBestOf(recipe,{seed=1,count=2,assetCatalogVersion='catalog-unbound',style={},serviceUrl=SETTLEMAKER_SERVICE_URL,fetchImpl=globalThis.fetch,timeoutMs=45000}={}){
  const requested=clamp(Math.floor(Number(count)||2),1,MAX_REMOTE_CANDIDATES),candidates=[],errors=[];for(let i=0;i<requested;i++){const s=candidateSeed(seed,i);try{const map=await generateSettlemakerCandidate(recipe,{seed:s,assetCatalogVersion,style,serviceUrl,fetchImpl,timeoutMs});if(map.validation.valid)candidates.push(map);else errors.push({seed:s,error:map.validation.errors.join(',')||'INVALID_MAP'});}catch(error){errors.push({seed:s,error:error?.message||String(error)});}}
  const sorted=candidates.sort((a,b)=>b.quality.total-a.quality.total||a.metadata.layoutHash.localeCompare(b.metadata.layoutHash));if(!sorted.length)throw new Error(`SETTLEMAKER_NO_VALID_CANDIDATE${errors[0]?.error?`:${errors[0].error}`:''}`);const best=sorted[0];return freezeDeep({requested,validCount:sorted.length,rejectedCount:requested-sorted.length,best,selections:{bestOverall:best,mostMonumental:best,mostOrganic:best,mostExplorable:best,mostCompact:best},candidates:sorted,provider:'settlemaker',errors});
}

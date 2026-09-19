/* KELO-INDEX
 * area: STUDIO / SEMANTIC CONTEXT RESOLVER
 * owner: Kelo World Building
 * keys: SEMANTIC CONTEXT ROAD WATER BUILDING DISTRICT SURFACE RULES LOCAL QUERY MOBILE
 * owns: cheap local world-context reads and semantic allow/weight decisions for procedural authoring
 * does-not-own: placement, commits, rendering, authority, downloads or terrain mutation
 * public-api: createSemanticContextResolver(), classifySurfaceCell()
 * online: no; reads current Studio document + spatial index only
 * mobile: O(local terrain neighborhood + spatial chunk query); never scans full terrain/entities per point
 */

import {inferSemanticRole} from './semantic-brush-profile.mjs';

const WATER_RE=/\b(water|river|lake|ocean|sea|pond|swamp|marsh|canal|stream|lagoon|agua|rio|río|lago|mar|pantano|canal|arroyo)\b/i;
const PATH_RE=/\b(path|road|street|trail|walkway|sidewalk|avenue|lane|bridge|camino|carretera|calle|sendero|acera|avenida|puente)\b/i;
const clamp=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):fallback));
const expand=(r,m)=>({x:r.x-m,y:r.y-m,w:r.w+m*2,h:r.h+m*2});
const center=r=>({x:r.x+r.w/2,y:r.y+r.h/2});

function rectFrom(value){
  const source=value?.rect||value?.bounds||value;
  if(!source||typeof source!=='object')return null;
  const x=Number(source.x),y=Number(source.y),w=Number(source.w??source.width),h=Number(source.h??source.height);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
  return{x,y,w,h};
}
function tagsOf(value){
  return [
    ...(Array.isArray(value?.tags)?value.tags:[]),
    ...(Array.isArray(value?.metadata?.tags)?value.metadata.tags:[])
  ].map(v=>String(v).trim().toLowerCase()).filter(Boolean);
}
function zoneRules(zone){
  const tags=tagsOf(zone),only=new Set(),block=new Set(),prefer=new Set(),avoid=new Set(),districts=[];
  for(const tag of tags){
    if(tag.startsWith('semantic:only:'))only.add(tag.slice(14));
    else if(tag.startsWith('semantic:block:'))block.add(tag.slice(15));
    else if(tag.startsWith('semantic:prefer:'))prefer.add(tag.slice(16));
    else if(tag.startsWith('semantic:boost:'))prefer.add(tag.slice(15));
    else if(tag.startsWith('semantic:avoid:'))avoid.add(tag.slice(15));
    else if(tag.startsWith('district:')||tag.startsWith('biome:'))districts.push(tag);
  }
  return{tags,only,block,prefer,avoid,districts};
}
function keyFor(x,y,size){
  const sx=Math.floor(Math.max(0,Number(x)||0)/size)*size;
  const sy=Math.floor(Math.max(0,Number(y)||0)/size)*size;
  return String(Math.floor(sx))+','+String(Math.floor(sy));
}
export function classifySurfaceCell(cell){
  if(!cell||typeof cell!=='object')return'empty';
  const role=String(cell.role||'').toLowerCase(),material=String(cell.material||'').replace(/[_-]+/g,' ');
  if(role==='path'||PATH_RE.test(material))return'path';
  if(WATER_RE.test(material))return'water';
  return'terrain';
}

export function createSemanticContextResolver(kernel,options={}){
  if(!kernel)throw new Error('SEMANTIC_CONTEXT_KERNEL_REQUIRED');
  const document=kernel.document||{},tileSize=Math.max(1,Number(document.settings?.tileSize)||32);
  const settings={
    enabled:options.enabled!==false,
    strictAffinity:options.strictAffinity!==false,
    roadClearance:clamp(options.roadClearance,0,192,32),
    roadAffinity:clamp(options.roadAffinity,16,256,96),
    waterClearance:clamp(options.waterClearance,0,192,8),
    waterAffinity:clamp(options.waterAffinity,16,256,96),
    buildingAffinity:clamp(options.buildingAffinity,16,256,88)
  };
  const zoneChunkSize=Math.max(128,Number(kernel.spatial?.chunkSize)||512),zones=[],zoneBuckets=new Map();
  const zoneBucketKey=(x,y)=>String(x)+','+String(y);
  for(const zone of document.zones||[]){
    const rect=rectFrom(zone);if(!rect)continue;
    const row={rect,rules:zoneRules(zone)};zones.push(row);
    const minX=Math.floor(rect.x/zoneChunkSize),minY=Math.floor(rect.y/zoneChunkSize),maxX=Math.floor((rect.x+Math.max(0,rect.w-1))/zoneChunkSize),maxY=Math.floor((rect.y+Math.max(0,rect.h-1))/zoneChunkSize);
    for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
      const key=zoneBucketKey(cx,cy);if(!zoneBuckets.has(key))zoneBuckets.set(key,[]);zoneBuckets.get(key).push(row);
    }
  }

  function surfaceAt(x,y){
    const cell=document.terrain?.[keyFor(x,y,tileSize)]||null;
    return{kind:classifySurfaceCell(cell),cell};
  }
  function surfaceNeighborhood(x,y){
    const radius=Math.max(tileSize,settings.roadAffinity,settings.waterAffinity),steps=Math.ceil(radius/tileSize),bx=Math.floor(Math.max(0,Number(x)||0)/tileSize)*tileSize,by=Math.floor(Math.max(0,Number(y)||0)/tileSize)*tileSize;
    const roadLimitSq=settings.roadAffinity*settings.roadAffinity,waterLimitSq=settings.waterAffinity*settings.waterAffinity;
    let road=null,water=null,roadBest=Infinity,waterBest=Infinity;
    for(let oy=-steps;oy<=steps;oy++)for(let ox=-steps;ox<=steps;ox++){
      const sx=bx+ox*tileSize,sy=by+oy*tileSize;if(sx<0||sy<0)continue;
      const key=String(Math.floor(sx))+','+String(Math.floor(sy)),cell=document.terrain?.[key],kind=classifySurfaceCell(cell);
      if(kind!=='path'&&kind!=='water')continue;
      const cx=sx+tileSize/2,cy=sy+tileSize/2,d2=(cx-x)*(cx-x)+(cy-y)*(cy-y);
      if(kind==='path'&&d2<=roadLimitSq&&d2<roadBest){roadBest=d2;road={x:sx,y:sy,w:tileSize,h:tileSize,cell,distance:Math.sqrt(d2)};}
      if(kind==='water'&&d2<=waterLimitSq&&d2<waterBest){waterBest=d2;water={x:sx,y:sy,w:tileSize,h:tileSize,cell,distance:Math.sqrt(d2)};}
    }
    return{road,water};
  }
  function nearSurface(x,y,kind,distance){
    const hit=surfaceNeighborhood(x,y)[kind==='path'?'road':'water'];
    return hit&&hit.distance<=Math.max(tileSize,Number(distance)||0)?hit:null;
  }
  function rectTouchesSurface(rect,kind,clearance=0){
    const q=expand(rect,Math.max(0,Number(clearance)||0)),minX=Math.floor(Math.max(0,q.x)/tileSize)*tileSize,minY=Math.floor(Math.max(0,q.y)/tileSize)*tileSize;
    const maxX=Math.floor(Math.max(0,q.x+q.w-1)/tileSize)*tileSize,maxY=Math.floor(Math.max(0,q.y+q.h-1)/tileSize)*tileSize;
    for(let y=minY;y<=maxY;y+=tileSize)for(let x=minX;x<=maxX;x+=tileSize){
      const key=String(Math.floor(x))+','+String(Math.floor(y));
      const cell=document.terrain?.[key];
      if(classifySurfaceCell(cell)===kind)return true;
    }
    return false;
  }
  function districtAt(x,y){
    const only=new Set(),block=new Set(),prefer=new Set(),avoid=new Set(),districts=[],tags=[],bucket=zoneBuckets.get(zoneBucketKey(Math.floor(x/zoneChunkSize),Math.floor(y/zoneChunkSize)))||[];
    for(const zone of bucket){
      if(!(x>=zone.rect.x&&x<=zone.rect.x+zone.rect.w&&y>=zone.rect.y&&y<=zone.rect.y+zone.rect.h))continue;
      for(const value of zone.rules.only)only.add(value);
      for(const value of zone.rules.block)block.add(value);
      for(const value of zone.rules.prefer)prefer.add(value);
      for(const value of zone.rules.avoid)avoid.add(value);
      districts.push(...zone.rules.districts);tags.push(...zone.rules.tags);
    }
    return{only,block,prefer,avoid,districts:[...new Set(districts)],tags:[...new Set(tags)]};
  }
  function isBuildingEntry(entry){
    const entity=entry?.data||{},prefab=kernel.prefabs?.resolve?.(entity.prefabId)||null;
    if(entity.components?.buildingPiece||entity.components?.building||entity.components?.structure)return true;
    return inferSemanticRole(prefab||entity)==='structure';
  }
  function nearbyBuilding(x,y,distance=settings.buildingAffinity){
    const d=Math.max(1,Number(distance)||1),rows=kernel.spatial?.queryRect?.({x:x-d,y:y-d,w:d*2,h:d*2},{category:'entity'})||[];
    let best=null,bestDistance=Infinity;
    for(const entry of rows){
      if(!isBuildingEntry(entry))continue;
      const r=entry.rect,dx=Math.max(r.x-x,0,x-(r.x+r.w)),dy=Math.max(r.y-y,0,y-(r.y+r.h)),dist=Math.hypot(dx,dy);
      if(dist<bestDistance){bestDistance=dist;best={entry,rect:{...r},distance:dist};}
    }
    return bestDistance<=d?best:null;
  }
  function contextAt(x,y){
    const surface=surfaceAt(x,y),neighborhood=surfaceNeighborhood(x,y),road=neighborhood.road,water=neighborhood.water,building=nearbyBuilding(x,y),district=districtAt(x,y);
    return{
      surface:surface.kind,onRoad:surface.kind==='path',onWater:surface.kind==='water',
      nearRoad:!!road,roadDistance:road?.distance??Infinity,
      nearWater:!!water,waterDistance:water?.distance??Infinity,
      nearBuilding:!!building,buildingDistance:building?.distance??Infinity,
      district
    };
  }
  function roleWeightMultiplier(role,context){
    if(!settings.enabled)return 1;
    role=String(role||'generic');
    let m=1;
    if(context.nearRoad){
      if(role==='roadside')m*=5;
      else if(role==='detail')m*=1.25;
      else if(role==='canopy')m*=.16;
      else if(role==='understory')m*=.5;
      else if(role==='structure')m*=.35;
    }else if(role==='roadside'&&settings.strictAffinity&&!context.nearBuilding)m*=.06;
    if(context.nearWater){
      if(role==='waterside')m*=6;
      else if(role==='detail')m*=1.2;
      else if(role==='understory')m*=.85;
      else if(role==='canopy')m*=.55;
      else if(role==='structure')m*=.18;
    }else if(role==='waterside'&&settings.strictAffinity)m*=.04;
    if(context.nearBuilding){
      if(role==='detail')m*=1.8;
      else if(role==='roadside')m*=2.4;
      else if(role==='canopy')m*=.28;
      else if(role==='understory')m*=.75;
      else if(role==='structure')m*=.5;
    }
    const d=context.district;
    if(d.block.has(role))return 0;
    if(d.only.size&&!d.only.has(role))return 0;
    if(d.prefer.has(role))m*=3.25;
    if(d.avoid.has(role))m*=.12;
    return m;
  }
  function rejectReason(item,rect){
    if(!settings.enabled)return null;
    const role=String(item?.role||'generic'),c=center(rect),context=contextAt(c.x,c.y);
    if(context.district.block.has(role)||(context.district.only.size&&!context.district.only.has(role)))return'district';
    if(rectTouchesSurface(rect,'path',role==='roadside'?0:settings.roadClearance))return'road';
    if(rectTouchesSurface(rect,'water',settings.waterClearance))return'water';
    if(settings.strictAffinity&&role==='waterside'&&!context.nearWater)return'water-affinity';
    if(settings.strictAffinity&&role==='roadside'&&!context.nearRoad&&!context.nearBuilding)return'road-affinity';
    return null;
  }
  function describeAt(x,y){
    const c=contextAt(x,y);
    return{
      surface:c.surface,nearRoad:c.nearRoad,nearWater:c.nearWater,nearBuilding:c.nearBuilding,
      districts:c.district.districts.slice(),districtTags:c.district.tags.slice()
    };
  }

  return Object.freeze({
    version:'semantic-context-resolver-v1',
    settings:Object.freeze({...settings}),
    tileSize,
    surfaceAt,nearSurface,contextAt,describeAt,roleWeightMultiplier,rejectReason,
    stats:()=>({zones:zones.length,zoneBuckets:zoneBuckets.size,zoneChunkSize,terrainCells:Object.keys(document.terrain||{}).length})
  });
}

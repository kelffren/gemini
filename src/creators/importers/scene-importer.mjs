/* KELO-INDEX
 * area: CREATORS / SCENE IMPORT
 * owner: Kelo Universal Content Bridge
 * keys: SCENE TILED TMJ JSON LDtk PREFAB COMPLETE MAP MOBILE
 * purpose: Normalize safe data-only scene/map files into Studio prefab definitions.
 * security: never evaluates scripts or imports executable code.
 */

const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').trim();
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const MAX_CHILDREN=600;
const MAX_BOUNDS=32768;

function propMap(list){
  const out={};
  for(const p of Array.isArray(list)?list:[]) if(p&&text(p.name)) out[text(p.name)]=p.value;
  return out;
}
function prefabFromProps(props={}){
  return text(props.keloPrefabId||props.prefabId||props.kelo_prefab_id||props['kelo.prefabId']);
}
function child(prefabId,x,y,w=32,h=32,rotation=0,components={}){
  if(!text(prefabId))return null;
  return {prefabId:text(prefabId),dx:Number(x)||0,dy:Number(y)||0,rotation:Number(rotation)||0,
    bounds:{w:Math.max(1,Number(w)||32),h:Math.max(1,Number(h)||32)},components:copy(components||{})};
}
function finish(children,asset,{label,width,height,format,warnings=[]}={}){
  children=children.filter(Boolean);
  if(!children.length)throw new Error('CONTENT_SCENE_NO_PLACEABLE_OBJECTS');
  if(children.length>MAX_CHILDREN)throw new Error('CONTENT_SCENE_TOO_LARGE:'+children.length+':MAX_'+MAX_CHILDREN);
  let minX=0,minY=0,maxX=Math.max(32,Number(width)||0),maxY=Math.max(32,Number(height)||0);
  for(const c of children){minX=Math.min(minX,c.dx);minY=Math.min(minY,c.dy);maxX=Math.max(maxX,c.dx+c.bounds.w);maxY=Math.max(maxY,c.dy+c.bounds.h);}
  if(minX||minY)for(const c of children){c.dx-=minX;c.dy-=minY;}
  const bounds={w:clamp(maxX-minX,1,MAX_BOUNDS),h:clamp(maxY-minY,1,MAX_BOUNDS)};
  const id='creator-prefab:personal:'+text(asset?.externalId||asset?.id||'scene').replace(/[^a-z0-9_-]+/gi,'-');
  return {prefabDefinition:{id,version:1,label:text(label||asset?.name||'Imported Scene'),category:'Scenes',bounds,children,
    createdAt:Date.now(),updatedAt:Date.now(),sourceFormat:format||'kelo'},
    importReport:{format:format||'kelo',objects:children.length,bounds,warnings:[...warnings]}};
}

function normalizeKelo(raw,asset){
  const src=raw.prefabDefinition||raw.scene||raw.prefab||raw;
  if(!Array.isArray(src.children))return null;
  const children=src.children.map((c,i)=>{
    if(!c||!text(c.prefabId))throw new Error('CONTENT_SCENE_CHILD_INVALID:'+i);
    return child(c.prefabId,c.dx,c.dy,c.bounds?.w,c.bounds?.h,c.rotation,c.components);
  });
  return finish(children,asset,{label:src.label,width:src.bounds?.w,height:src.bounds?.h,format:'kelo-scene-v1'});
}

function tiledGidCatalog(raw){
  const rows=[];
  for(const set of Array.isArray(raw.tilesets)?raw.tilesets:[]){
    const first=Number(set.firstgid)||1;
    const tiles=Array.isArray(set.tiles)?set.tiles:Array.isArray(set.sourceData?.tiles)?set.sourceData.tiles:[];
    for(const tile of tiles){const props=propMap(tile.properties),prefabId=prefabFromProps(props);if(prefabId)rows.push({gid:first+(Number(tile.id)||0),prefabId});}
  }
  return new Map(rows.map(r=>[r.gid,r.prefabId]));
}
function normalizeTiled(raw,asset){
  if(text(raw.type).toLowerCase()!=='map'||!Array.isArray(raw.layers))return null;
  const tw=Math.max(1,Number(raw.tilewidth)||32),th=Math.max(1,Number(raw.tileheight)||32),gidMap=tiledGidCatalog(raw);
  const children=[],warnings=[];let skippedTiles=0,skippedObjects=0;
  for(const layer of raw.layers){
    if(layer?.visible===false)continue;
    if(layer.type==='objectgroup'){
      for(const o of Array.isArray(layer.objects)?layer.objects:[]){
        const props=propMap(o.properties),prefabId=prefabFromProps(props);
        if(!prefabId){skippedObjects++;continue;}
        children.push(child(prefabId,(Number(o.x)||0)+(Number(layer.offsetx)||0),(Number(o.y)||0)+(Number(layer.offsety)||0),o.width||tw,o.height||th,o.rotation,{tiled:{layer:text(layer.name),objectId:o.id??null,properties:props}}));
      }
    }else if(layer.type==='tilelayer'&&Array.isArray(layer.data)){
      const width=Math.max(1,Number(layer.width)||Number(raw.width)||1);
      layer.data.forEach((encoded,index)=>{
        const gid=(Number(encoded)||0)&0x1fffffff;if(!gid)return;
        const prefabId=gidMap.get(gid);if(!prefabId){skippedTiles++;return;}
        const x=(index%width)*tw+(Number(layer.offsetx)||0),y=Math.floor(index/width)*th+(Number(layer.offsety)||0);
        children.push(child(prefabId,x,y,tw,th,0,{tiled:{layer:text(layer.name),gid}}));
      });
    }
  }
  if(skippedTiles)warnings.push('TILED_TILES_WITHOUT_KELO_PREFAB:'+skippedTiles);
  if(skippedObjects)warnings.push('TILED_OBJECTS_WITHOUT_KELO_PREFAB:'+skippedObjects);
  return finish(children,asset,{label:raw.name||asset?.name,width:(Number(raw.width)||0)*tw,height:(Number(raw.height)||0)*th,format:'tiled-json',warnings});
}

function normalizeLdtk(raw,asset){
  if(!Array.isArray(raw.levels))return null;
  const level=raw.levels[0];if(!level)return null;
  const children=[],warnings=[];let skipped=0;
  for(const layer of Array.isArray(level.layerInstances)?level.layerInstances:[]){
    for(const e of Array.isArray(layer.entityInstances)?layer.entityInstances:[]){
      const fields={};for(const f of Array.isArray(e.fieldInstances)?e.fieldInstances:[])fields[text(f.__identifier)]=f.__value;
      const prefabId=prefabFromProps(fields)||text(e.__identifier);
      if(!prefabId){skipped++;continue;}
      children.push(child(prefabId,e.px?.[0],e.px?.[1],e.width,e.height,0,{ldtk:{layer:text(layer.__identifier),iid:e.iid||null,fields}}));
    }
  }
  if(skipped)warnings.push('LDTK_ENTITIES_SKIPPED:'+skipped);
  return finish(children,asset,{label:level.identifier||asset?.name,width:level.pxWid,height:level.pxHei,format:'ldtk-json',warnings});
}

export function detectSceneFormat(raw){
  if(raw?.prefabDefinition||raw?.scene||raw?.prefab||Array.isArray(raw?.children))return'kelo';
  if(text(raw?.type).toLowerCase()==='map'&&Array.isArray(raw?.layers))return'tiled';
  if(Array.isArray(raw?.levels)&&raw?.defs)return'ldtk';
  return'unknown';
}
export function normalizeSceneDocument(raw,asset={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('CONTENT_SCENE_OBJECT_REQUIRED');
  const format=detectSceneFormat(raw);
  const result=format==='kelo'?normalizeKelo(raw,asset):format==='tiled'?normalizeTiled(raw,asset):format==='ldtk'?normalizeLdtk(raw,asset):null;
  if(!result)throw new Error('CONTENT_SCENE_FORMAT_UNSUPPORTED');
  return result;
}
export const SCENE_IMPORTER=Object.freeze({version:'scene-importer-v1',detectSceneFormat,normalizeSceneDocument,MAX_CHILDREN});

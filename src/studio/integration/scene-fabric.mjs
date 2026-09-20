/* KELO-INDEX
 * area: STUDIO / SCENE FABRIC
 * owner: Kelo Universal Content → Studio
 * purpose: validate and stage reusable scenes before any Studio mutation.
 * invariant: this module never writes World authority directly.
 */
const text=v=>String(v??'').trim();
const finite=v=>Number.isFinite(Number(v));
const stable=(value)=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
};
export function normalizeSceneManifest(input={}){
  const sceneId=text(input.sceneId||input.id);
  if(!sceneId)throw new Error('SCENE_FABRIC_ID_REQUIRED');
  const instances=(Array.isArray(input.instances)?input.instances:[]).map((row,index)=>{
    const assetId=text(row?.assetId||row?.prefabId);
    if(!assetId)throw new Error(`SCENE_FABRIC_INSTANCE_ASSET_REQUIRED:${index}`);
    const t=row?.transform||row||{};
    return Object.freeze({
      instanceId:text(row?.instanceId)||`${sceneId}:instance:${index}`,
      assetId,
      version:Math.max(1,Number(row?.version)||1),
      transform:Object.freeze({x:finite(t.x)?Number(t.x):0,y:finite(t.y)?Number(t.y):0,scale:finite(t.scale)?Number(t.scale):1,rotation:finite(t.rotation)?Number(t.rotation):0}),
      layer:text(row?.layer)||'world',
      overrides:row?.overrides&&typeof row.overrides==='object'?stable(row.overrides):null
    });
  });
  const dependencies=[...new Set([...(Array.isArray(input.dependencies)?input.dependencies:[]).map(text),...instances.map(x=>x.assetId)].filter(Boolean))].sort();
  return Object.freeze({schemaVersion:1,sceneId,version:Math.max(1,Number(input.version)||1),label:text(input.label)||sceneId,dependencies:Object.freeze(dependencies),instances:Object.freeze(instances),metadata:Object.freeze(stable(input.metadata&&typeof input.metadata==='object'?input.metadata:{}))});
}
export function resolveSceneDependencies(manifest,{hasAsset=()=>false}={}){
  const scene=normalizeSceneManifest(manifest);
  const available=[],missing=[];
  for(const id of scene.dependencies)(hasAsset(id)?available:missing).push(id);
  return Object.freeze({scene,available:Object.freeze(available),missing:Object.freeze(missing),ready:missing.length===0,reuseRatio:scene.dependencies.length?available.length/scene.dependencies.length:1});
}
export function stageScene(manifest,{hasAsset=()=>false,maxInstances=2500}={}){
  const resolved=resolveSceneDependencies(manifest,{hasAsset});
  const errors=[];
  if(resolved.scene.instances.length>maxInstances)errors.push(`SCENE_FABRIC_INSTANCE_LIMIT:${resolved.scene.instances.length}>${maxInstances}`);
  if(resolved.missing.length)errors.push(`SCENE_FABRIC_MISSING_ASSETS:${resolved.missing.join(',')}`);
  const duplicateIds=new Set(),seen=new Set();
  for(const row of resolved.scene.instances){if(seen.has(row.instanceId))duplicateIds.add(row.instanceId);seen.add(row.instanceId);}
  if(duplicateIds.size)errors.push(`SCENE_FABRIC_DUPLICATE_INSTANCE:${[...duplicateIds].join(',')}`);
  return Object.freeze({status:errors.length?'blocked':'ready',scene:resolved.scene,dependencies:resolved,errors:Object.freeze(errors),metrics:Object.freeze({instances:resolved.scene.instances.length,dependencies:resolved.scene.dependencies.length,reused:resolved.available.length,missing:resolved.missing.length,reuseRatio:resolved.reuseRatio})});
}
export async function prepareSceneImport(manifest,{hasAsset=()=>false,ensureAsset=null,maxInstances=2500}={}){
  let stage=stageScene(manifest,{hasAsset,maxInstances});
  if(stage.dependencies.missing.length&&typeof ensureAsset==='function'){
    for(const id of stage.dependencies.missing)await ensureAsset(id);
    stage=stageScene(manifest,{hasAsset,maxInstances});
  }
  if(stage.status!=='ready')throw Object.assign(new Error(stage.errors.join('|')||'SCENE_FABRIC_STAGE_BLOCKED'),{stage});
  return stage;
}
export function sceneHealth(stage){
  const m=stage?.metrics||{};
  return Object.freeze({ready:stage?.status==='ready',instances:Number(m.instances)||0,dependencies:Number(m.dependencies)||0,missing:Number(m.missing)||0,reusePercent:Math.round((Number(m.reuseRatio)||0)*100)});
}
export const KELO_SCENE_FABRIC=Object.freeze({version:'scene-fabric-v1',normalizeSceneManifest,resolveSceneDependencies,stageScene,prepareSceneImport,sceneHealth});

/* KELO-INDEX
 * area: CREATORS / PERSONAL UNIVERSAL CONTENT RUNTIME
 * owner: Kelo Universal Content Bridge
 * keys: PERSONAL CONTENT AUDIO MUSIC AMBIENCE SFX ABILITY SCENE LAZY
 * purpose: Hydrate integrated non-visual vault content only when requested; never add it to normal boot.
 */
import {listAssets,getManifest,getObjectURL} from './personal-asset-vault.mjs';

const audioRows=new Map(),abilityRows=new Map(),sceneRows=new Map(),players=new Map();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const AUDIO_KINDS=new Set(['sfx','music','ambience']);

async function registerOne(root,id){
  const asset=(await listAssets()).find(row=>row.id===String(id));if(!asset?.integrated||!asset.downloaded)return false;
  const manifest=await getManifest(asset.id);if(!manifest)return false;const kind=asset.contentKind||manifest.contentKind;
  if(AUDIO_KINDS.has(kind)){audioRows.set(asset.id,{asset:copy(asset),manifest:copy(manifest)});return true;}
  if(kind==='ability'){abilityRows.set(asset.id,{asset:copy(asset),manifest:copy(manifest)});return true;}
  if(kind==='scene'||kind==='prefab'){sceneRows.set(asset.id,{asset:copy(asset),manifest:copy(manifest)});try{root.dispatchEvent(new CustomEvent('kelo:personal-scene-ready',{detail:{id:asset.id,prefabDefinition:copy(manifest.prefabDefinition)}}));}catch{}return true;}
  return false;
}

async function hydrate(root=globalThis){
  const rows=(await listAssets()).filter(a=>a.integrated&&a.downloaded&&!['image','sprite','tileset','animation','vfx'].includes(a.contentKind));let installed=0;
  for(const row of rows){try{if(await registerOne(root,row.id))installed++;}catch(error){console.warn('[Kelo personal content] skipped',row.id,error?.message||error);}}
  return{ready:true,installed,total:rows.length,audio:audioRows.size,abilities:abilityRows.size,scenes:sceneRows.size};
}

async function playAudio(id,{volume=1,loop}={}){
  id=String(id);const row=audioRows.get(id);if(!row)throw new Error('PERSONAL_AUDIO_NOT_HYDRATED');
  const src=await getObjectURL(id);if(!src)throw new Error('PERSONAL_AUDIO_BINARY_MISSING');
  stopAudio(id);const audio=new Audio(src);audio.preload='none';audio.volume=Math.max(0,Math.min(1,Number(volume)||0));audio.loop=loop==null?!!row.manifest.playback?.loop:!!loop;players.set(id,audio);
  audio.addEventListener('ended',()=>{if(!audio.loop)players.delete(id);},{once:true});await audio.play();return true;
}
function stopAudio(id){id=String(id);const audio=players.get(id);if(!audio)return false;try{audio.pause();audio.currentTime=0;}catch{}players.delete(id);return true;}
function stopAllAudio(){for(const id of [...players.keys()])stopAudio(id);}
async function castAbility(id,request={}){
  id=String(id);const row=abilityRows.get(id);if(!row)throw new Error('PERSONAL_ABILITY_NOT_HYDRATED');
  const engine=globalThis.KeloAbilities?.engine;if(!engine?.castSource)throw new Error('PERSONAL_ABILITY_RUNTIME_UNAVAILABLE');
  return engine.castSource({sourceType:'personal-content',sourceId:id,definition:copy(row.manifest.definition),request:{...request}});
}
function installSceneIntoTool(id,tool){id=String(id);const row=sceneRows.get(id);if(!row?.manifest?.prefabDefinition||!tool?.register)return false;tool.register(copy(row.manifest.prefabDefinition));return true;}
function installScenesIntoStudio(studio){const tool=studio?.tools?.prefabStamp;if(!tool?.register)return{ready:false,installed:0};let installed=0;for(const id of sceneRows.keys()){try{if(installSceneIntoTool(id,tool))installed++;}catch(error){console.warn('[Kelo personal scene]',id,error?.message||error);}}return{ready:true,installed};}

export function installPersonalContentApis(root=globalThis){
  if(!root.KELO_PERSONAL_AUDIO)root.KELO_PERSONAL_AUDIO=Object.freeze({list:()=>[...audioRows.values()].map(copy),play:playAudio,stop:stopAudio,stopAll:stopAllAudio});
  if(!root.KELO_PERSONAL_ABILITIES)root.KELO_PERSONAL_ABILITIES=Object.freeze({list:()=>[...abilityRows.values()].map(copy),get:id=>copy(abilityRows.get(String(id))||null),cast:castAbility});
  if(!root.KELO_PERSONAL_SCENES)root.KELO_PERSONAL_SCENES=Object.freeze({list:()=>[...sceneRows.values()].map(copy),get:id=>copy(sceneRows.get(String(id))||null),installIntoTool:installSceneIntoTool,installIntoStudio:installScenesIntoStudio});
  return true;
}
export function bindPersonalContentRuntime(root=globalThis){
  installPersonalContentApis(root);
  const handler=event=>{const id=event?.detail?.asset?.id;if(id)void registerOne(root,id).catch(()=>{});};root?.addEventListener?.('kelo:personal-content-integrated',handler);
  return()=>root?.removeEventListener?.('kelo:personal-content-integrated',handler);
}
export const PERSONAL_CONTENT_RUNTIME_BRIDGE=Object.freeze({hydrate,registerOne,bindPersonalContentRuntime,installPersonalContentApis,installScenesIntoStudio});
if(typeof window!=='undefined'){installPersonalContentApis(window);window.KELO_PERSONAL_CONTENT_RUNTIME_BRIDGE=PERSONAL_CONTENT_RUNTIME_BRIDGE;}

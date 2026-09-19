/* KELO-INDEX
 * area: STUDIO / LIBRARY PALETTE + SEMANTIC BRUSH
 * owner: Kelo Studio World Building
 * keys: BUILD PALETTE SEMANTIC BRUSH MULTI ASSET DENSITY RADIUS ROLE WEIGHT CONSTRAINT DETERMINISTIC MOBILE UNDO AUTHORITY
 * owns: local semantic multi-prefab brush previews and one-history-action stroke commits
 * does-not-own: downloads, asset integration, authority transport, world rendering or library selection
 * public-api: createLibraryPaletteBrushTool()
 * online: every stroke composes ordinary entity.place commands; authority remains Studio CommandBus mirror
 * mobile: bounded previews, bounded palette, no world scan during pointermove, one input context
 */

import {createPlaceEntityCommand} from '../document/document-commands.mjs';
import {createCompositeCommand} from '../document/composite-command.mjs';
import {
  SEMANTIC_PRESETS,
  buildSemanticDescriptor,
  applySemanticPreset,
  normalizeSemanticPreset,
  semanticPresetLabel,
  semanticRoleCounts
} from './semantic-brush-profile.mjs';
import {createSemanticContextResolver} from './semantic-context-resolver.mjs';

const INPUT_CONTEXT='studio-library-palette-brush';
const MAX_PALETTE=24;
const MAX_PREVIEW=180;
const DENSITY_STEPS=Object.freeze([.65,1,1.35,1.75,2.2]);
const RADIUS_STEPS=Object.freeze([24,56,96,144,208]);
const DEFAULT_BLOCKED_ZONE_TAGS=Object.freeze(['no-build','keep-clear','spawn-clear']);

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const clamp=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):fallback));
const num=v=>Number(v)||0;
const rectIntersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const expandRect=(r,margin=0)=>({x:r.x-margin,y:r.y-margin,w:r.w+margin*2,h:r.h+margin*2});
const rectFrom=value=>{
  const source=value?.rect||value?.bounds||value;
  if(!source||typeof source!=='object')return null;
  const x=Number(source.x),y=Number(source.y),w=Number(source.w??source.width),h=Number(source.h??source.height);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
  return{x,y,w,h};
};
const tagsOf=value=>[...(Array.isArray(value?.tags)?value.tags:[]),...(Array.isArray(value?.metadata?.tags)?value.metadata.tags:[])].map(v=>String(v).toLowerCase());

function newId(){
  const uuid=globalThis.crypto?.randomUUID?.();
  return `entity:${uuid||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;
}
function hash(seed,x,y,n){
  let h=(Number(seed)||1)>>>0;
  for(const value of [Math.round(x),Math.round(y),Math.round(n)]){
    h=Math.imul(h^(value|0),0x45d9f3b);h^=h>>>16;
  }
  return h>>>0;
}
function unit(h){return(h>>>0)/4294967295;}
function nextStep(current,steps){
  const value=Number(current)||steps[0],index=steps.findIndex(step=>Math.abs(step-value)<.001);
  return steps[(index>=0?index+1:0)%steps.length];
}
function normalizeSettings(input={}){
  return {
    spacing:clamp(input.spacing,24,256,72),
    density:clamp(input.density,.35,2.5,1),
    radius:clamp(input.radius,0,320,96),
    snap:clamp(input.snap,1,128,16),
    seed:Math.max(1,Math.round(Number(input.seed)||17)),
    minSpacing:clamp(input.minSpacing,0,256,18),
    avoidOverlap:input.avoidOverlap!==false,
    avoidCollisions:input.avoidCollisions!==false,
    collisionClearance:clamp(input.collisionClearance,0,128,8),
    smartContext:input.smartContext!==false,
    strictAffinity:input.strictAffinity!==false,
    roadClearance:clamp(input.roadClearance,0,192,32),
    roadAffinity:clamp(input.roadAffinity,16,256,96),
    waterClearance:clamp(input.waterClearance,0,192,8),
    waterAffinity:clamp(input.waterAffinity,16,256,96),
    buildingAffinity:clamp(input.buildingAffinity,16,256,88),
    blockedZoneTags:Array.isArray(input.blockedZoneTags)?input.blockedZoneTags.map(v=>String(v).toLowerCase()).filter(Boolean):[...DEFAULT_BLOCKED_ZONE_TAGS],
    exclusions:Array.isArray(input.exclusions)?input.exclusions.map(rectFrom).filter(Boolean):[],
    semanticPreset:normalizeSemanticPreset(input.semanticPreset||'balanced'),
    maxPreview:Math.max(8,Math.min(MAX_PREVIEW,Math.round(Number(input.maxPreview)||120)))
  };
}

export function createLibraryPaletteBrushTool(kernel,{root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_LIBRARY_PALETTE_KERNEL_REQUIRED');
  let palette=[],settings=normalizeSettings(),active=false,stroke=null,committing=false,unregisterInput=null;
  let panel=null,bodyObserver=null,keyHandler=null,destroyed=false;
  const listeners=new Set(),EMPTY=Object.freeze([]);

  function effectiveSpacing(){return Math.max(8,settings.spacing/settings.density);}
  function state(){
    return{
      active,committing,paletteCount:palette.length,previewCount:stroke?.rows?.length||0,
      settings:{...settings,blockedZoneTags:[...settings.blockedZoneTags],exclusions:settings.exclusions.map(copy)},
      seed:settings.seed,roles:semanticRoleCounts(palette),semanticPreset:settings.semanticPreset,
      rejected:stroke?.rejected?{...stroke.rejected}:null
    };
  }
  function emit(){const snapshot=state();for(const fn of listeners)try{fn(snapshot);}catch{}syncUi();}
  function resolvePalette(entries=[]){
    const out=[],seen=new Set();
    for(const raw of Array.isArray(entries)?entries:[]){
      const source=typeof raw==='string'?{id:raw}:(raw||{}),id=String(source.id||'');
      if(!id||seen.has(id))continue;
      const prefab=kernel.prefabs.resolve(id);if(!prefab)continue;
      const semantic=buildSemanticDescriptor({...prefab,...source,id});
      seen.add(id);
      out.push({...semantic,bounds:{w:Math.max(1,Number(prefab.bounds?.w)||32),h:Math.max(1,Number(prefab.bounds?.h)||32)}});
      if(out.length>=MAX_PALETTE)break;
    }
    return out;
  }
  function configurePalette(entries,{activate=true,...patch}={}){
    if(destroyed)destroyed=false;
    const next=resolvePalette(entries);
    if(!next.length)throw new Error('STUDIO_LIBRARY_PALETTE_EMPTY');
    palette=next;settings=normalizeSettings({...settings,...patch});stroke=null;
    ensureUi();if(activate!==false)start();emit();return state();
  }
  function configure(patch={}){settings=normalizeSettings({...settings,...patch});stroke=null;emit();return state();}
  function setSemanticPreset(value){settings=normalizeSettings({...settings,semanticPreset:value});stroke=null;emit();return settings.semanticPreset;}
  function cycleSemanticPreset(){
    const index=SEMANTIC_PRESETS.indexOf(settings.semanticPreset);
    return setSemanticPreset(SEMANTIC_PRESETS[(index+1)%SEMANTIC_PRESETS.length]);
  }
  function cycleDensity(){settings=normalizeSettings({...settings,density:nextStep(settings.density,DENSITY_STEPS)});stroke=null;emit();return settings.density;}
  function cycleRadius(){settings=normalizeSettings({...settings,radius:nextStep(settings.radius,RADIUS_STEPS)});stroke=null;emit();return settings.radius;}
  function toggleSmartContext(){settings=normalizeSettings({...settings,smartContext:!settings.smartContext});stroke=null;emit();notify(`Reglas ${settings.smartContext?'ON':'OFF'}`);return settings.smartContext;}
  function weightedItem(h,context=null){
    let total=0;const weighted=[];
    for(const item of palette){
      const semanticWeight=applySemanticPreset(item,settings.semanticPreset),contextWeight=stroke?.contextResolver?.roleWeightMultiplier?.(item.role,context)||1,weight=semanticWeight*contextWeight;
      if(!(weight>0))continue;
      weighted.push([item,weight]);total+=weight;
    }
    if(!weighted.length||!(total>0))return null;
    let cursor=unit(h)*total;
    for(const [item,weight] of weighted){cursor-=weight;if(cursor<=0)return item;}
    return weighted[weighted.length-1][0];
  }
  function pick(x,y,index){
    const h=hash(settings.seed,x,y,index),context=stroke?.contextResolver?.contextAt?.(x,y)||null,item=weightedItem(h,context);
    if(!item)return null;
    const j1=unit(hash(h,x+17,y-31,index+11))*2-1,j2=unit(hash(h,y+47,x-13,index+29))*2-1;
    const radius=settings.radius*item.radiusScale;
    const sx=Math.round((num(x)+j1*radius)/settings.snap)*settings.snap;
    const sy=Math.round((num(y)+j2*radius)/settings.snap)*settings.snap;
    const scaleUnit=unit(hash(h,x+71,y-53,index+43));
    const lo=Math.min(item.scaleMin,item.scaleMax),hi=Math.max(item.scaleMin,item.scaleMax);
    const scale=Math.round((lo+(hi-lo)*scaleUnit)*100)/100;
    const rotations=item.rotations?.length?item.rotations:[0];
    const rotation=rotations[hash(h,x-19,y+83,index+61)%rotations.length]||0;
    return{item,x:sx,y:sy,scale,rotation};
  }
  function snapshotConstraints(){
    const collisions=[];
    if(settings.avoidCollisions){
      for(const row of Object.values(kernel.document.navigation?.collisions||{})){
        const rect=rectFrom(row);if(rect)collisions.push(expandRect(rect,settings.collisionClearance));
      }
    }
    const blockedZones=[];
    const wanted=new Set(settings.blockedZoneTags);
    if(wanted.size){
      for(const zone of kernel.document.zones||[]){
        if(!tagsOf(zone).some(tag=>wanted.has(tag)))continue;
        const rect=rectFrom(zone);if(rect)blockedZones.push(rect);
      }
    }
    return{collisions,blockedZones,exclusions:settings.exclusions.map(copy)};
  }
  function existingOverlap(rect){
    if(!settings.avoidOverlap)return false;
    try{return kernel.spatial.queryRect(rect,{category:'entity'}).length>0;}catch{return false;}
  }
  function generatedOverlap(rect,rows){
    if(!settings.avoidOverlap)return false;
    for(const row of rows){
      const scale=Math.max(.1,Number(row.transform?.scale)||1);
      const other={x:num(row.transform?.x),y:num(row.transform?.y),w:Math.max(1,(Number(row.bounds?.w)||1)*scale),h:Math.max(1,(Number(row.bounds?.h)||1)*scale)};
      if(rectIntersects(rect,other))return true;
    }
    return false;
  }
  function tooClose(rect,item,rows){
    const min=settings.minSpacing*item.spacingScale;if(min<=0)return false;
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2;
    for(const row of rows){
      const scale=Math.max(.1,Number(row.transform?.scale)||1),ox=num(row.transform?.x)+(Number(row.bounds?.w)||1)*scale/2,oy=num(row.transform?.y)+(Number(row.bounds?.h)||1)*scale/2;
      if(Math.hypot(cx-ox,cy-oy)<min)return true;
    }
    return false;
  }
  function constraintReason(rect,item,rows){
    for(const exclusion of stroke?.constraints?.exclusions||[])if(rectIntersects(rect,exclusion))return'exclusion';
    for(const collision of stroke?.constraints?.collisions||[])if(rectIntersects(rect,collision))return'collision';
    for(const zone of stroke?.constraints?.blockedZones||[])if(rectIntersects(rect,zone))return'zone';
    const semanticReason=stroke?.contextResolver?.rejectReason?.(item,rect);if(semanticReason)return semanticReason;
    if(existingOverlap(rect)||generatedOverlap(rect,rows))return'overlap';
    if(tooClose(rect,item,rows))return'spacing';
    return null;
  }
  function addStamp(x,y){
    if(!stroke||!palette.length||stroke.rows.length>=settings.maxPreview)return false;
    const chosen=pick(x,y,stroke.index++);if(!chosen)return false;
    const {item}=chosen,rect={x:chosen.x,y:chosen.y,w:item.bounds.w*chosen.scale,h:item.bounds.h*chosen.scale};
    const cell=`${Math.round(chosen.x/settings.snap)}:${Math.round(chosen.y/settings.snap)}`;
    if(stroke.cells.has(cell)){stroke.rejected.spacing++;return false;}
    const reason=constraintReason(rect,item,stroke.rows);
    if(reason){stroke.rejected[reason]=(stroke.rejected[reason]||0)+1;return false;}
    stroke.cells.add(cell);
    stroke.rows.push({
      id:newId(),prefabId:item.id,
      transform:{x:chosen.x,y:chosen.y,rotation:chosen.rotation,scale:chosen.scale},
      bounds:{...item.bounds},components:{}
    });
    return true;
  }
  function beginAt(x,y){
    if(!active||!palette.length||committing)return null;
    const contextResolver=createSemanticContextResolver(kernel,{enabled:settings.smartContext,strictAffinity:settings.strictAffinity,roadClearance:settings.roadClearance,roadAffinity:settings.roadAffinity,waterClearance:settings.waterClearance,waterAffinity:settings.waterAffinity,buildingAffinity:settings.buildingAffinity});
    stroke={
      rows:[],cells:new Set(),index:0,last:{x:num(x),y:num(y)},distance:0,
      constraints:snapshotConstraints(),contextResolver,
      rejected:{collision:0,zone:0,exclusion:0,overlap:0,spacing:0,road:0,water:0,district:0,'road-affinity':0,'water-affinity':0}
    };
    addStamp(x,y);emit();return state();
  }
  function strokeTo(x,y){
    if(!active||!stroke||committing)return null;
    const end={x:num(x),y:num(y)},start=stroke.last,dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    if(length<.5)return state();
    const ux=dx/length,uy=dy/length,step=effectiveSpacing();
    let travel=Math.max(1,step-stroke.distance);
    while(travel<=length&&stroke.rows.length<settings.maxPreview){addStamp(start.x+ux*travel,start.y+uy*travel);travel+=step;}
    stroke.distance=Math.max(0,(stroke.distance+length)%step);stroke.last=end;emit();return state();
  }
  async function commit(){
    if(!stroke)throw new Error('STUDIO_LIBRARY_PALETTE_STROKE_REQUIRED');
    const rows=stroke.rows.map(copy);stroke=null;
    if(!rows.length){emit();return[];}
    committing=true;emit();
    try{
      const commands=rows.map(createPlaceEntityCommand);
      const command=commands.length===1?commands[0]:createCompositeCommand(commands,{type:'entity.batch.library-semantic-brush',label:`Semantic Brush · ${rows.length} objects`});
      await kernel.execute(command);kernel.selection.set(rows.map(row=>row.id));return rows;
    }finally{committing=false;emit();}
  }
  function cancelStroke(){stroke=null;emit();}
  function ensureInput(){
    if(unregisterInput)return;
    unregisterInput=kernel.input.register(INPUT_CONTEXT,{
      pointerdown:event=>{if(!active)return false;beginAt(event.worldX,event.worldY);return true;},
      pointermove:event=>{if(!active)return false;if(stroke)strokeTo(event.worldX,event.worldY);return true;},
      pointerup:event=>{if(!active)return false;if(stroke&&!committing)void commit().catch(error=>notify(error?.message||error));return true;},
      pointercancel:()=>{if(!active)return false;cancelStroke();return true;}
    },1300);
  }
  function notify(message){if(typeof root?.showToast==='function')root.showToast(String(message));else console.info('[Kelo Semantic Brush]',message);}
  function start(){
    if(active)return true;if(!palette.length)throw new Error('STUDIO_LIBRARY_PALETTE_EMPTY');
    ensureInput();kernel.input.push(INPUT_CONTEXT);active=true;
    try{root.KELO_LIBRARY_PALETTE_ACTIVE=true;root.KELO_SEMANTIC_BRUSH_ACTIVE=true;}catch{}
    ensureUi();emit();
    notify(`Semantic Brush · ${palette.length} variantes · ${semanticPresetLabel(settings.semanticPreset)}`);
    return true;
  }
  function stop(){
    kernel.input.pop(INPUT_CONTEXT);active=false;stroke=null;
    try{root.KELO_LIBRARY_PALETTE_ACTIVE=false;root.KELO_SEMANTIC_BRUSH_ACTIVE=false;}catch{}
    emit();return false;
  }
  function remix(){settings=normalizeSettings({...settings,seed:settings.seed+1});stroke=null;emit();notify(`Seed #${settings.seed}`);return settings.seed;}

  function css(doc){
    if(doc.getElementById('kelo-library-palette-style'))return;
    const style=doc.createElement('style');style.id='kelo-library-palette-style';style.dataset.keloStudioUi='1';style.textContent=`
    #kelo-studio-live .ks-library-palette{position:fixed;left:50%;bottom:max(82px,calc(env(safe-area-inset-bottom) + 68px));transform:translateX(-50%);z-index:2147482255;width:min(760px,calc(100vw - 16px));display:flex;align-items:center;gap:6px;padding:8px;border:1px solid rgba(126,213,154,.46);border-radius:16px;background:rgba(5,18,15,.96);box-shadow:0 18px 60px rgba(0,0,0,.56);pointer-events:auto;color:#eaffef;overflow-x:auto;overscroll-behavior:contain}
    .ks-library-palette .klp-info{min-width:132px;flex:1;display:grid;gap:2px}.ks-library-palette b{font-size:10px;letter-spacing:.08em;color:#bff3ca}.ks-library-palette small{font-size:8px;color:#8fb39a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ks-library-palette button{flex:0 0 auto;min-height:36px;padding:0 9px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#10241c;color:#ecfff2;font-size:8px;font-weight:900}.ks-library-palette button[data-klp=mode]{border-color:rgba(126,213,154,.42);color:#caffd9}.ks-library-palette button[data-klp=stop]{border-color:rgba(255,137,110,.32);color:#ffd1c6}
    @media(max-width:520px){#kelo-studio-live .ks-library-palette{bottom:max(76px,calc(env(safe-area-inset-bottom) + 62px));gap:4px;padding:7px}.ks-library-palette .klp-info{min-width:112px}.ks-library-palette button{padding:0 8px;min-height:34px}.ks-library-palette small{max-width:116px}}`;
    doc.head.appendChild(style);
  }
  function ensureUi(){
    const doc=root?.document,shell=doc?.getElementById?.('kelo-studio-live');if(!doc?.body||!shell)return false;
    css(doc);if(panel?.isConnected)return true;
    panel=doc.createElement('section');panel.className='ks-library-palette';panel.dataset.keloStudioUi='1';
    panel.innerHTML='<div class="klp-info"><b>SEMANTIC BRUSH</b><small data-klp="status">Preparando…</small></div><button type="button" data-klp="density">DENS</button><button type="button" data-klp="radius">ÁREA</button><button type="button" data-klp="mode">MODO</button><button type="button" data-klp="context">REGLAS</button><button type="button" data-klp="mix">MEZCLA</button><button type="button" data-klp="stop">SALIR</button>';
    panel.addEventListener('click',event=>{
      const action=event.target?.closest?.('[data-klp]')?.dataset.klp;
      if(action==='density')cycleDensity();
      else if(action==='radius')cycleRadius();
      else if(action==='mode'){cycleSemanticPreset();notify(`Modo ${semanticPresetLabel(settings.semanticPreset)}`);}
      else if(action==='context')toggleSmartContext();
      else if(action==='mix')remix();
      else if(action==='stop')stop();
    });
    shell.appendChild(panel);syncUi();
    if(!bodyObserver&&typeof root.MutationObserver==='function'){
      bodyObserver=new root.MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes||[])if(node?.id==='kelo-studio-live'){destroy();return;}});
      bodyObserver.observe(doc.body,{childList:true});
    }
    if(!keyHandler){
      keyHandler=event=>{if(active&&event.key==='Escape'&&!event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();event.stopImmediatePropagation();stop();notify('Semantic Brush desactivado');}};
      doc.addEventListener('keydown',keyHandler,true);
    }
    return true;
  }
  function syncUi(){
    if(!panel?.isConnected)return;
    panel.hidden=!active;
    const counts=semanticRoleCounts(palette),parts=[];
    if(counts.canopy)parts.push(`C${counts.canopy}`);
    if(counts.understory)parts.push(`U${counts.understory}`);
    if(counts.detail)parts.push(`D${counts.detail}`);
    if(counts.structure)parts.push(`S${counts.structure}`);
    if(!parts.length&&counts.generic)parts.push(`G${counts.generic}`);
    const el=panel.querySelector('[data-klp="status"]');
    const contextButton=panel.querySelector('[data-klp="context"]');if(contextButton)contextButton.textContent=settings.smartContext?'REGLAS ON':'REGLAS OFF';
    if(el)el.textContent=committing?'Guardando gesto…':`${semanticPresetLabel(settings.semanticPreset)} · dens ${settings.density} · área ${settings.radius} · ${settings.smartContext?'CTX':'LIBRE'} · ${parts.join(' ')} · ${stroke?.rows?.length||0}/${settings.maxPreview}`;
  }
  function destroy(){
    if(destroyed)return;destroyed=true;try{stop();}catch{}
    unregisterInput?.();unregisterInput=null;bodyObserver?.disconnect();bodyObserver=null;
    if(keyHandler)root?.document?.removeEventListener?.('keydown',keyHandler,true);keyHandler=null;
    panel?.remove();panel=null;listeners.clear();
  }

  return Object.freeze({
    id:'libraryPaletteBrush',
    configurePalette,configure,setSemanticPreset,cycleSemanticPreset,cycleDensity,cycleRadius,toggleSmartContext,start,stop,remix,
    beginAt,strokeTo,commit,cancelStroke,state,destroy,
    getPalette:()=>palette.map(copy),
    getPreviewRefs:()=>stroke?.rows||EMPTY,
    getPreviews:()=>stroke?.rows.map(copy)||[],
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
}

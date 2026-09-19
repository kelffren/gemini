/* KELO-INDEX
 * area: STUDIO / LIBRARY PALETTE BRUSH
 * owner: Kelo Studio World Building
 * keys: BUILD PALETTE BRUSH MULTI ASSET ORGANIC STROKE DETERMINISTIC MOBILE UNDO AUTHORITY
 * owns: local multi-prefab brush previews and one-history-action stroke commits
 * does-not-own: downloads, asset integration, authority transport, world rendering or library selection
 * public-api: createLibraryPaletteBrushTool()
 * online: every stroke composes ordinary entity.place commands; authority remains Studio CommandBus mirror
 * mobile: bounded previews, one input context, direct-body shell observer only
 */

import {createPlaceEntityCommand} from '../document/document-commands.mjs';
import {createCompositeCommand} from '../document/composite-command.mjs';

const INPUT_CONTEXT='studio-library-palette-brush';
const MAX_PALETTE=24;
const MAX_PREVIEW=180;
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const clamp=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):fallback));
const num=v=>Number(v)||0;
function newId(){const uuid=globalThis.crypto?.randomUUID?.();return `entity:${uuid||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;}
function hash(seed,x,y,n){
  let h=(Number(seed)||1)>>>0;
  for(const value of [Math.round(x),Math.round(y),Math.round(n)]){
    h=Math.imul(h^(value|0),0x45d9f3b);h^=h>>>16;
  }
  return h>>>0;
}
function unit(h){return(h>>>0)/4294967295;}
function normalizeSettings(input={}){
  const spacing=clamp(input.spacing,24,256,72);
  return {
    spacing,
    jitter:clamp(input.jitter,0,1.2,.55),
    snap:clamp(input.snap,1,128,16),
    seed:Math.max(1,Math.round(Number(input.seed)||17)),
    avoidOverlap:input.avoidOverlap!==false,
    maxPreview:Math.max(8,Math.min(MAX_PREVIEW,Math.round(Number(input.maxPreview)||120)))
  };
}

export function createLibraryPaletteBrushTool(kernel,{root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_LIBRARY_PALETTE_KERNEL_REQUIRED');
  let palette=[],settings=normalizeSettings(),active=false,stroke=null,committing=false,unregisterInput=null;
  let panel=null,bodyObserver=null,keyHandler=null,destroyed=false;
  const listeners=new Set(),EMPTY=Object.freeze([]);

  function state(){return{active,committing,paletteCount:palette.length,previewCount:stroke?.rows?.length||0,settings:{...settings},seed:settings.seed};}
  function emit(){const snapshot=state();for(const fn of listeners)try{fn(snapshot);}catch{}syncUi();}
  function resolvePalette(ids=[]){
    const out=[],seen=new Set();
    for(const raw of ids){
      const id=String(raw||'');if(!id||seen.has(id))continue;
      const prefab=kernel.prefabs.resolve(id);if(!prefab)continue;
      seen.add(id);out.push({id,bounds:{w:Math.max(1,Number(prefab.bounds?.w)||32),h:Math.max(1,Number(prefab.bounds?.h)||32)}});
      if(out.length>=MAX_PALETTE)break;
    }
    return out;
  }
  function configurePalette(ids,{activate=true,...patch}={}){
    if(destroyed)destroyed=false;
    const next=resolvePalette(ids);
    if(!next.length)throw new Error('STUDIO_LIBRARY_PALETTE_EMPTY');
    palette=next;settings=normalizeSettings({...settings,...patch});stroke=null;ensureUi();if(activate!==false)start();emit();return state();
  }
  function configure(patch={}){settings=normalizeSettings({...settings,...patch});emit();return state();}
  function pick(x,y,index){
    const h=hash(settings.seed,x,y,index),item=palette[h%palette.length];
    const j1=unit(hash(h,x+17,y-31,index+11))*2-1,j2=unit(hash(h,y+47,x-13,index+29))*2-1;
    const radius=settings.spacing*settings.jitter;
    const sx=Math.round((num(x)+j1*radius)/settings.snap)*settings.snap;
    const sy=Math.round((num(y)+j2*radius)/settings.snap)*settings.snap;
    return{item,x:sx,y:sy};
  }
  function overlaps(rect,rows){
    if(!settings.avoidOverlap)return false;
    const margin=Math.max(2,Math.min(18,settings.spacing*.12));
    const q={x:rect.x+margin,y:rect.y+margin,w:Math.max(1,rect.w-margin*2),h:Math.max(1,rect.h-margin*2)};
    try{if(kernel.spatial.queryRect(q,{category:'entity'}).length)return true;}catch{}
    for(const row of rows){
      const r={x:num(row.transform?.x),y:num(row.transform?.y),w:Math.max(1,Number(row.bounds?.w)||1),h:Math.max(1,Number(row.bounds?.h)||1)};
      if(q.x<r.x+r.w&&q.x+q.w>r.x&&q.y<r.y+r.h&&q.y+q.h>r.y)return true;
    }
    return false;
  }
  function addStamp(x,y){
    if(!stroke||!palette.length||stroke.rows.length>=settings.maxPreview)return false;
    const chosen=pick(x,y,stroke.index++),item=chosen.item,rect={x:chosen.x,y:chosen.y,w:item.bounds.w,h:item.bounds.h};
    const cell=`${Math.round(chosen.x/settings.snap)}:${Math.round(chosen.y/settings.snap)}`;
    if(stroke.cells.has(cell)||overlaps(rect,stroke.rows))return false;
    stroke.cells.add(cell);
    stroke.rows.push({id:newId(),prefabId:item.id,transform:{x:chosen.x,y:chosen.y,rotation:0},bounds:{...item.bounds},components:{}});
    return true;
  }
  function beginAt(x,y){
    if(!active||!palette.length||committing)return null;
    stroke={rows:[],cells:new Set(),index:0,last:{x:num(x),y:num(y)},distance:0};
    addStamp(x,y);emit();return state();
  }
  function strokeTo(x,y){
    if(!active||!stroke||committing)return null;
    const end={x:num(x),y:num(y)},start=stroke.last,dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    if(length<.5)return state();
    const ux=dx/length,uy=dy/length;
    let travel=Math.max(1,settings.spacing-stroke.distance);
    while(travel<=length&&stroke.rows.length<settings.maxPreview){addStamp(start.x+ux*travel,start.y+uy*travel);travel+=settings.spacing;}
    stroke.distance=Math.max(0,(stroke.distance+length)%settings.spacing);stroke.last=end;emit();return state();
  }
  async function commit(){
    if(!stroke)throw new Error('STUDIO_LIBRARY_PALETTE_STROKE_REQUIRED');
    const rows=stroke.rows.map(copy);stroke=null;
    if(!rows.length){emit();return[];}
    committing=true;emit();
    try{
      const commands=rows.map(createPlaceEntityCommand);
      const command=commands.length===1?commands[0]:createCompositeCommand(commands,{type:'entity.batch.library-palette',label:`Build Palette · ${rows.length} objects`});
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
  function notify(message){if(typeof root?.showToast==='function')root.showToast(String(message));else console.info('[Kelo Build Palette]',message);}
  function start(){
    if(active)return true;if(!palette.length)throw new Error('STUDIO_LIBRARY_PALETTE_EMPTY');
    ensureInput();kernel.input.push(INPUT_CONTEXT);active=true;try{root.KELO_LIBRARY_PALETTE_ACTIVE=true;}catch{}ensureUi();emit();notify(`Build Palette activo · ${palette.length} variantes · arrastra para pintar`);return true;
  }
  function stop(){kernel.input.pop(INPUT_CONTEXT);active=false;stroke=null;try{root.KELO_LIBRARY_PALETTE_ACTIVE=false;}catch{}emit();return false;}
  function remix(){settings=normalizeSettings({...settings,seed:settings.seed+1});stroke=null;emit();notify(`Mezcla #${settings.seed}`);return settings.seed;}

  function css(doc){
    if(doc.getElementById('kelo-library-palette-style'))return;
    const style=doc.createElement('style');style.id='kelo-library-palette-style';style.dataset.keloStudioUi='1';style.textContent=`
    #kelo-studio-live .ks-library-palette{position:fixed;left:50%;bottom:max(82px,calc(env(safe-area-inset-bottom) + 68px));transform:translateX(-50%);z-index:2147482255;width:min(620px,calc(100vw - 16px));display:flex;align-items:center;gap:6px;padding:8px;border:1px solid rgba(126,213,154,.46);border-radius:16px;background:rgba(5,18,15,.96);box-shadow:0 18px 60px rgba(0,0,0,.56);pointer-events:auto;color:#eaffef}
    .ks-library-palette .klp-info{min-width:0;flex:1;display:grid;gap:2px}.ks-library-palette b{font-size:10px;letter-spacing:.08em;color:#bff3ca}.ks-library-palette small{font-size:8px;color:#8fb39a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ks-library-palette button{min-height:36px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#10241c;color:#ecfff2;font-size:8px;font-weight:900}.ks-library-palette button[data-klp=stop]{border-color:rgba(255,137,110,.32);color:#ffd1c6}
    @media(max-width:520px){#kelo-studio-live .ks-library-palette{bottom:max(76px,calc(env(safe-area-inset-bottom) + 62px));gap:4px;padding:7px}.ks-library-palette button{padding:0 8px;min-height:34px}.ks-library-palette small{max-width:118px}}`;
    doc.head.appendChild(style);
  }
  function ensureUi(){
    const doc=root?.document,shell=doc?.getElementById?.('kelo-studio-live');if(!doc?.body||!shell)return false;
    css(doc);
    if(panel?.isConnected)return true;
    panel=doc.createElement('section');panel.className='ks-library-palette';panel.dataset.keloStudioUi='1';panel.innerHTML='<div class="klp-info"><b>BUILD PALETTE</b><small data-klp="status">Preparando…</small></div><button type="button" data-klp="less">− DENS</button><button type="button" data-klp="more">+ DENS</button><button type="button" data-klp="mix">MEZCLAR</button><button type="button" data-klp="stop">SALIR</button>';
    panel.addEventListener('click',event=>{const action=event.target?.closest?.('[data-klp]')?.dataset.klp;if(action==='less')configure({spacing:settings.spacing+12});else if(action==='more')configure({spacing:settings.spacing-12});else if(action==='mix')remix();else if(action==='stop')stop();});
    shell.appendChild(panel);syncUi();
    if(!bodyObserver&&typeof root.MutationObserver==='function'){
      bodyObserver=new root.MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes||[])if(node?.id==='kelo-studio-live'){destroy();return;}});
      bodyObserver.observe(doc.body,{childList:true});
    }
    if(!keyHandler){keyHandler=event=>{if(active&&event.key==='Escape'&&!event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();event.stopImmediatePropagation();stop();notify('Build Palette desactivado');}};doc.addEventListener('keydown',keyHandler,true);}
    return true;
  }
  function syncUi(){
    if(!panel?.isConnected)return;
    panel.hidden=!active;
    const el=panel.querySelector('[data-klp="status"]');if(el)el.textContent=committing?'Guardando gesto…':`${palette.length} variantes · densidad ${Math.round(10000/settings.spacing)/100} · preview ${stroke?.rows?.length||0}/${settings.maxPreview}`;
  }
  function destroy(){
    if(destroyed)return;destroyed=true;try{stop();}catch{}unregisterInput?.();unregisterInput=null;bodyObserver?.disconnect();bodyObserver=null;if(keyHandler)root?.document?.removeEventListener?.('keydown',keyHandler,true);keyHandler=null;panel?.remove();panel=null;listeners.clear();
  }

  return Object.freeze({
    id:'libraryPaletteBrush',configurePalette,configure,start,stop,remix,beginAt,strokeTo,commit,cancelStroke,state,destroy,
    getPreviewRefs:()=>stroke?.rows||EMPTY,
    getPreviews:()=>stroke?.rows.map(copy)||[],
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
}

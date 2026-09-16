/* KELO-INDEX
 * area: STUDIO / PAINT COPIES TOOL
 * owner: Kelo Studio Paint Copies
 * keys: STUDIO PAINT COPIES SCENE PATTERN GRID RING SCATTER TRAIL MOBILE UNDO AUTHORITY
 * owns: local copy-pattern preview, pattern planning, Studio input takeover and one-history-action batch commit
 * does-not-own: camera math, world renderer, document persistence or authority transport
 * public-api: createPaintCopiesTool()
 * online: every gesture resolves to ordinary place-entity commands inside one CompositeCommand; server migration only swaps authority transport
 * mobile: DOM lifecycle watches only direct body children; shell subtree observation exists only until the toolbar mount point appears
 */

import { createPlaceEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const MAX_PREVIEW_ENTITIES = 500;
const INPUT_CONTEXT = 'studio-paint-copies';
const EMPTY_PREVIEWS = Object.freeze([]);
const PATTERNS = new Set(['trail','grid','ring','scatter']);
const DEFAULT_SETTINGS = Object.freeze({
  pattern:'trail',spacing:'auto',snap:null,
  columns:4,rows:3,
  ringCount:8,radius:96,
  scatterCount:18,scatterRadius:128,seed:17
});
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const num = value => Number(value) || 0;
const clampInt = (value,min,max,fallback) => Math.max(min,Math.min(max,Math.round(Number.isFinite(Number(value))?Number(value):fallback)));
const clampNum = (value,min,max,fallback) => Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
function newId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;
}
function seededRandom(seed=1){
  let a=(Number(seed)||1)>>>0;
  return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function normalizedSettings(input={}){
  const pattern=PATTERNS.has(String(input.pattern))?String(input.pattern):DEFAULT_SETTINGS.pattern;
  const spacing=input.spacing==='auto'?'auto':clampNum(input.spacing,1,2048,32);
  const snap=input.snap==null?null:clampNum(input.snap,1,512,32);
  return {
    pattern,spacing,snap,
    columns:clampInt(input.columns,1,12,DEFAULT_SETTINGS.columns),
    rows:clampInt(input.rows,1,12,DEFAULT_SETTINGS.rows),
    ringCount:clampInt(input.ringCount,3,64,DEFAULT_SETTINGS.ringCount),
    radius:clampNum(input.radius,8,2048,DEFAULT_SETTINGS.radius),
    scatterCount:clampInt(input.scatterCount,1,100,DEFAULT_SETTINGS.scatterCount),
    scatterRadius:clampNum(input.scatterRadius,8,2048,DEFAULT_SETTINGS.scatterRadius),
    seed:clampInt(input.seed,1,2147483647,DEFAULT_SETTINGS.seed)
  };
}

export function createPaintCopiesTool(kernel) {
  if (!kernel) throw new Error('STUDIO_PAINT_COPIES_KERNEL_REQUIRED');

  let template = null;
  let stroke = null;
  let enabled = false;
  let committing = false;
  let unregisterInput = null;
  let selectionUnsub = null;
  const pointers = new Set();
  const listeners = new Set();
  let settings=normalizedSettings(DEFAULT_SETTINGS);

  // UI lifecycle is explicit and bounded: never observe the whole DOM subtree after mount.
  let button=null,panel=null,bodyObserver=null,shellObserver=null,uiShell=null,onKey=null,onShellChange=null;

  const selectedEntities = () => kernel.selection.get().map(id => kernel.document.entities.find(e => String(e.id) === String(id))).filter(Boolean);
  const entitySize = row => {
    const spatial = kernel.spatial.get(row.id)?.rect;
    const scale = Math.max(.1, Number(row.transform?.scale) || 1);
    return {
      w: Math.max(1, Number(spatial?.w) || (Number(row.bounds?.w) || 1) * scale),
      h: Math.max(1, Number(spatial?.h) || (Number(row.bounds?.h) || 1) * scale)
    };
  };
  const currentSnap = () => Math.max(1,Number(settings.snap)||Number(kernel.document.settings?.tileSize)||32);
  const notify = message => {
    if (typeof globalThis.showToast === 'function') globalThis.showToast(message);
    else if (typeof console !== 'undefined') console.info('[Kelo Studio]', message);
  };
  const emit = () => {
    const snapshot=state();
    for(const listener of listeners){try{listener(snapshot);}catch{}}
  };

  function start({ spacing = settings.spacing, snap = currentSnap() } = {}) {
    const rows = selectedEntities();
    if (!rows.length) throw new Error('STUDIO_PAINT_COPIES_SELECTION_REQUIRED');
    const rects = rows.map(row => {
      const size = entitySize(row);
      return { row, x: num(row.transform?.x), y: num(row.transform?.y), ...size };
    });
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tile = Math.max(1, Number(snap) || 32);
    const footprint = { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    const autoSpacing = Math.max(tile, Math.min(footprint.w, footprint.h));
    const resolvedSpacing = spacing === 'auto' ? autoSpacing : Math.max(1, Number(spacing) || autoSpacing);

    template = {
      spacing: resolvedSpacing,
      snap: tile,
      footprint,
      rows: rects.map(({ row }) => {
        const clone = copy(row);
        if (clone.source) clone.source = { ...clone.source, authorityPlacementId: undefined };
        return {
          source: clone,
          offsetX: num(row.transform?.x) - centerX,
          offsetY: num(row.transform?.y) - centerY
        };
      })
    };
    stroke = null;
    emit();
    return state();
  }

  function newStroke(x,y,{snap=currentSnap(),spacing=template?.spacing||32}={}){
    return {
      active:true,
      spacing:Math.max(1,Number(spacing)||template?.spacing||32),
      snap:Math.max(1,Number(snap)||1),
      lastInput:{x:num(x),y:num(y)},
      distanceUntilNext:Math.max(1,Number(spacing)||template?.spacing||32),
      previews:[],keys:new Set(),stamps:0,capped:false,anchorKey:null
    };
  }

  function addStamp(x, y, snap = template?.snap || 32) {
    if (!template || !stroke) return false;
    const s = Math.max(1, Number(snap) || 1);
    const cx = Math.round(num(x) / s) * s;
    const cy = Math.round(num(y) / s) * s;
    const key = `${cx}:${cy}`;
    if (stroke.keys.has(key)) return false;
    if ((stroke.stamps + 1) * template.rows.length > MAX_PREVIEW_ENTITIES) {
      stroke.capped = true;
      return false;
    }
    stroke.keys.add(key);
    stroke.stamps++;
    for (const item of template.rows) {
      const row = copy(item.source);
      row.id = newId();
      row.transform = {
        ...(row.transform || {}),
        x: cx + item.offsetX,
        y: cy + item.offsetY
      };
      if (row.source) row.source = { ...row.source, authorityPlacementId: undefined };
      stroke.previews.push(row);
    }
    return true;
  }

  function rebuildPatternAt(x,y){
    if(!template||!stroke)return false;
    const s=stroke.snap;
    const cx=Math.round(num(x)/s)*s,cy=Math.round(num(y)/s)*s;
    const anchorKey=`${cx}:${cy}:${settings.pattern}:${settings.columns}:${settings.rows}:${settings.ringCount}:${settings.radius}:${settings.scatterCount}:${settings.scatterRadius}:${settings.seed}`;
    if(stroke.anchorKey===anchorKey)return false;
    stroke.anchorKey=anchorKey;
    stroke.lastInput={x:num(x),y:num(y)};
    stroke.previews=[];stroke.keys=new Set();stroke.stamps=0;stroke.capped=false;
    const pattern=settings.pattern;
    if(pattern==='grid'){
      const stepX=Math.max(template.footprint.w,template.spacing);
      const stepY=Math.max(template.footprint.h,template.spacing);
      const ox=cx-((settings.columns-1)*stepX)/2;
      const oy=cy-((settings.rows-1)*stepY)/2;
      for(let row=0;row<settings.rows&&!stroke.capped;row++)for(let col=0;col<settings.columns&&!stroke.capped;col++)addStamp(ox+col*stepX,oy+row*stepY,s);
    }else if(pattern==='ring'){
      for(let i=0;i<settings.ringCount&&!stroke.capped;i++){
        const angle=(Math.PI*2*i)/settings.ringCount;
        addStamp(cx+Math.cos(angle)*settings.radius,cy+Math.sin(angle)*settings.radius,s);
      }
    }else if(pattern==='scatter'){
      const rnd=seededRandom(settings.seed);
      for(let i=0;i<settings.scatterCount&&!stroke.capped;i++){
        const angle=rnd()*Math.PI*2;
        const radius=Math.sqrt(rnd())*settings.scatterRadius;
        addStamp(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius,s);
      }
    }
    return true;
  }

  function beginAt(x, y, { snap = currentSnap(), spacing = template?.spacing } = {}) {
    if (!template) throw new Error('STUDIO_PAINT_COPIES_NOT_READY');
    stroke=newStroke(x,y,{snap,spacing});
    if(settings.pattern==='trail')addStamp(x,y,stroke.snap);
    else rebuildPatternAt(x,y);
    emit();
    return state();
  }

  function strokeTo(x, y, { snap = stroke?.snap || currentSnap() } = {}) {
    if (!stroke?.active || !template) return null;
    if(settings.pattern!=='trail'){
      stroke.snap=Math.max(1,Number(snap)||stroke.snap||1);
      rebuildPatternAt(x,y);
      return state();
    }
    const end = { x: num(x), y: num(y) };
    const startPoint = stroke.lastInput;
    const dx = end.x - startPoint.x;
    const dy = end.y - startPoint.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return state();
    const ux = dx / length;
    const uy = dy / length;
    let travel = stroke.distanceUntilNext;
    while (travel <= length + 1e-6 && !stroke.capped) {
      addStamp(startPoint.x + ux * travel, startPoint.y + uy * travel, snap);
      travel += stroke.spacing;
    }
    stroke.distanceUntilNext = Math.max(0.001, travel - length);
    stroke.lastInput = end;
    return state();
  }

  function cancelStroke() { stroke = null;emit(); }
  function cancel() { stroke = null; template = null;emit(); }

  async function commit() {
    if (!stroke?.active) throw new Error('STUDIO_PAINT_COPIES_STROKE_NOT_ACTIVE');
    const rows = stroke.previews.map(copy);
    const stampCount = stroke.stamps;
    const wasCapped = stroke.capped;
    const pattern=settings.pattern;
    stroke = null;
    if (!rows.length){emit();return { rows: [], stamps: 0, capped: wasCapped, pattern };}
    const commands = rows.map(row => createPlaceEntityCommand(row));
    if (commands.length === 1) await kernel.execute(commands[0]);
    else await kernel.execute(createCompositeCommand(commands, {
      type: 'entity.batch.paint-copies',
      label: `Scene Painter · ${pattern} · ${rows.length} object${rows.length === 1 ? '' : 's'}`
    }));
    kernel.selection.set(rows.map(row => row.id));
    emit();
    return { rows, stamps: stampCount, capped: wasCapped, pattern };
  }

  function configure(patch={}){
    const next=normalizedSettings({...settings,...patch});
    const changed=Object.keys(next).some(key=>next[key]!==settings[key]);
    settings=next;
    if(!changed)return state();
    if(template){
      const spacing=settings.spacing==='auto'?Math.max(template.snap,Math.min(template.footprint.w,template.footprint.h)):Math.max(1,Number(settings.spacing)||template.spacing);
      template={...template,spacing,snap:currentSnap()};
    }
    if(stroke?.active&&settings.pattern!=='trail')rebuildPatternAt(stroke.lastInput.x,stroke.lastInput.y);
    emit();
    return state();
  }

  function ensureInput() {
    if (unregisterInput) return;
    unregisterInput = kernel.input.register(INPUT_CONTEXT, {
      pointerdown: event => {
        if (!enabled) return false;
        pointers.add(event.pointerId ?? 'mouse');
        if (pointers.size > 1) { cancelStroke(); return true; }
        if (committing) return true;
        beginAt(event.worldX, event.worldY, { snap: currentSnap() });
        return true;
      },
      pointermove: event => {
        if (!enabled) return false;
        if (pointers.size > 1 || !stroke?.active || committing) return true;
        strokeTo(event.worldX, event.worldY, { snap: currentSnap() });
        return true;
      },
      pointerup: event => {
        if (!enabled) return false;
        pointers.delete(event.pointerId ?? 'mouse');
        if (pointers.size > 0 || !stroke?.active || committing) return true;
        committing = true;emit();
        void commit().then(result => {
          if (result?.capped) notify('Scene Painter limitado a 500 objetos por gesto');
        }).catch(error => notify(error?.message || String(error))).finally(() => {
          committing = false;emit();syncUi();
        });
        return true;
      },
      pointercancel: event => {
        pointers.delete(event.pointerId ?? 'mouse');
        cancelStroke();
        return enabled;
      }
    }, 1200);
  }

  function activate() {
    if (enabled) return true;
    try { start({ snap: currentSnap() }); }
    catch (error) {
      notify('Selecciona un objeto o grupo antes de usar SCENE PAINTER');
      syncUi();
      return false;
    }
    ensureInput();
    kernel.input.push(INPUT_CONTEXT);
    enabled = true;
    pointers.clear();
    try{globalThis.KELO_PAINT_COPIES_ENABLED=true;}catch{}
    emit();syncUi();
    const spacing = Math.round(template?.spacing || 0);
    notify(`Scene Painter activo · ${settings.pattern} · ${spacing}px`);
    return true;
  }

  function deactivate() {
    kernel.input.pop(INPUT_CONTEXT);
    pointers.clear();
    stroke=null;template=null;
    enabled = false;
    try{globalThis.KELO_PAINT_COPIES_ENABLED=false;}catch{}
    emit();syncUi();
    return false;
  }

  function toggle() { return enabled ? deactivate() : activate(); }

  function state() {
    return {
      ready: !!template,enabled,committing,active: !!stroke?.active,
      pattern:settings.pattern,settings:{...settings},
      spacing: template?.spacing || (settings.spacing==='auto'?null:settings.spacing),
      snap: stroke?.snap || template?.snap || currentSnap(),
      footprint: template?.footprint ? { ...template.footprint } : null,
      templateCount: template?.rows.length || 0,
      stamps: stroke?.stamps || 0,previewCount: stroke?.previews.length || 0,capped: !!stroke?.capped
    };
  }

  function makeUi(document){
    const host=document.createElement('section');
    host.className='ks-scene-painter';host.dataset.keloStudioUi='1';host.hidden=true;
    host.innerHTML=`
      <div class="ksp-head"><div><b>SCENE PAINTER</b><small>Duplica una selección como patrón</small></div><button type="button" data-ksp="close">×</button></div>
      <div class="ksp-patterns">
        <button type="button" data-pattern="trail">TRAIL</button><button type="button" data-pattern="grid">GRID</button><button type="button" data-pattern="ring">RING</button><button type="button" data-pattern="scatter">SCATTER</button>
      </div>
      <div class="ksp-fields">
        <label>Spacing <input data-setting="spacing" inputmode="decimal" placeholder="AUTO"></label>
        <label class="ksp-grid">Cols <input data-setting="columns" type="number" min="1" max="12"></label>
        <label class="ksp-grid">Rows <input data-setting="rows" type="number" min="1" max="12"></label>
        <label class="ksp-ring">Count <input data-setting="ringCount" type="number" min="3" max="64"></label>
        <label class="ksp-ring">Radius <input data-setting="radius" type="number" min="8" max="2048"></label>
        <label class="ksp-scatter">Count <input data-setting="scatterCount" type="number" min="1" max="100"></label>
        <label class="ksp-scatter">Radius <input data-setting="scatterRadius" type="number" min="8" max="2048"></label>
        <label class="ksp-scatter">Seed <input data-setting="seed" type="number" min="1"></label>
      </div>
      <div class="ksp-foot"><span data-ksp="status">Selecciona objetos</span><button type="button" data-ksp="toggle">START PAINT</button></div>`;
    return host;
  }

  function ensureUiStyle(document){
    if(document.getElementById('kelo-scene-painter-style'))return;
    const style=document.createElement('style');style.id='kelo-scene-painter-style';style.dataset.keloStudioUi='1';
    style.textContent=`
      #kelo-studio-live .ks-scene-painter{position:fixed;z-index:2147482250;left:50%;bottom:max(92px,calc(env(safe-area-inset-bottom) + 76px));transform:translateX(-50%);width:min(520px,calc(100vw - 20px));padding:12px;border:1px solid rgba(231,197,106,.44);border-radius:18px;background:rgba(6,15,17,.985);box-shadow:0 22px 70px rgba(0,0,0,.64);pointer-events:auto;color:#eaf2ed}
      #kelo-studio-live .ks-scene-painter[hidden]{display:none!important}.ksp-head{display:flex;align-items:center;gap:10px}.ksp-head>div{display:grid;gap:2px}.ksp-head b{font:900 11px Georgia,serif;letter-spacing:.09em;color:#efd47c}.ksp-head small{font-size:8px;color:#8fa59b}.ksp-head>button{margin-left:auto;min-width:38px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#101b1e;color:#fff;font-size:18px}.ksp-patterns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.ksp-patterns button,.ksp-foot button{min-height:38px;border:1px solid rgba(231,197,106,.22);border-radius:10px;background:#10201f;color:#dce8e2;font-size:8px;font-weight:900}.ksp-patterns button.on,.ksp-foot button.on{border-color:#e7c56a;background:#29493c;color:#fff1b8}.ksp-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.ksp-fields label{display:grid;gap:3px;font-size:7px;font-weight:850;color:#9fb3aa}.ksp-fields input{width:100%;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#0d1719;color:#fff;padding:0 8px;font-size:11px}.ksp-foot{display:flex;align-items:center;gap:8px;margin-top:10px}.ksp-foot span{flex:1;font-size:8px;color:#9fb3aa}.ksp-foot button{padding:0 14px}.ks-ext-edit [data-ext-paint-copies].on{border-color:#e7c56a!important;background:#29493c!important;color:#fff1b8!important}@media(max-width:520px){#kelo-studio-live .ks-scene-painter{bottom:max(84px,calc(env(safe-area-inset-bottom) + 68px));padding:10px}.ksp-fields{grid-template-columns:repeat(2,1fr)}.ksp-patterns button{font-size:7px;padding:0 4px}}`;
    document.head.appendChild(style);
  }

  function syncUi(){
    const hasSelection=selectedEntities().length>0;
    if(button?.isConnected){
      button.disabled=!enabled&&!hasSelection;
      button.classList.toggle('on',enabled);
      button.setAttribute('aria-pressed',enabled?'true':'false');
      button.innerHTML=enabled?'<span class="ks-ico">✣</span>PAINT ON':'<span class="ks-ico">✣</span>SCENE PAINTER';
      button.title=enabled?'Scene Painter activo':'Trail, Grid, Ring y Scatter desde tu selección';
    }
    if(!panel?.isConnected)return;
    panel.querySelectorAll('[data-pattern]').forEach(el=>el.classList.toggle('on',el.dataset.pattern===settings.pattern));
    panel.querySelectorAll('.ksp-grid').forEach(el=>el.hidden=settings.pattern!=='grid');
    panel.querySelectorAll('.ksp-ring').forEach(el=>el.hidden=settings.pattern!=='ring');
    panel.querySelectorAll('.ksp-scatter').forEach(el=>el.hidden=settings.pattern!=='scatter');
    const values={...settings,spacing:settings.spacing==='auto'?'':settings.spacing};
    panel.querySelectorAll('[data-setting]').forEach(input=>{const key=input.dataset.setting;if(globalThis.document?.activeElement!==input)input.value=values[key]??'';});
    const status=panel.querySelector('[data-ksp="status"]');
    if(status){
      const s=state();
      status.textContent=committing?'Guardando…':enabled?`${settings.pattern.toUpperCase()} · ${s.previewCount||0} preview · máx ${MAX_PREVIEW_ENTITIES}`:hasSelection?`${selectedEntities().length} seleccionado${selectedEntities().length===1?'':'s'} · listo`:'Selecciona uno o varios objetos';
    }
    const toggleButton=panel.querySelector('[data-ksp="toggle"]');
    if(toggleButton){toggleButton.disabled=!enabled&&!hasSelection;toggleButton.classList.toggle('on',enabled);toggleButton.textContent=enabled?'STOP PAINT':'START PAINT';}
  }

  function detachShellUi(){
    shellObserver?.disconnect();shellObserver=null;
    if(uiShell&&onShellChange)uiShell.removeEventListener('change',onShellChange,true);
    uiShell=null;onShellChange=null;
    button?.remove();button=null;
    panel?.remove();panel=null;
  }

  function installShellUi(){
    const document=globalThis.document;if(!document?.body)return false;
    const shell=document.getElementById('kelo-studio-live');
    if(!shell){detachShellUi();return false;}
    uiShell=shell;
    const editBar=shell.querySelector('.ks-ext-edit');
    if(!editBar){
      shellObserver?.disconnect();
      if(typeof globalThis.MutationObserver==='function'){
        shellObserver=new globalThis.MutationObserver(()=>{if(shell.querySelector('.ks-ext-edit')){shellObserver?.disconnect();shellObserver=null;installShellUi();}});
        shellObserver.observe(shell,{childList:true,subtree:true});
      }
      return false;
    }
    shellObserver?.disconnect();shellObserver=null;
    if(editBar.querySelector('[data-ext-paint-copies]')){
      button=editBar.querySelector('[data-ext-paint-copies]');
    }else{
      button=document.createElement('button');button.type='button';button.dataset.extPaintCopies='1';button.setAttribute('aria-pressed','false');
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(panel)panel.hidden=!panel.hidden;syncUi();});
      editBar.appendChild(button);
    }
    ensureUiStyle(document);
    if(!panel?.isConnected){
      panel=makeUi(document);shell.appendChild(panel);
      panel.addEventListener('click',event=>{
        const patternButton=event.target.closest('[data-pattern]');
        if(patternButton){configure({pattern:patternButton.dataset.pattern});return;}
        const action=event.target.closest('[data-ksp]')?.dataset.ksp;
        if(action==='close'){panel.hidden=true;return;}
        if(action==='toggle'){toggle();syncUi();return;}
      });
      panel.addEventListener('change',event=>{
        const input=event.target.closest('[data-setting]');if(!input)return;
        const key=input.dataset.setting;let value=input.value;
        if(key==='spacing')value=String(value).trim()===''?'auto':Number(value);
        else value=Number(value);
        configure({[key]:value});
      });
    }
    const snapControl=shell.querySelector('[data-ext="snap"]');
    if(snapControl)configure({snap:Number(snapControl.value)||currentSnap()});
    if(onShellChange)uiShell.removeEventListener('change',onShellChange,true);
    onShellChange=event=>{if(event.target?.matches?.('[data-ext="snap"]'))configure({snap:Number(event.target.value)||currentSnap()});};
    uiShell.addEventListener('change',onShellChange,true);
    syncUi();
    return true;
  }

  function installDomBridge(){
    const document=globalThis.document;
    if(!document?.body)return;
    ensureInput();
    selectionUnsub=kernel.selection.onChange(syncUi);
    onKey=event=>{
      if(!document.getElementById('kelo-studio-live'))return;
      const key=String(event.key||'').toLowerCase();
      if(enabled&&key==='escape'){event.preventDefault();event.stopImmediatePropagation();deactivate();notify('Scene Painter desactivado');}
      else if(key==='b'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();event.stopImmediatePropagation();toggle();}
    };
    document.addEventListener('keydown',onKey,true);
    installShellUi();
    if(typeof globalThis.MutationObserver==='function'){
      // The previous regression watched body+subtree. This observer intentionally sees only direct shell add/remove.
      bodyObserver=new globalThis.MutationObserver(records=>{
        let relevant=false;
        for(const record of records){
          for(const node of [...record.addedNodes,...record.removedNodes])if(node?.id==='kelo-studio-live'){relevant=true;break;}
          if(relevant)break;
        }
        if(!relevant)return;
        const shell=document.getElementById('kelo-studio-live');
        if(!shell){
          if(enabled)deactivate();
          detachShellUi();
          bodyObserver?.disconnect();bodyObserver=null;
          selectionUnsub?.();selectionUnsub=null;
          if(onKey)document.removeEventListener('keydown',onKey,true);onKey=null;
          unregisterInput?.();unregisterInput=null;
        }else installShellUi();
      });
      bodyObserver.observe(document.body,{childList:true});
    }
  }

  function destroy(){
    if(enabled)deactivate();
    bodyObserver?.disconnect();bodyObserver=null;shellObserver?.disconnect();shellObserver=null;
    selectionUnsub?.();selectionUnsub=null;
    if(onKey)globalThis.document?.removeEventListener?.('keydown',onKey,true);onKey=null;
    detachShellUi();
    unregisterInput?.();unregisterInput=null;
    listeners.clear();
  }

  installDomBridge();

  return Object.freeze({
    id: 'paintCopies',start,activate,deactivate,toggle,configure,beginAt,strokeTo,commit,cancelStroke,cancel,state,destroy,
    onChange(listener){if(typeof listener!=='function')return()=>{};listeners.add(listener);return()=>listeners.delete(listener);},
    getPreviews: () => stroke?.previews.map(copy) || [],
    getPreviewRefs: () => stroke?.previews || EMPTY_PREVIEWS
  });
}

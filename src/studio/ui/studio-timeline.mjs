/* KELO-INDEX
 * area: STUDIO / TIMELINE
 * owner: generic Studio timeline presentation
 * owns: timeline rendering, scrubbing and point/range selection only
 * does-not-own: domain documents, commands, playback, persistence or networking
 * reused-by: Animation first; VFX/Cinematic can register their own tracks later
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const css=`
.kst{height:100%;min-height:150px;display:grid;grid-template-rows:34px minmax(0,1fr);background:rgba(8,12,14,.97);border-top:1px solid rgba(231,197,106,.22);color:#eef2ed;font:10px/1.2 ui-sans-serif,system-ui;overflow:hidden}.kst-head{display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid rgba(255,255,255,.07)}.kst-head strong{letter-spacing:.12em;font-size:9px}.kst-time{margin-left:auto;color:#d6bd79;font-variant-numeric:tabular-nums}.kst-body{overflow:auto;min-height:0}.kst-row{display:grid;grid-template-columns:104px minmax(420px,1fr);min-height:31px;border-bottom:1px solid rgba(255,255,255,.045)}.kst-label{display:flex;align-items:center;padding:0 9px;color:#91a39b;font-size:8px;font-weight:850;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.06);position:sticky;left:0;background:#0b1113;z-index:2}.kst-lane{position:relative;min-height:31px;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(10% - 1px),rgba(255,255,255,.035) calc(10% - 1px),rgba(255,255,255,.035) 10%);cursor:crosshair}.kst-point{position:absolute;top:50%;width:10px;height:10px;border:1px solid #f4d787;background:#2c2415;transform:translate(-50%,-50%) rotate(45deg);border-radius:2px;cursor:pointer}.kst-range{position:absolute;top:9px;height:13px;min-width:5px;border:1px solid rgba(231,197,106,.62);background:rgba(231,197,106,.19);border-radius:5px;cursor:pointer}.kst-playhead{position:absolute;top:0;bottom:0;width:1px;background:#ffdb74;box-shadow:0 0 8px rgba(255,219,116,.65);pointer-events:none;z-index:1}.kst-empty{padding:14px;color:#718078}@media(max-width:700px){.kst{min-height:175px}.kst-row{grid-template-columns:78px minmax(520px,1fr)}.kst-label{font-size:7px;padding:0 6px}}
`;
function ensureStyle(doc){if(doc.getElementById('kelo-studio-timeline-style'))return;const style=doc.createElement('style');style.id='kelo-studio-timeline-style';style.textContent=css;doc.head.append(style);}
export function createStudioTimeline({host,duration=1,tracks=[],playhead=0,onScrub,onSelect}={}){
  const doc=host?.ownerDocument||globalThis.document;if(!doc||!host)throw new Error('STUDIO_TIMELINE_HOST_REQUIRED');ensureStyle(doc);
  const root=doc.createElement('section');root.className='kst';root.setAttribute('data-kelo-studio-ui','');
  root.innerHTML='<div class="kst-head"><strong>TIMELINE</strong><span class="kst-hint">tap / click to scrub</span><span class="kst-time">0.000s</span></div><div class="kst-body"></div>';
  host.append(root);const body=root.querySelector('.kst-body'),time=root.querySelector('.kst-time');let state={duration:Math.max(.001,Number(duration)||1),tracks:Array.isArray(tracks)?tracks:[],playhead:Math.max(0,Number(playhead)||0)};
  function pct(value){return `${clamp((Number(value)||0)/state.duration,0,1)*100}%`;}
  function scrubFrom(event,lane){const box=lane.getBoundingClientRect(),x=clamp(event.clientX-box.left,0,box.width),at=box.width?x/box.width*state.duration:0;state.playhead=at;renderPlayheads();onScrub?.(at);}
  function renderPlayheads(){for(const el of root.querySelectorAll('.kst-playhead'))el.style.left=pct(state.playhead);time.textContent=`${state.playhead.toFixed(3)}s / ${state.duration.toFixed(3)}s`;}
  function render(){body.replaceChildren();if(!state.tracks.length){const empty=doc.createElement('div');empty.className='kst-empty';empty.textContent='No tracks';body.append(empty);return;}
    for(const track of state.tracks){const row=doc.createElement('div');row.className='kst-row';row.dataset.track=String(track.id||'');const label=doc.createElement('div');label.className='kst-label';label.textContent=String(track.label||track.id||'TRACK');const lane=doc.createElement('div');lane.className='kst-lane';lane.addEventListener('pointerdown',event=>{if(event.target!==lane)return;scrubFrom(event,lane);});const head=doc.createElement('i');head.className='kst-playhead';lane.append(head);
      for(const item of track.items||[]){const start=Number(item.at??item.start)||0,end=Number(item.end);const isRange=Number.isFinite(end)&&end>start;const el=doc.createElement('button');el.type='button';el.className=isRange?'kst-range':'kst-point';el.dataset.item=String(item.id||item.label||'');el.title=String(item.label||item.id||track.id||'');el.style.left=pct(start);if(isRange)el.style.width=`${Math.max(.5,clamp((end-start)/state.duration,0,1)*100)}%`;el.addEventListener('click',event=>{event.stopPropagation();state.playhead=start;renderPlayheads();onSelect?.({trackId:track.id,item,at:start});});lane.append(el);}
      row.append(label,lane);body.append(row);
    }renderPlayheads();
  }
  function set(next={}){if(next.duration!=null)state.duration=Math.max(.001,Number(next.duration)||1);if(next.tracks)state.tracks=Array.isArray(next.tracks)?next.tracks:[];if(next.playhead!=null)state.playhead=clamp(Number(next.playhead)||0,0,state.duration);render();return api;}
  const api=Object.freeze({root,set,setPlayhead(value){state.playhead=clamp(Number(value)||0,0,state.duration);renderPlayheads();},get playhead(){return state.playhead;},get duration(){return state.duration;},destroy(){root.remove();}});render();return api;
}

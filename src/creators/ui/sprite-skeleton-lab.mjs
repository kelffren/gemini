/* KELO-INDEX
 * area: CREATORS / SPRITE FACTORY / SKELETON LAB
 * owner: mobile pose-authoring UI for Sprite AI V3.1+
 * purpose: edit provider-neutral Kelo biped joints and expose one safe request overlay for real-skeleton direction generation
 * consumes: pose-templates.mjs only; no provider credentials
 * does-not-own: network inference, generated pixels, compiler QA, gameplay state
 */
import {SPRITE_DIRECTIONS,SKELETON_SCHEMA,getPoseSequence} from '../sprite-compiler/pose-templates.mjs';

const LINKS=Object.freeze([
  ['head','neck'],['neck','leftShoulder'],['leftShoulder','leftElbow'],['leftElbow','leftHand'],
  ['neck','rightShoulder'],['rightShoulder','rightElbow'],['rightElbow','rightHand'],['neck','chest'],['chest','hips'],
  ['hips','leftHip'],['leftHip','leftKnee'],['leftKnee','leftFoot'],['hips','rightHip'],['rightHip','rightKnee'],['rightKnee','rightFoot']
]);
const PALETTE=['#ff4b4b','#ff9b45','#ffd84d','#b7ff55','#55ef95','#4de4ff','#5c91ff','#a475ff'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cloneFrames=action=>getPoseSequence(action).map(frame=>({schema:frame.schema||SKELETON_SCHEMA,name:frame.name,phase:frame.phase,keypoints:Object.fromEntries(Object.entries(frame.keypoints||{}).map(([name,p])=>[name,[Number(p[0]),Number(p[1])]]))}));
function node(doc,tag,props={},children=[]){const n=doc.createElement(tag);for(const[k,v]of Object.entries(props)){if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k==='html')n.innerHTML=v;else if(k==='checked')n.checked=!!v;else n[k]=v;}for(const child of children)if(child)n.append(child);return n;}

export function mountSpriteSkeletonLab({root=globalThis,shell,status={}}={}){
  if(!root.document||!shell)throw new Error('SPRITE_SKELETON_LAB_DOM_REQUIRED');
  const existing=shell.querySelector('[data-kelo-skeleton-lab]');if(existing&&existing.__keloApi)return existing.__keloApi;
  const doc=root.document,state={enabled:false,backendReady:Boolean(status.realSkeletonReady),direction:'S',action:'walk',frame:0,selectedJoint:null,referenceReady:false,frames:cloneFrames('walk')};
  const style=node(doc,'style',{textContent:`
[data-kelo-skeleton-lab]{border:1px solid #2d3440;background:linear-gradient(180deg,#111720,#0c1016);border-radius:17px;overflow:hidden;color:#f5f1e7}.ksl-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid #29303b}.ksl-head strong{font-size:12px}.ksl-state{margin-left:auto;font-size:9px;font-weight:950;border:1px solid #684f2a;border-radius:999px;padding:4px 7px;color:#e6c56f;background:#231b0e}.ksl-state.ok{border-color:#285b3b;color:#88dda8;background:#0d1d14}.ksl-body{padding:10px}.ksl-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ksl-select,.ksl-btn{min-width:0;border:1px solid #353d49;background:#0c1016;color:#fff;border-radius:10px;padding:9px;font:800 11px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ksl-btn{cursor:pointer}.ksl-btn.gold{background:#d0ad58;border-color:#d0ad58;color:#17130a}.ksl-toggle{grid-column:1/-1;display:flex;align-items:center;gap:9px;border:1px solid #303744;border-radius:11px;background:#0a0e14;padding:9px 10px;font-size:11px;font-weight:850}.ksl-toggle input{width:19px;height:19px}.ksl-canvas-wrap{position:relative;margin-top:9px;border:1px solid #2c3440;border-radius:13px;overflow:hidden;background:#05070a;touch-action:none}.ksl-canvas{display:block;width:100%;aspect-ratio:1/1;touch-action:none}.ksl-frames{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.ksl-frame{border:1px solid #333b47;background:#111720;color:#9ca5b2;border-radius:9px;padding:8px 4px;font-size:10px;font-weight:900}.ksl-frame.on{border-color:#c5a44e;color:#f5d982;background:#211b0e}.ksl-meta{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;margin-top:8px}.ksl-joint{font-size:10px;color:#929ba8}.ksl-note{margin-top:8px;color:#858e9b;font-size:10px;line-height:1.35}.ksl-actions{display:flex;gap:7px;margin-top:8px}.ksl-actions .ksl-btn{flex:1}@media(max-width:520px){.ksl-body{padding:8px}.ksl-select,.ksl-btn{padding:10px 8px}.ksl-note{font-size:9.5px}}
`});
  const host=node(doc,'section',{class:'ksf-panel'});host.setAttribute('data-kelo-skeleton-lab','');
  const badge=node(doc,'span',{class:'ksl-state',text:'POSE SPACE OFFLINE'}),head=node(doc,'div',{class:'ksl-head'},[node(doc,'strong',{text:'SKELETON LAB · V3.1'}),badge]);
  const body=node(doc,'div',{class:'ksl-body'}),toolbar=node(doc,'div',{class:'ksl-toolbar'}),direction=node(doc,'select',{class:'ksl-select'}),action=node(doc,'select',{class:'ksl-select'});
  SPRITE_DIRECTIONS.forEach(value=>direction.append(node(doc,'option',{value,text:`Direction · ${value}`})));direction.value=state.direction;
  ['walk','idle'].forEach(value=>action.append(node(doc,'option',{value,text:`Action · ${value.toUpperCase()}`})));action.value=state.action;
  const enabled=node(doc,'input',{type:'checkbox',checked:false}),toggle=node(doc,'label',{class:'ksl-toggle'},[enabled,node(doc,'span',{text:'Use REAL skeleton conditioning for the selected direction'})]);
  const canvasWrap=node(doc,'div',{class:'ksl-canvas-wrap'}),canvas=node(doc,'canvas',{class:'ksl-canvas'});canvas.width=384;canvas.height=384;canvasWrap.append(canvas);
  const frames=node(doc,'div',{class:'ksl-frames'}),frameButtons=[];for(let i=0;i<4;i++){const b=node(doc,'button',{class:`ksl-frame${i===0?' on':''}`,type:'button',text:`F${i+1}`});b.onclick=()=>{state.frame=i;state.selectedJoint=null;sync();};frameButtons.push(b);frames.append(b);}
  const jointLabel=node(doc,'div',{class:'ksl-joint',text:'Drag a joint with one finger'}),coord=node(doc,'div',{class:'ksl-joint',text:'—'}),meta=node(doc,'div',{class:'ksl-meta'},[jointLabel,coord]);
  const reset=node(doc,'button',{class:'ksl-btn',type:'button',text:'RESET FRAME'}),resetAll=node(doc,'button',{class:'ksl-btn',type:'button',text:'RESET ALL'}),actions=node(doc,'div',{class:'ksl-actions'},[reset,resetAll]);
  const note=node(doc,'div',{class:'ksl-note'});toolbar.append(direction,action,toggle);body.append(toolbar,canvasWrap,frames,meta,actions,note);host.append(head,body);
  const side=shell.querySelector('.ksf-side');if(side)side.append(host);else shell.querySelector('.ksf-grid')?.append(host);shell.append(style);
  const ctx=canvas.getContext('2d');
  function frame(){return state.frames[state.frame]||state.frames[0];}
  function xy(name){const p=frame()?.keypoints?.[name];return p?[p[0]*canvas.width,p[1]*canvas.height]:null;}
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#06090d';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='#17202b';ctx.lineWidth=1;for(let i=1;i<8;i++){const q=i*canvas.width/8;ctx.beginPath();ctx.moveTo(q,0);ctx.lineTo(q,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,q);ctx.lineTo(canvas.width,q);ctx.stroke();}
    ctx.lineCap='round';ctx.lineJoin='round';LINKS.forEach(([a,b],i)=>{const pa=xy(a),pb=xy(b);if(!pa||!pb)return;ctx.strokeStyle=PALETTE[i%PALETTE.length];ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();});
    Object.entries(frame()?.keypoints||{}).forEach(([name,p],i)=>{const x=p[0]*canvas.width,y=p[1]*canvas.height,selected=name===state.selectedJoint;ctx.fillStyle=selected?'#fff4ae':PALETTE[i%PALETTE.length];ctx.strokeStyle='#050608';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,selected?10:8,0,Math.PI*2);ctx.fill();ctx.stroke();if(selected){ctx.fillStyle='#fff';ctx.font='700 13px system-ui';ctx.fillText(name,x+13,y-10);}});
  }
  function statusText(){if(!state.backendReady)return'POSE SPACE NOT DEPLOYED';if(!state.referenceReady)return'ADD MASTER REFERENCE';return state.enabled?'REAL SKELETON ON':'REAL SKELETON READY';}
  function sync(){frameButtons.forEach((b,i)=>b.classList.toggle('on',i===state.frame));badge.textContent=statusText();badge.classList.toggle('ok',state.backendReady&&state.referenceReady);note.textContent=state.backendReady?'Edit the four walk poses directly on iPhone. Kelo sends normalized joints; OpenPose ControlNet owns pose while IP-Adapter holds identity.':'Editor works locally now. Generation stays blocked until the dedicated pose Space is configured; there is no fake semantic downgrade.';const selected=state.selectedJoint&&frame()?.keypoints?.[state.selectedJoint];jointLabel.textContent=state.selectedJoint||'Drag a joint with one finger';coord.textContent=selected?`${selected[0].toFixed(3)}, ${selected[1].toFixed(3)}`:'—';render();}
  function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};}
  function nearest(point){let best=null,dist=Infinity;for(const[name,p]of Object.entries(frame()?.keypoints||{})){const dx=p[0]-point.x,dy=p[1]-point.y,d=dx*dx+dy*dy;if(d<dist){dist=d;best=name;}}return dist<=0.0065?best:null;}
  canvas.addEventListener('pointerdown',event=>{const p=canvasPoint(event),name=nearest(p);if(!name)return;state.selectedJoint=name;canvas.setPointerCapture?.(event.pointerId);sync();event.preventDefault();});
  canvas.addEventListener('pointermove',event=>{if(!state.selectedJoint||!canvas.hasPointerCapture?.(event.pointerId))return;const p=canvasPoint(event);frame().keypoints[state.selectedJoint]=[Number(p.x.toFixed(4)),Number(p.y.toFixed(4))];sync();event.preventDefault();});
  const release=event=>{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture?.(event.pointerId);};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  direction.onchange=()=>{state.direction=direction.value;sync();};action.onchange=()=>{state.action=action.value;state.frames=cloneFrames(state.action);state.frame=0;state.selectedJoint=null;sync();};enabled.onchange=()=>{state.enabled=enabled.checked;sync();root.dispatchEvent?.(new CustomEvent('kelo:sprite-skeleton-mode',{detail:{enabled:state.enabled}}));};
  reset.onclick=()=>{state.frames[state.frame]=cloneFrames(state.action)[state.frame];state.selectedJoint=null;sync();};resetAll.onclick=()=>{state.frames=cloneFrames(state.action);state.selectedJoint=null;sync();};
  function payload(){return{schema:SKELETON_SCHEMA,version:2,action:state.action,frames:state.frames.map(f=>({schema:f.schema,name:f.name,phase:f.phase,keypoints:Object.fromEntries(Object.entries(f.keypoints).map(([name,p])=>[name,[Number(p[0]),Number(p[1])]]))}))};}
  const api=Object.freeze({
    element:host,
    isEnabled:()=>state.enabled,
    setBackendStatus(next={}){state.backendReady=Boolean(next.realSkeletonReady);sync();},
    setReferenceReady(value){state.referenceReady=Boolean(value);sync();},
    getState:()=>Object.freeze({enabled:state.enabled,backendReady:state.backendReady,referenceReady:state.referenceReady,direction:state.direction,action:state.action,frame:state.frame,poseTemplate:payload()}),
    getRequestOverlay(){if(!state.enabled)return null;return Object.freeze({pipeline:'identity-skeleton-v3',mode:'direction',direction:state.direction,action:state.action,realSkeleton:true,poseTemplate:payload()});},
    destroy(){style.remove();host.remove();}
  });
  host.__keloApi=api;try{root.__KELO_SPRITE_SKELETON_LAB__=api;}catch{}sync();return api;
}

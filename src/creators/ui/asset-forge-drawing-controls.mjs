/* KELO-INDEX
 * area: CREATORS / ASSET FORGE DRAWING CONTROLS
 * owner: Kelo Asset Forge UI
 * owns: mobile-first high-fidelity drawing interaction layered onto the existing Asset Forge canvas
 * does-not-own: persistence, manifest schema, AI generation, marketplace settlement or gameplay rendering
 * performance: pointer-event driven only; no render loop; working canvases are <=64x64
 */
import {
  appendInterpolatedPath,brushStampPoints,ellipseOutlinePoints,floodFillImageData,linePoints,
  mirrorPixelPoints,rectangleOutlinePoints,simplifyPixelPerfect,uniquePoints
} from '../assets/asset-forge-drawing-engine.mjs';

const CONTROL_ID='kelo-asset-drawing-controls';
const TOOL_LABELS=new Map([['PENCIL','pencil'],['ERASE','eraser'],['FILL','fill'],['PICK','picker']]);
const HISTORY_LIMIT=60;

function hexToRgba(hex){
  const raw=String(hex||'#ffffff').replace('#','');
  const full=raw.length===3?raw.split('').map(c=>c+c).join(''):raw.padEnd(6,'f').slice(0,6);
  return [parseInt(full.slice(0,2),16),parseInt(full.slice(2,4),16),parseInt(full.slice(4,6),16),255];
}
function rgbaToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');}
function text(node){return String(node?.textContent||'').trim().toUpperCase();}
function makeButton(document,label){const b=document.createElement('button');b.type='button';b.className='kaf-btn';b.textContent=label;return b;}

export function installAssetForgeDrawingControls({root=globalThis,session=null}={}){
  const document=root.document,shell=session?.shell||document?.getElementById('kelo-asset-forge'),canvas=session?.canvas||shell?.querySelector('canvas');
  if(!document||!shell||!canvas)return()=>{};
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return()=>{};ctx.imageSmoothingEnabled=false;
  shell.querySelector(`#${CONTROL_ID}`)?.remove();

  const toolbar=shell.querySelector('.kaf-toolbar'),status=shell.querySelector('.kaf-status'),colorInput=toolbar?.querySelector('input[type="color"]');
  if(!toolbar||!colorInput)return()=>{};
  const baseButtons=[...toolbar.querySelectorAll('button')];
  const undoButton=baseButtons.find(button=>text(button)==='UNDO'),redoButton=baseButtons.find(button=>text(button)==='REDO');
  const sizeSelect=toolbar.querySelector('select[aria-label="Tamaño del asset"]');
  const fileInput=toolbar.querySelector('input[type="file"]');
  const newButton=[...shell.querySelectorAll('button')].find(button=>text(button)==='NEW');
  const grid=shell.querySelector('.kaf-grid-overlay');

  let tool='pencil',brushSize=1,pixelPerfect=true,mirrorX=false,mirrorY=false,alphaLock=false,gridVisible=true;
  let activePointerId=null,stroke=null,undoStack=[],redoStack=[];

  const controls=document.createElement('div');controls.id=CONTROL_ID;controls.className='kaf-toolbar';controls.style.cssText='border-top:1px solid rgba(255,255,255,.05);background:#0b1012';
  const ppBtn=makeButton(document,'PIXEL PERFECT'),mxBtn=makeButton(document,'MIRROR X'),myBtn=makeButton(document,'MIRROR Y'),alphaBtn=makeButton(document,'ALPHA LOCK'),gridBtn=makeButton(document,'GRID');
  const lineBtn=makeButton(document,'LINE'),rectBtn=makeButton(document,'RECT'),ellipseBtn=makeButton(document,'ELLIPSE');
  const brush=document.createElement('select');brush.className='kaf-select';brush.setAttribute('aria-label','Brush size');
  for(const n of [1,2,3,4]){const option=document.createElement('option');option.value=String(n);option.textContent=`${n}px`;brush.append(option);}
  controls.append(ppBtn,mxBtn,myBtn,alphaBtn,gridBtn,lineBtn,rectBtn,ellipseBtn,brush);toolbar.after(controls);

  function setStatus(message){if(status)status.textContent=message;}
  function snapshot(){return ctx.getImageData(0,0,canvas.width,canvas.height);}
  function restore(image){ctx.putImageData(image,0,0);}
  function pushUndo(){undoStack.push(snapshot());if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack=[];}
  function clearHistory(){undoStack=[];redoStack=[];}
  function refreshQa(){try{session?.selfCheck?.();}catch{}}
  function updateToggles(){
    ppBtn.classList.toggle('active',pixelPerfect);mxBtn.classList.toggle('active',mirrorX);myBtn.classList.toggle('active',mirrorY);alphaBtn.classList.toggle('active',alphaLock);gridBtn.classList.toggle('active',gridVisible);
    lineBtn.classList.toggle('active',tool==='line');rectBtn.classList.toggle('active',tool==='rect');ellipseBtn.classList.toggle('active',tool==='ellipse');
  }
  function setAdvancedTool(next){
    tool=next;
    for(const button of baseButtons)if(TOOL_LABELS.has(text(button)))button.classList.remove('active');
    updateToggles();setStatus(`${next.toUpperCase()} listo · ${brushSize}px${pixelPerfect&&brushSize===1?' · Pixel Perfect':''}.`);
  }
  function setBaseTool(next){tool=next;lineBtn.classList.remove('active');rectBtn.classList.remove('active');ellipseBtn.classList.remove('active');}
  function pointFromEvent(event){
    const bounds=canvas.getBoundingClientRect();
    return {
      x:Math.max(0,Math.min(canvas.width-1,Math.floor((event.clientX-bounds.left)/Math.max(1,bounds.width)*canvas.width))),
      y:Math.max(0,Math.min(canvas.height-1,Math.floor((event.clientY-bounds.top)/Math.max(1,bounds.height)*canvas.height)))
    };
  }
  function mirroredCenters(points){return mirrorPixelPoints(points,canvas.width,canvas.height,{horizontal:mirrorX,vertical:mirrorY});}
  function paintPoint(image,center,erase=false){
    for(const mirrored of mirroredCenters([center]))for(const p of brushStampPoints(mirrored,brushSize,canvas.width,canvas.height)){
      const i=(p.y*canvas.width+p.x)*4;
      if(alphaLock&&image.data[i+3]===0)continue;
      if(erase){image.data[i]=0;image.data[i+1]=0;image.data[i+2]=0;image.data[i+3]=0;}
      else {const rgba=hexToRgba(colorInput.value);image.data[i]=rgba[0];image.data[i+1]=rgba[1];image.data[i+2]=rgba[2];image.data[i+3]=255;}
    }
  }
  function renderPoints(points,{erase=false}={}){
    if(!stroke)return;
    const image=new ImageData(new Uint8ClampedArray(stroke.base.data),stroke.base.width,stroke.base.height);
    for(const p of uniquePoints(points))paintPoint(image,p,erase);
    restore(image);
  }
  function renderFreehand(){
    let path=stroke.path;
    if(pixelPerfect&&brushSize===1)path=simplifyPixelPerfect(path);
    renderPoints(path,{erase:tool==='eraser'});
  }
  function renderShape(current){
    const start=stroke.start;let points=[];
    if(tool==='line')points=linePoints(start.x,start.y,current.x,current.y);
    else if(tool==='rect')points=rectangleOutlinePoints(start,current);
    else if(tool==='ellipse')points=ellipseOutlinePoints(start,current);
    renderPoints(points,{erase:false});
  }
  function sampleColor(p){
    const d=ctx.getImageData(p.x,p.y,1,1).data;
    if(d[3]===0)return;
    colorInput.value=rgbaToHex(d[0],d[1],d[2]);setStatus(`Color ${colorInput.value} seleccionado.`);
  }
  function fillAt(p){
    const image=snapshot(),rgba=hexToRgba(colorInput.value),seeds=mirroredCenters([p]);let changed=false;
    for(const seed of seeds)changed=floodFillImageData(image,seed.x,seed.y,rgba,{alphaLock})||changed;
    if(changed)restore(image);
  }
  function collectCoalesced(event){
    const events=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():[];
    return events?.length?events:[event];
  }
  function extendStroke(event){
    if(!stroke)return;
    for(const sample of collectCoalesced(event)){
      const p=pointFromEvent(sample);stroke.path=appendInterpolatedPath(stroke.path,p);stroke.last=p;
    }
    if(tool==='pencil'||tool==='eraser')renderFreehand();else if(['line','rect','ellipse'].includes(tool))renderShape(stroke.last);
  }
  function finishStroke(){
    if(!stroke)return;stroke=null;activePointerId=null;refreshQa();
  }

  function onPointerDown(event){
    if(activePointerId!==null)return;
    event.preventDefault();event.stopImmediatePropagation();activePointerId=event.pointerId;canvas.setPointerCapture?.(event.pointerId);
    const start=pointFromEvent(event);
    if(tool==='picker'){sampleColor(start);activePointerId=null;return;}
    pushUndo();
    if(tool==='fill'){fillAt(start);activePointerId=null;refreshQa();return;}
    stroke={base:snapshot(),start,last:start,path:[start]};
    if(tool==='pencil'||tool==='eraser')renderFreehand();else renderShape(start);
  }
  function onPointerMove(event){
    if(activePointerId===null||event.pointerId!==activePointerId||!stroke)return;
    event.preventDefault();event.stopImmediatePropagation();extendStroke(event);
  }
  function onPointerUp(event){
    if(activePointerId===null||event.pointerId!==activePointerId)return;
    event.preventDefault();event.stopImmediatePropagation();if(stroke)extendStroke(event);
    try{canvas.releasePointerCapture?.(event.pointerId);}catch{}finishStroke();
  }
  function onPointerCancel(event){
    if(activePointerId===null||event.pointerId!==activePointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(stroke){restore(stroke.base);undoStack.pop();}stroke=null;activePointerId=null;
  }
  function onShellClickCapture(event){
    const button=event.target?.closest?.('button');if(!button||!shell.contains(button))return;
    const mapped=TOOL_LABELS.get(text(button));if(mapped){setBaseTool(mapped);updateToggles();}
  }
  function doUndo(event){
    if(!undoStack.length)return;
    event?.preventDefault?.();event?.stopImmediatePropagation?.();redoStack.push(snapshot());restore(undoStack.pop());refreshQa();setStatus('Undo.');
  }
  function doRedo(event){
    if(!redoStack.length)return;
    event?.preventDefault?.();event?.stopImmediatePropagation?.();undoStack.push(snapshot());restore(redoStack.pop());refreshQa();setStatus('Redo.');
  }

  ppBtn.onclick=()=>{pixelPerfect=!pixelPerfect;updateToggles();setStatus(pixelPerfect?'Pixel Perfect activo: limpia dobles de esquina.':'Pixel Perfect desactivado.');};
  mxBtn.onclick=()=>{mirrorX=!mirrorX;updateToggles();};myBtn.onclick=()=>{mirrorY=!mirrorY;updateToggles();};alphaBtn.onclick=()=>{alphaLock=!alphaLock;updateToggles();};
  gridBtn.onclick=()=>{gridVisible=!gridVisible;if(grid)grid.style.opacity=gridVisible?'.55':'0';updateToggles();};
  lineBtn.onclick=()=>setAdvancedTool('line');rectBtn.onclick=()=>setAdvancedTool('rect');ellipseBtn.onclick=()=>setAdvancedTool('ellipse');
  brush.onchange=()=>{brushSize=Math.max(1,Math.min(4,Number(brush.value)||1));setStatus(`Pincel ${brushSize}px.`);};

  canvas.addEventListener('pointerdown',onPointerDown,true);canvas.addEventListener('pointermove',onPointerMove,true);canvas.addEventListener('pointerup',onPointerUp,true);canvas.addEventListener('pointercancel',onPointerCancel,true);
  shell.addEventListener('click',onShellClickCapture,true);
  undoButton?.addEventListener('click',doUndo,true);redoButton?.addEventListener('click',doRedo,true);
  sizeSelect?.addEventListener('change',clearHistory,true);fileInput?.addEventListener('change',clearHistory,true);
  newButton?.addEventListener('click',()=>root.queueMicrotask?.(clearHistory),true);
  updateToggles();setStatus('Drawing Engine V2 activo · trazo interpolado para dedo + Pixel Perfect.');

  return()=>{
    canvas.removeEventListener('pointerdown',onPointerDown,true);canvas.removeEventListener('pointermove',onPointerMove,true);canvas.removeEventListener('pointerup',onPointerUp,true);canvas.removeEventListener('pointercancel',onPointerCancel,true);
    shell.removeEventListener('click',onShellClickCapture,true);undoButton?.removeEventListener('click',doUndo,true);redoButton?.removeEventListener('click',doRedo,true);
    sizeSelect?.removeEventListener('change',clearHistory,true);fileInput?.removeEventListener('change',clearHistory,true);controls.remove();
  };
}

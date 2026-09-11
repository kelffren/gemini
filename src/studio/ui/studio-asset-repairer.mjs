/* KELO-INDEX
 * area: STUDIO / ASSET REPAIRER
 * owns: non-destructive sprite/image repair workspace, diagnostics, preview, frame strip and PNG export
 * does-not-own: world mutations, asset persistence or runtime rendering
 * public-api: createStudioAssetRepairer()
 * online: no; local browser image processing only
 */

const STYLE_ID='kelo-asset-repairer-style';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copyCanvas=(document,source)=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);return c;};
const makeCanvas=(document,w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c;};
const rgbaDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

function ensureStyle(document){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
  #kelo-asset-repairer{--gold:#e3c66d;--gold2:#8f7332;--ink:#050b0d;--panel:#0a1417;--panel2:#0d1b1f;--cyan:#63e6df;--muted:#829296;--danger:#f48a80;--ok:#82e6ae;position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 50% -20%,#163037 0,#081214 34%,#030708 78%);color:#eef5f2;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;grid-template-rows:62px minmax(0,1fr) 122px;overflow:hidden;color-scheme:dark}
  #kelo-asset-repairer *{box-sizing:border-box} #kelo-asset-repairer button,#kelo-asset-repairer input,#kelo-asset-repairer select{font:inherit}
  .kar-top{display:flex;align-items:center;gap:16px;padding:0 18px;border-bottom:1px solid rgba(227,198,109,.28);background:linear-gradient(180deg,rgba(7,17,20,.98),rgba(4,10,12,.92));box-shadow:0 8px 30px #0008;position:relative}
  .kar-top:after,.kar-bottom:before{content:"";position:absolute;left:18%;right:18%;height:1px;background:linear-gradient(90deg,transparent,var(--gold2),var(--gold),var(--gold2),transparent)}.kar-top:after{bottom:-1px}.kar-bottom:before{top:-1px}
  .kar-brand{display:flex;align-items:center;gap:10px;min-width:236px}.kar-gem{width:30px;height:30px;border:1px solid var(--gold);transform:rotate(45deg);display:grid;place-items:center;box-shadow:0 0 20px #d7b9552e inset,0 0 18px #d7b95520}.kar-gem:after{content:"K";transform:rotate(-45deg);font-weight:900;color:#f7dda0;font-family:Georgia,serif}.kar-title strong{display:block;color:#f5dda1;font-family:Georgia,serif;letter-spacing:.12em;font-size:13px}.kar-title small{color:#788a8e;font-size:8px;letter-spacing:.2em;text-transform:uppercase}
  .kar-step{flex:1;display:flex;justify-content:center;gap:6px;min-width:0}.kar-step span{font-size:8px;letter-spacing:.12em;color:#617377;padding:7px 11px;border:1px solid transparent;border-radius:999px;white-space:nowrap}.kar-step span.on{color:#dffffc;border-color:#4cd5cf55;background:#123036}.kar-step span.done{color:#f3db9b}
  .kar-actions{display:flex;gap:7px;margin-left:auto}.kar-btn{height:34px;border:1px solid rgba(227,198,109,.26);border-radius:8px;background:#0b181b;color:#dfe9e6;padding:0 12px;font-size:9px;font-weight:850;letter-spacing:.07em;cursor:pointer}.kar-btn:hover{border-color:#d9bd68aa}.kar-btn.primary{border-color:#62ddd5aa;background:linear-gradient(180deg,#17454a,#102b2f);color:#cffffb;box-shadow:0 0 22px #44cfc51b}.kar-btn:disabled{opacity:.35;cursor:default}
  .kar-main{display:grid;grid-template-columns:176px minmax(0,1fr) 270px;min-height:0}.kar-tools,.kar-side{background:linear-gradient(180deg,rgba(7,16,18,.97),rgba(5,12,14,.97));min-height:0;overflow:auto}.kar-tools{border-right:1px solid rgba(227,198,109,.18);padding:13px 10px}.kar-side{border-left:1px solid rgba(227,198,109,.18);padding:12px}
  .kar-kicker{font-size:7px;color:#8b7742;letter-spacing:.22em;font-weight:900;text-transform:uppercase;margin:4px 7px 9px}.kar-tool{width:100%;min-height:51px;margin-bottom:7px;border:1px solid rgba(255,255,255,.055);border-radius:9px;background:#0a1518;color:#cfdbd8;text-align:left;padding:8px 9px;display:grid;grid-template-columns:27px 1fr;column-gap:8px;align-items:center;cursor:pointer}.kar-tool:hover{border-color:#d9bd6855}.kar-tool.on{border-color:#61ddd4a8;background:#102b30;box-shadow:0 0 20px #51ddd01b}.kar-tool b{grid-row:1/3;font-size:17px;color:#e4c970;text-align:center}.kar-tool strong{font-size:8px;letter-spacing:.07em}.kar-tool small{font-size:7px;color:#697c80;margin-top:2px}.kar-tool.warn b{color:#8fe3dd}
  .kar-stage{min-width:0;min-height:0;position:relative;padding:12px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:9px;overflow:hidden}.kar-stage-head{display:flex;align-items:center;gap:9px}.kar-stage-head h2{margin:0;color:#f0d895;font:700 13px/1 Georgia,serif;letter-spacing:.08em}.kar-status{margin-left:auto;display:flex;align-items:center;gap:7px;font-size:8px;color:#85999d;letter-spacing:.08em}.kar-dot{width:7px;height:7px;border-radius:50%;background:#59676a}.kar-status[data-state="repairing"] .kar-dot{background:#63e6df;box-shadow:0 0 12px #63e6df;animation:karPulse .8s infinite alternate}.kar-status[data-state="ready"] .kar-dot{background:#82e6ae;box-shadow:0 0 10px #82e6ae66}@keyframes karPulse{to{opacity:.35}}
  .kar-compare{display:grid;grid-template-columns:1fr 42px 1fr;gap:9px;min-height:0}.kar-preview{position:relative;min-width:0;min-height:0;border:1px solid rgba(227,198,109,.22);border-radius:12px;background:#071013;overflow:hidden;display:grid;grid-template-rows:31px minmax(0,1fr)}.kar-preview h3{margin:0;display:flex;align-items:center;padding:0 10px;border-bottom:1px solid rgba(227,198,109,.12);font-size:8px;letter-spacing:.18em;color:#927f4d}.kar-preview.after h3{color:#72ddd6}.kar-canvas-wrap{position:relative;min-height:0;background-color:#10191b;background-image:linear-gradient(45deg,#182326 25%,transparent 25%),linear-gradient(-45deg,#182326 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#182326 75%),linear-gradient(-45deg,transparent 75%,#182326 75%);background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0;display:grid;place-items:center}.kar-canvas-wrap.drag{outline:2px solid var(--cyan);outline-offset:-5px}.kar-canvas{width:100%;height:100%;image-rendering:pixelated;display:block}.kar-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#667a7e;font-size:9px;line-height:1.7;padding:20px;pointer-events:none}.kar-empty strong{display:block;color:#d7c389;font:700 16px Georgia,serif;margin-bottom:5px}.kar-divider{display:grid;place-items:center;color:#c9ad5c;font-size:17px}.kar-divider:before{content:"→";width:34px;height:34px;border:1px solid #a88d4844;border-radius:50%;display:grid;place-items:center;background:#0a1518}
  .kar-progress{height:40px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:#071114;display:flex;align-items:center;gap:10px;padding:0 11px}.kar-progress-label{width:122px;font-size:8px;color:#7f9296;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kar-progress-track{height:5px;flex:1;border-radius:9px;background:#122126;overflow:hidden}.kar-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#2aaea6,#7ce8df);transition:width .18s ease}.kar-metric{font-size:8px;color:#99aaa7;min-width:36px;text-align:right}
  .kar-card{border:1px solid rgba(227,198,109,.14);border-radius:10px;background:#081316;margin-bottom:9px;overflow:hidden}.kar-card-head{height:31px;padding:0 9px;display:flex;align-items:center;border-bottom:1px solid rgba(227,198,109,.11);font-size:7px;font-weight:900;letter-spacing:.16em;color:#bba25f}.kar-card-head span{margin-left:auto;color:#5f7478}.kar-diags{padding:7px}.kar-diag{display:grid;grid-template-columns:8px 1fr auto;gap:6px;align-items:center;padding:6px 2px;border-bottom:1px solid #ffffff08;font-size:7px;color:#b7c4c1}.kar-diag:last-child{border-bottom:0}.kar-diag i{width:6px;height:6px;border-radius:50%;background:#6f7e80}.kar-diag.ok i{background:#75dca2}.kar-diag.warn i{background:#e1be67}.kar-diag.bad i{background:#ef857c}.kar-diag em{font-style:normal;color:#718589}.kar-ready{margin:8px;padding:9px;border:1px solid #63827444;border-radius:8px;text-align:center;font:700 10px Georgia,serif;letter-spacing:.13em;color:#778985;background:#0b1719}.kar-ready.on{border-color:#6bd89c66;color:#9aebbb;background:#0d211a;box-shadow:0 0 18px #66e09b12}.kar-layers{padding:5px 8px}.kar-layer{display:flex;align-items:center;gap:7px;min-height:28px;font-size:7px;color:#9fadaa}.kar-layer input{accent-color:#70dcd4}.kar-output{padding:8px;display:grid;gap:7px}.kar-field{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:7px;color:#93a5a3}.kar-field select,.kar-field input[type="number"]{width:94px;height:27px;border:1px solid #ffffff12;border-radius:6px;background:#0d1a1d;color:#dbe6e3;padding:0 6px}.kar-field input[type="checkbox"]{accent-color:#62ddd5}.kar-export{width:100%;height:36px;margin-top:2px}
  .kar-bottom{position:relative;border-top:1px solid rgba(227,198,109,.22);background:#050d0f;padding:8px 14px;display:grid;grid-template-columns:150px minmax(0,1fr) 150px;gap:10px;align-items:center}.kar-play{display:flex;gap:5px;align-items:center}.kar-play .kar-btn{padding:0 9px}.kar-frames{display:flex;gap:6px;overflow-x:auto;min-width:0;padding:2px}.kar-frame{width:62px;min-width:62px;height:83px;border:1px solid #ffffff12;border-radius:8px;background:#0a1518;color:#89999a;padding:4px;cursor:pointer;position:relative}.kar-frame.on{border-color:#63e6dfaa;box-shadow:0 0 15px #63e6df17}.kar-frame canvas{width:52px;height:52px;display:block;object-fit:contain;image-rendering:pixelated;background:#111b1d}.kar-frame span{display:block;font-size:6px;text-align:center;padding-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kar-bottom-side{font-size:7px;color:#63777a;text-align:right}.kar-bottom-side strong{display:block;color:#c8b069;font-size:8px;margin-bottom:3px}
  .kar-toast{position:absolute;left:50%;top:74px;transform:translate(-50%,-16px);opacity:0;pointer-events:none;z-index:5;padding:8px 12px;border:1px solid #63e6df55;border-radius:9px;background:#071517ed;color:#dffffb;font-size:8px;transition:.2s}.kar-toast.on{opacity:1;transform:translate(-50%,0)}
  @media(max-width:980px){#kelo-asset-repairer{grid-template-rows:56px minmax(0,1fr) 108px}.kar-main{grid-template-columns:132px minmax(0,1fr) 220px}.kar-brand{min-width:auto}.kar-title small,.kar-step{display:none}.kar-tool{grid-template-columns:22px 1fr;padding:6px;min-height:46px}.kar-compare{grid-template-columns:1fr}.kar-divider{display:none}.kar-preview{min-height:180px}.kar-preview:first-child{display:none}.kar-stage{padding:8px}.kar-bottom{grid-template-columns:115px 1fr 95px}}
  @media(max-width:700px){#kelo-asset-repairer{display:flex;flex-direction:column;overflow:auto}.kar-top{min-height:54px;position:sticky;top:0;z-index:4}.kar-brand{flex:1}.kar-title strong{font-size:11px}.kar-actions .kar-btn:not(.primary){display:none}.kar-main{display:flex;flex-direction:column;overflow:visible}.kar-tools{order:2;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:7px;border:0;border-top:1px solid #d8ba5d22}.kar-kicker{grid-column:1/-1;margin:2px}.kar-tool{margin:0;min-height:54px}.kar-tool small{display:none}.kar-stage{order:1;min-height:430px}.kar-side{order:3;border:0;border-top:1px solid #d8ba5d22;display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:7px}.kar-card{margin:0}.kar-bottom{position:sticky;bottom:0;min-height:100px;grid-template-columns:auto 1fr;padding:6px 8px}.kar-bottom-side{display:none}.kar-frames{max-width:100%}.kar-frame{width:55px;min-width:55px;height:75px}.kar-frame canvas{width:45px;height:45px}}
  `;document.head.appendChild(style);
}

function computeBounds(imageData){
  const {width:w,height:h,data}=imageData;let minX=w,minY=h,maxX=-1,maxY=-1,visible=0,semi=0,transparent=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a===0){transparent++;continue;}visible++;if(a<255)semi++;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
  return{minX,maxX,minY,maxY,visible,semi,transparent,empty:maxX<0,width:maxX<0?0:maxX-minX+1,height:maxY<0?0:maxY-minY+1};
}
function analyzeCanvas(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),b=computeBounds(img),total=canvas.width*canvas.height;
  let edgeAlpha=0,stray=0;const d=img.data,w=img.width,h=img.height;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,a=d[i+3];if(a>0&&a<18)edgeAlpha++;if(a>0){let neighbors=0;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){if(xx===x&&yy===y)continue;if(d[(yy*w+xx)*4+3]>0)neighbors++;}if(neighbors===0)stray++;}}
  const pivot=b.empty?{x:w/2,y:h/2}:{x:(b.minX+b.maxX+1)/2,y:(b.minY+b.maxY+1)/2};
  const center={x:w/2,y:h/2},offset=Math.hypot(pivot.x-center.x,pivot.y-center.y);
  return{bounds:b,edgeAlpha,stray,pivot,pivotOffset:offset,alphaCoverage:total?b.visible/total:0,hasTransparency:b.transparent>0};
}
function cornerBackground(imageData){
  const {width:w,height:h,data}=imageData,size=Math.max(1,Math.min(6,Math.floor(Math.min(w,h)/8))),samples=[];
  const blocks=[[0,0],[w-size,0],[0,h-size],[w-size,h-size]];
  for(const [sx,sy] of blocks){let r=0,g=0,b=0,a=0,n=0;for(let y=sy;y<sy+size;y++)for(let x=sx;x<sx+size;x++){const i=(y*w+x)*4;r+=data[i];g+=data[i+1];b+=data[i+2];a+=data[i+3];n++;}samples.push([r/n,g/n,b/n,a/n]);}
  const rgb=[0,1,2].map(k=>samples.reduce((s,v)=>s+v[k],0)/samples.length),alpha=samples.reduce((s,v)=>s+v[3],0)/samples.length;
  const spread=Math.max(...samples.map(v=>rgbaDistance(v,rgb)));return{rgb,alpha,spread,confidence:alpha>230&&spread<24};
}
function removeUniformBackground(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),bg=cornerBackground(img);if(!bg.confidence)return{changed:0,skipped:true};
  const {data,width:w,height:h}=img,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),tolerance=34;let head=0,tail=0,changed=0;
  const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const p=y*w+x;if(seen[p])return;seen[p]=1;const i=p*4;if(data[i+3]<8||rgbaDistance([data[i],data[i+1],data[i+2]],bg.rgb)<=tolerance)queue[tail++]=p;};
  for(let x=0;x<w;x++){push(x,0);push(x,h-1)}for(let y=0;y<h;y++){push(0,y);push(w-1,y)}
  while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0,i=p*4;if(data[i+3]){data[i+3]=0;data[i]=data[i+1]=data[i+2]=0;changed++;}push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1)}
  if(changed>w*h*.78)return{changed:0,skipped:true};ctx.putImageData(img,0,0);return{changed,skipped:false};
}
function cleanEdges(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data;let changed=0;
  for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<10&&a!==0){d[i]=d[i+1]=d[i+2]=d[i+3]=0;changed++;}else if(a===0&&(d[i]||d[i+1]||d[i+2])){d[i]=d[i+1]=d[i+2]=0;changed++;}}
  ctx.putImageData(img,0,0);return changed;
}
function centerOpaque(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),b=computeBounds(img);if(b.empty)return false;
  const dx=Math.round((canvas.width-b.width)/2-b.minX),dy=Math.round((canvas.height-b.height)/2-b.minY);if(!dx&&!dy)return false;
  const copy=copyCanvas(canvas.ownerDocument||document,canvas);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(copy,dx,dy);return true;
}
function normalizeOpaque(canvas,targetRatio=.78){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),b=computeBounds(img);if(b.empty)return false;
  const targetW=canvas.width*targetRatio,targetH=canvas.height*targetRatio,scale=Math.min(targetW/b.width,targetH/b.height);if(!Number.isFinite(scale)||Math.abs(scale-1)<.025)return centerOpaque(canvas);
  const copy=copyCanvas(canvas.ownerDocument||document,canvas),dw=Math.max(1,Math.round(b.width*scale)),dh=Math.max(1,Math.round(b.height*scale)),dx=Math.round((canvas.width-dw)/2),dy=Math.round((canvas.height-dh)/2);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(copy,b.minX,b.minY,b.width,b.height,dx,dy,dw,dh);return true;
}
function repairSeams(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data,w=img.width,h=img.height;let changed=0;
  const avg=(i,j)=>{for(let k=0;k<4;k++){const v=Math.round((d[i+k]+d[j+k])/2);if(d[i+k]!==v||d[j+k]!==v)changed++;d[i+k]=d[j+k]=v;}};
  for(let y=0;y<h;y++)avg((y*w)*4,(y*w+w-1)*4);for(let x=0;x<w;x++)avg(x*4,((h-1)*w+x)*4);ctx.putImageData(img,0,0);return changed;
}

export function createStudioAssetRepairer({root=globalThis}={}){
  const document=root?.document;if(!document)return Object.freeze({openFiles:async()=>false,runAutoRepair:async()=>false,exportAsset:()=>false,getState:()=>({mounted:false}),destroy(){}});
  ensureStyle(document);document.getElementById('kelo-asset-repairer')?.remove();
  const host=document.createElement('section');host.id='kelo-asset-repairer';host.dataset.keloStudioUi='1';host.setAttribute('aria-label','Kelo Studio Asset Repairer');
  host.innerHTML=`
    <header class="kar-top"><div class="kar-brand"><div class="kar-gem"></div><div class="kar-title"><strong>ASSET REPAIRER</strong><small>Kelo Studio · non-destructive lab</small></div></div><div class="kar-step"><span class="on">01 IMPORT</span><span>02 DIAGNOSE</span><span>03 REPAIR</span><span>04 EXPORT</span></div><div class="kar-actions"><button class="kar-btn" data-act="reset">RESET</button><button class="kar-btn" data-act="undo">UNDO</button><button class="kar-btn primary" data-act="open">＋ OPEN ASSET</button></div></header>
    <div class="kar-main">
      <aside class="kar-tools"><div class="kar-kicker">Repair tools</div>
        <button class="kar-tool on" data-tool="auto"><b>✦</b><strong>AUTO REPAIR</strong><small>Safe cleanup pipeline</small></button>
        <button class="kar-tool" data-tool="background"><b>◇</b><strong>REMOVE BG</strong><small>Corner-connected color</small></button>
        <button class="kar-tool" data-tool="edges"><b>◈</b><strong>FIX EDGES</strong><small>Alpha + stray cleanup</small></button>
        <button class="kar-tool" data-tool="pivot"><b>⌖</b><strong>CENTER PIVOT</strong><small>Opaque bounds center</small></button>
        <button class="kar-tool" data-tool="scale"><b>⤢</b><strong>UNIFORM SCALE</strong><small>Normalize frame occupancy</small></button>
        <button class="kar-tool warn" data-tool="seams"><b>⌗</b><strong>TILE SEAMS</strong><small>Match opposite edges</small></button>
      </aside>
      <main class="kar-stage"><div class="kar-stage-head"><h2>REPAIR WORKSPACE</h2><div class="kar-status" data-state="idle"><span class="kar-dot"></span><span data-status>NO ASSET</span></div></div>
        <div class="kar-compare">
          <section class="kar-preview"><h3>BEFORE · ORIGINAL</h3><div class="kar-canvas-wrap" data-drop><canvas class="kar-canvas" data-before></canvas><div class="kar-empty" data-empty><div><strong>DROP PNG HERE</strong>or tap OPEN ASSET<br>Multiple images become animation frames.</div></div></div></section>
          <div class="kar-divider"></div>
          <section class="kar-preview after"><h3>AFTER · REPAIRED</h3><div class="kar-canvas-wrap"><canvas class="kar-canvas" data-after></canvas></div></section>
        </div>
        <div class="kar-progress"><span class="kar-progress-label" data-progress-label>Waiting for asset</span><div class="kar-progress-track"><div class="kar-progress-fill" data-progress-fill></div></div><span class="kar-metric" data-progress-value>0%</span></div><div class="kar-toast" data-toast></div>
      </main>
      <aside class="kar-side">
        <section class="kar-card"><div class="kar-card-head">REPAIR DIAGNOSTICS <span data-size>—</span></div><div class="kar-diags" data-diags></div><div class="kar-ready" data-ready>NO ASSET</div></section>
        <section class="kar-card"><div class="kar-card-head">LAYERS <span>PREVIEW</span></div><div class="kar-layers"><label class="kar-layer"><input type="checkbox" data-layer="character" checked> Character / pixels</label><label class="kar-layer"><input type="checkbox" data-layer="pivot" checked> Pivot guide</label><label class="kar-layer"><input type="checkbox" data-layer="grid"> Pixel grid</label></div></section>
        <section class="kar-card"><div class="kar-card-head">OUTPUT SETTINGS <span>PNG</span></div><div class="kar-output"><label class="kar-field"><span>Format</span><select data-format><option>PNG</option></select></label><label class="kar-field"><span>Transparency</span><input type="checkbox" data-transparent checked></label><label class="kar-field"><span>Sprite strip</span><input type="checkbox" data-strip></label><label class="kar-field"><span>Nearest pixel</span><input type="checkbox" data-nearest checked></label><button class="kar-btn primary kar-export" data-act="export" disabled>EXPORT PNG</button></div></section>
      </aside>
    </div>
    <footer class="kar-bottom"><div class="kar-play"><button class="kar-btn" data-act="play">▶</button><button class="kar-btn" data-act="add">＋ FRAME</button></div><div class="kar-frames" data-frames></div><div class="kar-bottom-side"><strong>ANIMATION FRAMES</strong><span data-frame-meta>0 frames · 12 FPS</span></div></footer>
    <input data-file type="file" accept="image/png,image/webp,image/jpeg" multiple hidden>`;
  (document.body||document.documentElement).appendChild(host);

  const q=s=>host.querySelector(s),qa=s=>[...host.querySelectorAll(s)],state={frames:[],active:0,status:'idle',progress:0,playing:false,fps:12,timer:null,destroyed:false};
  const before=q('[data-before]'),after=q('[data-after]'),fileInput=q('[data-file]'),statusEl=q('[data-status]'),statusWrap=q('.kar-status'),progressLabel=q('[data-progress-label]'),progressFill=q('[data-progress-fill]'),progressValue=q('[data-progress-value]'),toast=q('[data-toast]');
  let toastTimer=0;
  const tell=(text)=>{toast.textContent=text;toast.classList.add('on');root.clearTimeout?.(toastTimer);toastTimer=root.setTimeout?.(()=>toast.classList.remove('on'),1800)};
  const setStatus=(status,label=status)=>{state.status=status;statusWrap.dataset.state=status;statusEl.textContent=String(label).toUpperCase();};
  const setProgress=(value,label)=>{state.progress=clamp(Number(value)||0,0,100);progressFill.style.width=`${state.progress}%`;progressValue.textContent=`${Math.round(state.progress)}%`;if(label)progressLabel.textContent=label;};
  const current=()=>state.frames[state.active]||null;

  function fitDraw(target,source,{pivot=null,showPivot=false,showGrid=false}={}){
    const rect=target.getBoundingClientRect(),dpr=clamp(Number(root.devicePixelRatio)||1,1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(target.width!==w||target.height!==h){target.width=w;target.height=h}
    const ctx=target.getContext('2d');ctx.clearRect(0,0,w,h);if(!source)return;const pad=18*dpr,scale=Math.min((w-pad*2)/source.width,(h-pad*2)/source.height),dw=Math.max(1,Math.round(source.width*scale)),dh=Math.max(1,Math.round(source.height*scale)),dx=Math.round((w-dw)/2),dy=Math.round((h-dh)/2);ctx.imageSmoothingEnabled=false;ctx.drawImage(source,dx,dy,dw,dh);
    if(showGrid&&scale>=5){ctx.strokeStyle='#ffffff16';ctx.lineWidth=1;for(let x=0;x<=source.width;x++){const px=dx+x*scale;ctx.beginPath();ctx.moveTo(px,dy);ctx.lineTo(px,dy+dh);ctx.stroke()}for(let y=0;y<=source.height;y++){const py=dy+y*scale;ctx.beginPath();ctx.moveTo(dx,py);ctx.lineTo(dx+dw,py);ctx.stroke()}}
    if(showPivot&&pivot){const px=dx+pivot.x*scale,py=dy+pivot.y*scale;ctx.strokeStyle='#69e5dd';ctx.lineWidth=Math.max(1,dpr);ctx.beginPath();ctx.moveTo(px-9*dpr,py);ctx.lineTo(px+9*dpr,py);ctx.moveTo(px,py-9*dpr);ctx.lineTo(px,py+9*dpr);ctx.stroke();ctx.beginPath();ctx.arc(px,py,4*dpr,0,Math.PI*2);ctx.stroke()}
  }
  function renderPreview(){const f=current(),showCharacter=q('[data-layer="character"]').checked,showPivot=q('[data-layer="pivot"]').checked,showGrid=q('[data-layer="grid"]').checked;fitDraw(before,f?.source||null);fitDraw(after,showCharacter?f?.result:null,{pivot:f?.diagnostics?.pivot,showPivot,showGrid});q('[data-empty]').hidden=!!f;}
  function diagnosticsFor(frame){frame.diagnostics=analyzeCanvas(frame.result);return frame.diagnostics;}
  function renderDiagnostics(){const f=current(),box=q('[data-diags]'),ready=q('[data-ready]'),size=q('[data-size]'),exportButton=q('[data-act="export"]');box.replaceChildren();if(!f){size.textContent='—';ready.textContent='NO ASSET';ready.classList.remove('on');exportButton.disabled=true;return;}const d=diagnosticsFor(f),rows=[
      [d.hasTransparency?'ok':'warn','Transparency',d.hasTransparency?'present':'opaque'],
      [d.stray===0?'ok':d.stray<4?'warn':'bad','Stray pixels',String(d.stray)],
      [d.edgeAlpha<8?'ok':d.edgeAlpha<64?'warn':'bad','Weak alpha',String(d.edgeAlpha)],
      [d.pivotOffset<2?'ok':d.pivotOffset<8?'warn':'bad','Pivot offset',`${d.pivotOffset.toFixed(1)} px`],
      [d.bounds.empty?'bad':'ok','Visible bounds',d.bounds.empty?'empty':`${d.bounds.width}×${d.bounds.height}`]
    ];for(const [level,label,value] of rows){const row=document.createElement('div');row.className=`kar-diag ${level}`;row.innerHTML=`<i></i><span>${label}</span><em>${value}</em>`;box.appendChild(row)}
    size.textContent=`${f.result.width}×${f.result.height}`;const isReady=!d.bounds.empty&&d.stray<4&&d.edgeAlpha<64;ready.textContent=isReady?'ASSET READY':'REVIEW SUGGESTED';ready.classList.toggle('on',isReady);exportButton.disabled=false;
  }
  function renderFrames(){const wrap=q('[data-frames]');wrap.replaceChildren();state.frames.forEach((f,i)=>{const b=document.createElement('button');b.className=`kar-frame${i===state.active?' on':''}`;b.type='button';b.dataset.frame=String(i);const c=document.createElement('canvas');c.width=52;c.height=52;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,52,52);const s=Math.min(48/f.result.width,48/f.result.height),w=f.result.width*s,h=f.result.height*s;ctx.drawImage(f.result,(52-w)/2,(52-h)/2,w,h);const span=document.createElement('span');span.textContent=f.name||`Frame ${i+1}`;b.append(c,span);wrap.appendChild(b)});q('[data-frame-meta]').textContent=`${state.frames.length} frame${state.frames.length===1?'':'s'} · ${state.fps} FPS`;}
  function renderAll(){renderFrames();renderDiagnostics();renderPreview();qa('.kar-step span').forEach((el,i)=>el.classList.toggle('done',!!current()&&i<3));if(current())qa('.kar-step span')[1]?.classList.add('on');}
  function snapshot(frame){frame.history??=[];frame.history.push(copyCanvas(document,frame.result));if(frame.history.length>15)frame.history.shift();}
  function applyMutation(label,fn){const f=current();if(!f)return false;snapshot(f);const result=fn(f.result,f);diagnosticsFor(f);setStatus('ready',label);setProgress(100,label);renderAll();tell(label);return result;}
  function undo(){const f=current();if(!f?.history?.length)return false;f.result=f.history.pop();diagnosticsFor(f);renderAll();setStatus('ready','undo restored');tell('Undo restored');return true;}
  function reset(){const f=current();if(!f)return false;snapshot(f);f.result=copyCanvas(document,f.source);diagnosticsFor(f);renderAll();setStatus('ready','original restored');setProgress(0,'Original restored');return true;}

  async function decodeFile(file){
    let bitmap=null;if(typeof root.createImageBitmap==='function')bitmap=await root.createImageBitmap(file);else{bitmap=await new Promise((resolve,reject)=>{const img=new root.Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};img.src=url})}
    const source=makeCanvas(document,bitmap.width||bitmap.naturalWidth,bitmap.height||bitmap.naturalHeight),ctx=source.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0);bitmap.close?.();const result=copyCanvas(document,source);return{name:file.name||'asset.png',source,result,history:[],diagnostics:analyzeCanvas(result)};
  }
  async function openFiles(files){const accepted=[...(files||[])].filter(f=>/^image\//.test(f.type)||/\.(png|webp|jpe?g)$/i.test(f.name||''));if(!accepted.length){tell('Choose a PNG, WebP or JPEG');return false;}setStatus('repairing','importing');setProgress(8,'Reading asset');const loaded=[];for(let i=0;i<accepted.length;i++){loaded.push(await decodeFile(accepted[i]));setProgress(8+Math.round((i+1)/accepted.length*55),`Importing ${i+1}/${accepted.length}`)}state.frames.push(...loaded);state.active=Math.max(0,state.frames.length-loaded.length);setProgress(100,'Import complete');setStatus('ready','asset loaded');renderAll();tell(`${loaded.length} asset${loaded.length===1?'':'s'} loaded`);return true;}
  const delay=(ms=90)=>new Promise(resolve=>root.setTimeout(resolve,ms));
  async function runAutoRepair(){const f=current();if(!f)return false;snapshot(f);setStatus('repairing','repairing');const steps=[[18,'Analyzing source',()=>diagnosticsFor(f)],[38,'Cleaning alpha',()=>cleanEdges(f.result)],[60,'Checking background',()=>removeUniformBackground(f.result)],[80,'Centering opaque bounds',()=>centerOpaque(f.result)],[94,'Validating output',()=>diagnosticsFor(f)]];for(const [p,label,fn] of steps){setProgress(p,label);fn();renderPreview();await delay()}diagnosticsFor(f);setProgress(100,'Repair complete');setStatus('ready','repair complete');renderAll();tell('Auto repair complete');return true;}
  function exportAsset(){const f=current();if(!f)return false;const strip=q('[data-strip]').checked&&state.frames.length>1,canvas=strip?makeCanvas(document,state.frames.reduce((s,x)=>s+x.result.width,0),Math.max(...state.frames.map(x=>x.result.height))):copyCanvas(document,f.result);if(strip){const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;let x=0;for(const frame of state.frames){ctx.drawImage(frame.result,x,0);x+=frame.result.width}}canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=strip?'kelo-sprite-strip.png':(f.name.replace(/\.[^.]+$/,'')+'-repaired.png');document.body.appendChild(a);a.click();a.remove();root.setTimeout(()=>URL.revokeObjectURL(url),1500);tell(strip?'Sprite strip exported':'PNG exported')},'image/png');return true;}
  function play(){if(state.playing){state.playing=false;root.clearInterval(state.timer);state.timer=null;q('[data-act="play"]').textContent='▶';return}if(state.frames.length<2){tell('Add at least 2 frames');return}state.playing=true;q('[data-act="play"]').textContent='❚❚';state.timer=root.setInterval(()=>{state.active=(state.active+1)%state.frames.length;renderAll()},Math.round(1000/state.fps));}
  const toolActions={auto:runAutoRepair,background:()=>applyMutation('Background removed',c=>removeUniformBackground(c)),edges:()=>applyMutation('Edges cleaned',c=>cleanEdges(c)),pivot:()=>applyMutation('Asset centered',c=>centerOpaque(c)),scale:()=>applyMutation('Scale normalized',c=>normalizeOpaque(c)),seams:()=>applyMutation('Tile seams matched',c=>repairSeams(c))};

  host.addEventListener('click',async event=>{const action=event.target.closest('[data-act]')?.dataset.act,tool=event.target.closest('[data-tool]')?.dataset.tool,frame=event.target.closest('[data-frame]')?.dataset.frame;if(frame!=null){state.active=clamp(Number(frame)||0,0,state.frames.length-1);renderAll();return}if(tool){qa('.kar-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));await toolActions[tool]?.();return}if(!action)return;if(action==='open'||action==='add')fileInput.click();else if(action==='reset')reset();else if(action==='undo')undo();else if(action==='export')exportAsset();else if(action==='play')play();});
  fileInput.addEventListener('change',async()=>{try{await openFiles(fileInput.files)}catch(error){console.error('[Kelo Asset Repairer] import failed',error);setStatus('idle','import failed');tell('Could not read this image')}finally{fileInput.value=''}});
  qa('[data-layer]').forEach(input=>input.addEventListener('change',renderPreview));
  const drop=q('[data-drop]');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>openFiles(e.dataTransfer?.files).catch(console.error));
  const resize=()=>renderPreview();root.addEventListener?.('resize',resize,{passive:true});

  const api=Object.freeze({element:host,openFiles,runAutoRepair,exportAsset,undo,reset,getState:()=>({mounted:host.isConnected,status:state.status,progress:state.progress,frames:state.frames.length,activeFrame:state.active,ready:Boolean(current())}),destroy(){if(state.destroyed)return;state.destroyed=true;root.clearInterval?.(state.timer);root.clearTimeout?.(toastTimer);root.removeEventListener?.('resize',resize);host.remove();if(root.KELO_ASSET_REPAIRER===api)delete root.KELO_ASSET_REPAIRER;}});
  root.KELO_ASSET_REPAIRER=api;setProgress(0,'Waiting for asset');renderAll();return api;
}

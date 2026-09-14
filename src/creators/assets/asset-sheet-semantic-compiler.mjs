/* KELO-INDEX
 * area: CREATORS / ASSET SHEET SEMANTIC COMPILER
 * owner: Kelo Creator Asset Bridge
 * owns: deterministic road semantics, topology, join metadata, de-grid analysis and atlas edge extrusion
 * does-not-own: remote AI calls, persistent bytes, catalog registration or map placement authority
 * public-api: analyzeSemanticAssetPixels(), enrichAssetSheetAnalysis(), buildRoadCompatibilityMatrix(), scoreAssetSeam(), periodicityScore(), selectDeterministicVariant(), extrudeRgbaEdges(), planMacroRoadSegments(), buildSplineRoadPlan()
 * online: no; pure local pixel/math analysis
 */

export const ASSET_SEMANTIC_COMPILER_VERSION = 'kelo-asset-semantic-compiler-v2.0.0';
export const ROAD_BITS = Object.freeze({N:1, E:2, S:4, W:8});
const SIDES = ['N','E','S','W'];
const OPPOSITE = Object.freeze({N:'S', E:'W', S:'N', W:'E'});
const TANGENT = Object.freeze({N:[0,-1], E:[1,0], S:[0,1], W:[-1,0]});
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const round = (v,d=3) => { const p = 10 ** d; return Math.round(v*p)/p; };
const indexOf = (x,y,w) => y*w+x;

function dimensions(width,height,length,channels=1){
  const w=Math.max(1,Math.round(Number(width)||0)), h=Math.max(1,Math.round(Number(height)||0));
  if (!length || length < w*h*channels) throw new Error('SEMANTIC_PIXELS_INVALID');
  return {width:w,height:h};
}

export function alphaBinaryMask(rgba,width,height,{alphaThreshold=16}={}){
  const d=dimensions(width,height,rgba?.length,4), out=new Uint8Array(d.width*d.height);
  for(let i=0;i<out.length;i++) out[i]=rgba[i*4+3] > alphaThreshold ? 1 : 0;
  return {width:d.width,height:d.height,data:out};
}

export function dilateMask(mask,width,height,radius=1){
  dimensions(width,height,mask?.length); const r=clamp(Math.round(radius)||0,0,8), out=new Uint8Array(mask.length);
  if(!r) return new Uint8Array(mask);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    let on=0;
    for(let dy=-r;dy<=r&&!on;dy++) for(let dx=-r;dx<=r;dx++){
      const xx=x+dx, yy=y+dy;
      if(xx>=0&&yy>=0&&xx<width&&yy<height&&mask[indexOf(xx,yy,width)]){on=1;break;}
    }
    out[indexOf(x,y,width)]=on;
  }
  return out;
}

export function erodeMask(mask,width,height,radius=1){
  dimensions(width,height,mask?.length); const r=clamp(Math.round(radius)||0,0,8), out=new Uint8Array(mask.length);
  if(!r) return new Uint8Array(mask);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    let on=1;
    for(let dy=-r;dy<=r&&on;dy++) for(let dx=-r;dx<=r;dx++){
      const xx=x+dx, yy=y+dy;
      if(xx<0||yy<0||xx>=width||yy>=height||!mask[indexOf(xx,yy,width)]){on=0;break;}
    }
    out[indexOf(x,y,width)]=on;
  }
  return out;
}

export function closeMask(mask,width,height,radius=1){ return erodeMask(dilateMask(mask,width,height,radius),width,height,radius); }

export function connectedComponents(mask,width,height,{minArea=1}={}){
  dimensions(width,height,mask?.length); const seen=new Uint8Array(mask.length), result=[], queueX=new Int32Array(mask.length), queueY=new Int32Array(mask.length);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const start=indexOf(x,y,width); if(!mask[start]||seen[start]) continue;
    let head=0,tail=0,area=0,minX=x,maxX=x,minY=y,maxY=y; queueX[tail]=x;queueY[tail++]=y;seen[start]=1;
    while(head<tail){
      const cx=queueX[head], cy=queueY[head++]; area++; minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=width||ny>=height) continue; const ni=indexOf(nx,ny,width); if(mask[ni]&&!seen[ni]){seen[ni]=1;queueX[tail]=nx;queueY[tail++]=ny;} }
    }
    if(area>=minArea) result.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area});
  }
  return result.sort((a,b)=>b.area-a.area);
}

export function distanceTransform(mask,width,height){
  dimensions(width,height,mask?.length); const inf=width+height+16, d=new Float32Array(mask.length); for(let i=0;i<d.length;i++) d[i]=mask[i]?inf:0;
  const s2=Math.SQRT2;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){ const i=indexOf(x,y,width); if(!d[i]) continue; let v=d[i]; if(x>0)v=Math.min(v,d[i-1]+1); if(y>0)v=Math.min(v,d[i-width]+1); if(x>0&&y>0)v=Math.min(v,d[i-width-1]+s2); if(x+1<width&&y>0)v=Math.min(v,d[i-width+1]+s2); d[i]=v; }
  for(let y=height-1;y>=0;y--) for(let x=width-1;x>=0;x--){ const i=indexOf(x,y,width); if(!d[i]) continue; let v=d[i]; if(x+1<width)v=Math.min(v,d[i+1]+1); if(y+1<height)v=Math.min(v,d[i+width]+1); if(x+1<width&&y+1<height)v=Math.min(v,d[i+width+1]+s2); if(x>0&&y+1<height)v=Math.min(v,d[i+width-1]+s2); d[i]=v; }
  return d;
}

function transitions8(mask,x,y,w){
  const p=[mask[indexOf(x,y-1,w)],mask[indexOf(x+1,y-1,w)],mask[indexOf(x+1,y,w)],mask[indexOf(x+1,y+1,w)],mask[indexOf(x,y+1,w)],mask[indexOf(x-1,y+1,w)],mask[indexOf(x-1,y,w)],mask[indexOf(x-1,y-1,w)]];
  let n=0,t=0; for(let i=0;i<8;i++){n+=p[i]; if(p[i]===0&&p[(i+1)%8]===1)t++;} return {p,n,t};
}

export function skeletonize(mask,width,height,{maxIterations=256}={}){
  dimensions(width,height,mask?.length); const out=new Uint8Array(mask); const remove=[];
  for(let iter=0;iter<maxIterations;iter++){
    let changed=false;
    for(let phase=0;phase<2;phase++){
      remove.length=0;
      for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++){
        const i=indexOf(x,y,width); if(!out[i]) continue; const {p,n,t}=transitions8(out,x,y,width); if(n<2||n>6||t!==1) continue;
        const a=phase===0 ? p[0]*p[2]*p[4] : p[0]*p[2]*p[6];
        const b=phase===0 ? p[2]*p[4]*p[6] : p[0]*p[4]*p[6];
        if(a===0&&b===0) remove.push(i);
      }
      if(remove.length){changed=true; for(const i of remove) out[i]=0;}
    }
    if(!changed) break;
  }
  return out;
}

function luminance(r,g,b){ return 0.2126*r+0.7152*g+0.0722*b; }
function saturation(r,g,b){ const max=Math.max(r,g,b),min=Math.min(r,g,b); return max? (max-min)/max : 0; }

export function deriveRoadMask(rgba,width,height,{alphaThreshold=16,morphRadius=1}={}){
  dimensions(width,height,rgba?.length,4); const alpha=alphaBinaryMask(rgba,width,height,{alphaThreshold}).data, candidate=new Uint8Array(width*height);
  let alphaCount=0,candidateCount=0;
  for(let i=0;i<candidate.length;i++){
    if(!alpha[i]) continue; alphaCount++;
    const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2], l=luminance(r,g,b), sat=saturation(r,g,b);
    const vegetation=(g>r*1.08 && g>b*1.10 && g-r>10) || (g>95 && r<105 && b<105 && g-r>18);
    const water=b>r*1.25 && b>g*1.08 && b-r>22;
    const plausible=!vegetation&&!water&&l>18&&(sat<0.72 || r>=g*0.88);
    if(plausible){candidate[i]=1;candidateCount++;}
  }
  let source=candidate;
  const candidateRatio=candidateCount/Math.max(1,alphaCount);
  if(candidateRatio<0.12||candidateRatio>0.92) source=alpha;
  const closed=closeMask(source,width,height,morphRadius);
  const components=connectedComponents(closed,width,height,{minArea:Math.max(3,Math.round(width*height*0.003))});
  if(!components.length) return {mask:closed,confidence:0,source:candidateRatio<0.12||candidateRatio>0.92?'alpha-fallback':'color',candidateRatio};
  const keep=new Uint8Array(closed.length), minKeep=Math.max(components[0].area*0.12,width*height*0.002);
  for(const c of components.filter(c=>c.area>=minKeep)) for(let y=c.y;y<c.y+c.h;y++) for(let x=c.x;x<c.x+c.w;x++){ const i=indexOf(x,y,width); if(closed[i])keep[i]=1; }
  const coverage=keep.reduce((s,v)=>s+v,0)/(width*height);
  const confidence=clamp(0.38 + Math.min(0.28,components[0].area/(width*height)) + (candidateRatio>=0.12&&candidateRatio<=0.92?0.18:0) + (coverage>0.08&&coverage<0.75?0.12:0),0,0.96);
  return {mask:keep,confidence:round(confidence),source:source===alpha?'alpha-fallback':'color',candidateRatio:round(candidateRatio)};
}

function edgeRun(mask,width,height,side,bandDepth){
  const length=(side==='N'||side==='S')?width:height, counts=new Float32Array(length), depth=Math.max(1,Math.min(side==='N'||side==='S'?height:width,bandDepth));
  for(let p=0;p<length;p++){
    let count=0;
    for(let d=0;d<depth;d++){
      const x=side==='W'?d:side==='E'?width-1-d:p, y=side==='N'?d:side==='S'?height-1-d:p;
      count+=mask[indexOf(x,y,width)];
    }
    counts[p]=count/depth;
  }
  let bestStart=-1,bestEnd=-1,start=-1;
  for(let p=0;p<=length;p++){
    const active=p<length&&counts[p]>=0.34;
    if(active&&start<0)start=p;
    if((!active||p===length)&&start>=0){const end=p-1;if(bestStart<0||end-start>bestEnd-bestStart){bestStart=start;bestEnd=end;}start=-1;}
  }
  if(bestStart<0) return null;
  const span=bestEnd-bestStart+1, fill=Array.from(counts.slice(bestStart,bestEnd+1)).reduce((a,b)=>a+b,0)/span;
  return {start:bestStart,end:bestEnd,span,center:(bestStart+bestEnd)/2,fill};
}

export function detectRoadSockets(mask,width,height,{edgeBandRatio=0.12,minSpanRatio=0.08,mergeDepthRatio=0.22}={}){
  dimensions(width,height,mask?.length); const sockets=[];
  for(const side of SIDES){
    const perpendicular=(side==='N'||side==='S')?width:height, parallel=(side==='N'||side==='S')?height:width;
    const run=edgeRun(mask,width,height,side,Math.max(2,Math.round(parallel*edgeBandRatio)));
    if(!run||run.span<Math.max(2,Math.round(perpendicular*minSpanRatio))) continue;
    const center=side==='N'?[run.center,0]:side==='S'?[run.center,height-1]:side==='W'?[0,run.center]:[width-1,run.center];
    const widthPx=run.span, confidence=clamp(0.45+run.fill*0.35+Math.min(0.18,widthPx/perpendicular),0,0.99);
    sockets.push({side,center:[round(center[0],1),round(center[1],1)],width:widthPx,tangent:TANGENT[side],type:'road',mergeDepth:Math.max(2,Math.round(parallel*mergeDepthRatio)),confidence:round(confidence)});
  }
  return sockets;
}

export function topologyFromMask(neighborMask){
  const count=SIDES.reduce((n,s)=>n+((neighborMask&ROAD_BITS[s])?1:0),0);
  if(count===4)return 'cross'; if(count===3)return 't'; if(count===2){const opposite=((neighborMask&ROAD_BITS.N)&&(neighborMask&ROAD_BITS.S))||((neighborMask&ROAD_BITS.E)&&(neighborMask&ROAD_BITS.W));return opposite?'straight':'corner';} if(count===1)return 'end'; return 'filler';
}

function bitmaskFromSockets(sockets){ return sockets.reduce((mask,s)=>mask|ROAD_BITS[s.side],0); }
function boundsOfMask(mask,width,height){
  let minX=width,minY=height,maxX=-1,maxY=-1,count=0; for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(!mask[indexOf(x,y,width)])continue;count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return count?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,count}:null;
}

function logicalFootprint(bounds,width,height,roadWidth){
  if(!bounds) return {w:1,h:1,cells:[[0,0]],unit:'road-width'}; const unit=Math.max(1,roadWidth||Math.min(width,height));
  const w=Math.max(1,Math.round(bounds.w/unit)), h=Math.max(1,Math.round(bounds.h/unit)), cells=[]; for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells.push([x,y]);
  return {w,h,cells,unit:'road-width'};
}

function mergeZonesFromSockets(sockets,width,height){
  return sockets.map(s=>{
    const depth=s.mergeDepth, half=Math.max(1,Math.round(s.width/2));
    if(s.side==='N') return {side:s.side,x:clamp(Math.round(s.center[0])-half,0,width),y:0,w:Math.min(width,s.width),h:Math.min(height,depth)};
    if(s.side==='S') return {side:s.side,x:clamp(Math.round(s.center[0])-half,0,width),y:Math.max(0,height-depth),w:Math.min(width,s.width),h:Math.min(height,depth)};
    if(s.side==='W') return {side:s.side,x:0,y:clamp(Math.round(s.center[1])-half,0,height),w:Math.min(width,depth),h:Math.min(height,s.width)};
    return {side:s.side,x:Math.max(0,width-depth),y:clamp(Math.round(s.center[1])-half,0,height),w:Math.min(width,depth),h:Math.min(height,s.width)};
  });
}

function bridgeUnderlaysFromSockets(sockets){
  return sockets.map(s=>({side:s.side,center:s.center.slice(),width:Math.max(2,Math.round(s.width*0.9)),depth:Math.max(2,Math.round(s.mergeDepth*1.25)),material:'sample-road-core',blend:'feather',z:'under-road'}));
}

export function analyzeRoadSemanticsFromMask(mask,width,height,{confidence=1,source='provided-mask'}={}){
  dimensions(width,height,mask?.length); const cleaned=closeMask(mask,width,height,1), distance=distanceTransform(cleaned,width,height), skeleton=skeletonize(cleaned,width,height), sockets=detectRoadSockets(cleaned,width,height), neighborMask=bitmaskFromSockets(sockets), topology=topologyFromMask(neighborMask), bounds=boundsOfMask(cleaned,width,height);
  let maxDistance=0; for(const v of distance)maxDistance=Math.max(maxDistance,v); const socketWidths=sockets.map(s=>s.width).sort((a,b)=>a-b), roadWidth=socketWidths.length?socketWidths[Math.floor(socketWidths.length/2)]:Math.max(1,Math.round(maxDistance*2));
  const sideConfidence=sockets.length?sockets.reduce((s,v)=>s+v.confidence,0)/sockets.length:0;
  const areaRatio=(bounds?.count||0)/(width*height), topologyConfidence=sockets.length?clamp(0.48+Math.min(0.3,sockets.length*0.08)+Math.min(0.15,areaRatio),0,0.96):0;
  const compilerConfidence=round(clamp(confidence*0.35+sideConfidence*0.4+topologyConfidence*0.25,0,0.99));
  return {
    kind:'road-semantics',version:ASSET_SEMANTIC_COMPILER_VERSION,source,neighborMask,topology,sockets,roadWidth,
    visualBounds:bounds?{x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h}:{x:0,y:0,w:width,h:height},
    logicalFootprint:logicalFootprint(bounds,width,height,roadWidth),
    mergeZones:mergeZonesFromSockets(sockets,width,height),bridgeUnderlays:bridgeUnderlaysFromSockets(sockets),
    rotationSafe:true,compilerConfidence,metrics:{areaRatio:round(areaRatio),maxDistance:round(maxDistance),skeletonPixels:skeleton.reduce((s,v)=>s+v,0)}
  };
}

export function analyzeSemanticAssetPixels(rgba,width,height,options={}){
  const road=deriveRoadMask(rgba,width,height,options), semantics=analyzeRoadSemanticsFromMask(road.mask,width,height,{confidence:road.confidence,source:road.source});
  const roadLike=semantics.sockets.length>=1 && semantics.compilerConfidence>=0.5 && semantics.metrics.areaRatio>=0.025;
  return {...semantics,kind:roadLike?'road-semantics':'generic-semantics',roadLike,roadMaskConfidence:road.confidence,candidateRatio:road.candidateRatio};
}

function cropRgba(rgba,sourceWidth,rect,alphaMask=null){
  const out=new Uint8ClampedArray(rect.w*rect.h*4); for(let y=0;y<rect.h;y++)for(let x=0;x<rect.w;x++){
    const si=((rect.y+y)*sourceWidth+rect.x+x)*4, di=(y*rect.w+x)*4; out[di]=rgba[si];out[di+1]=rgba[si+1];out[di+2]=rgba[si+2];out[di+3]=alphaMask?alphaMask[(rect.y+y)*sourceWidth+rect.x+x]:rgba[si+3];
  } return out;
}

export function enrichAssetSheetAnalysis(baseAnalysis,rgba,{roadConfidenceThreshold=0.68,periodicity=true,...options}={}){
  if(!baseAnalysis?.assets||!rgba) throw new Error('BASE_ASSET_ANALYSIS_REQUIRED');
  const assets=baseAnalysis.assets.map(asset=>{
    const rect=asset.sourceRect, pixels=cropRgba(rgba,baseAnalysis.width,rect,baseAnalysis.alphaMask||null), semantic=analyzeSemanticAssetPixels(pixels,rect.w,rect.h,options);
    const enriched={...asset,semantic,logicalFootprint:semantic.logicalFootprint,join:{mergeZones:semantic.mergeZones,bridgeUnderlays:semantic.bridgeUnderlays,normalizedRoadWidth:semantic.roadWidth},rotationSafe:semantic.rotationSafe,compilerConfidence:Math.max(asset.classification?.confidence||0,semantic.compilerConfidence)};
    if(semantic.roadLike&&semantic.compilerConfidence>=roadConfidenceThreshold){enriched.family='road-piece';enriched.category='environment/road';enriched.layer='ground';enriched.classification={family:'road-piece',category:'environment/road',confidence:semantic.compilerConfidence,needsReview:semantic.compilerConfidence<0.82,rationale:`road topology=${semantic.topology} mask=${semantic.neighborMask}`};}
    return enriched;
  });
  const result={...baseAnalysis,version:`${baseAnalysis.version}+semantic-v2`,semanticCompiler:ASSET_SEMANTIC_COMPILER_VERSION,assets};
  if(periodicity) result.terrainDiagnostics={periodicityScore:periodicityScore(rgba,baseAnalysis.width,baseAnalysis.height),recommendation:'use on terrain/base candidates; values >=0.55 require de-grid variants/macrolayer'};
  result.roadCompatibility=buildRoadCompatibilityMatrix(assets.filter(a=>a.semantic?.roadLike));
  if(baseAnalysis.alphaMask) Object.defineProperty(result,'alphaMask',{value:baseAnalysis.alphaMask,enumerable:false,configurable:false});
  return result;
}

export function areRoadSocketsCompatible(a,b,{widthTolerance=0.35}={}){
  if(!a||!b||OPPOSITE[a.side]!==b.side||a.type!==b.type)return false; const max=Math.max(a.width,b.width,1); return Math.abs(a.width-b.width)/max<=widthTolerance;
}

export function buildRoadCompatibilityMatrix(assets,{widthTolerance=0.35}={}){
  const matrix={}; for(const a of assets){matrix[a.assetId||a.id]={}; for(const b of assets){const pairs=[]; for(const sa of a.semantic?.sockets||[])for(const sb of b.semantic?.sockets||[])if(areRoadSocketsCompatible(sa,sb,{widthTolerance}))pairs.push(`${sa.side}:${sb.side}`); matrix[a.assetId||a.id][b.assetId||b.id]={compatible:pairs.length>0,pairs};}}
  return matrix;
}

function edgeSample(rgba,width,height,side,depth=2){
  const values=[]; const d=Math.max(1,Math.min(depth,side==='N'||side==='S'?height:width));
  if(side==='N'||side==='S'){for(let x=0;x<width;x++)for(let k=0;k<d;k++){const y=side==='N'?k:height-1-k,i=(y*width+x)*4;values.push([luminance(rgba[i],rgba[i+1],rgba[i+2]),rgba[i+3]]);}}
  else{for(let y=0;y<height;y++)for(let k=0;k<d;k++){const x=side==='W'?k:width-1-k,i=(y*width+x)*4;values.push([luminance(rgba[i],rgba[i+1],rgba[i+2]),rgba[i+3]]);}}
  return values;
}

export function scoreAssetSeam(aRgba,aWidth,aHeight,aSide,bRgba,bWidth,bHeight,bSide,{depth=2}={}){
  const a=edgeSample(aRgba,aWidth,aHeight,aSide,depth), b=edgeSample(bRgba,bWidth,bHeight,bSide,depth), n=Math.min(a.length,b.length); if(!n)return 1;
  let diff=0; for(let i=0;i<n;i++){const bi=Math.round(i*(b.length-1)/Math.max(1,n-1)); diff+=Math.abs(a[i][0]-b[bi][0])/255*0.78+Math.abs(a[i][1]-b[bi][1])/255*0.22;}
  return round(clamp(diff/n,0,1));
}

function graySamples(rgba,width,height,step=1){ const out=new Float32Array(Math.ceil(width/step)*Math.ceil(height/step)); let k=0; for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const i=(y*width+x)*4;out[k++]=rgba[i+3]<16?0:luminance(rgba[i],rgba[i+1],rgba[i+2]);} return {data:out,width:Math.ceil(width/step),height:Math.ceil(height/step)}; }
function correlationAt(gray,width,height,dx,dy){let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;for(let y=0;y<height-dy;y++)for(let x=0;x<width-dx;x++){const a=gray[indexOf(x,y,width)],b=gray[indexOf(x+dx,y+dy,width)];n++;sa+=a;sb+=b;saa+=a*a;sbb+=b*b;sab+=a*b;}if(n<8)return 0;const num=n*sab-sa*sb, den=Math.sqrt(Math.max(1e-9,(n*saa-sa*sa)*(n*sbb-sb*sb)));return den?num/den:0;}

export function periodicityScore(rgba,width,height,{maxShiftRatio=0.5,sampleStep=1}={}){
  dimensions(width,height,rgba?.length,4); const sampled=graySamples(rgba,width,height,Math.max(1,Math.round(sampleStep))), w=sampled.width,h=sampled.height, maxX=Math.max(2,Math.floor(w*maxShiftRatio)),maxY=Math.max(2,Math.floor(h*maxShiftRatio));
  let best=0,bestShift=null; const minShift=2;
  for(let dx=minShift;dx<=maxX;dx++){const c=correlationAt(sampled.data,w,h,dx,0);if(c>best){best=c;bestShift=[dx*sampleStep,0];}}
  for(let dy=minShift;dy<=maxY;dy++){const c=correlationAt(sampled.data,w,h,0,dy);if(c>best){best=c;bestShift=[0,dy*sampleStep];}}
  const score=round(clamp((best-0.18)/0.82,0,1)); return {score,bestCorrelation:round(best),shift:bestShift,status:score>=0.55?'FAIL':score>=0.35?'WARN':'PASS'};
}

export function stableHash(...parts){ let h=2166136261>>>0; const text=parts.join('|'); for(let i=0;i<text.length;i++){h^=text.charCodeAt(i); h=Math.imul(h,16777619)>>>0;} return h>>>0; }
export function selectDeterministicVariant(variants,{worldSeed='kelo',x=0,y=0,neighborIds=[]}={}){
  const pool=(variants||[]).filter(v=>!neighborIds.includes(v.id)); const choices=pool.length?pool:(variants||[]); if(!choices.length)return null; const weighted=[]; let total=0; for(const v of choices){const weight=Math.max(0.001,Number(v.weight)||1);total+=weight;weighted.push([v,total]);} let roll=(stableHash(worldSeed,x,y)%1000000)/1000000*total; for(const [v,end] of weighted)if(roll<end)return v; return weighted.at(-1)[0];
}

export function extrudeRgbaEdges(rgba,width,height,padding=2){
  dimensions(width,height,rgba?.length,4); const p=clamp(Math.round(padding)||0,0,32), outW=width+p*2,outH=height+p*2,out=new Uint8ClampedArray(outW*outH*4);
  for(let y=-p;y<height+p;y++)for(let x=-p;x<width+p;x++){const sx=clamp(x,0,width-1),sy=clamp(y,0,height-1),si=(sy*width+sx)*4,di=((y+p)*outW+x+p)*4;out.set(rgba.subarray(si,si+4),di);} return {data:out,width:outW,height:outH,padding:p,uvInset:{x:p,y:p,w:width,h:height}};
}

export function planMacroRoadSegments(length,sizes=[4,3,2,1]){ let remaining=Math.max(0,Math.round(length)),plan=[]; const ordered=[...new Set(sizes.map(v=>Math.max(1,Math.round(v))))].sort((a,b)=>b-a); for(const size of ordered)while(remaining>=size){plan.push(size);remaining-=size;} if(remaining)plan.push(...Array(remaining).fill(1)); return plan; }
export function buildSplineRoadPlan(points,{width=1}={}){ const clean=(points||[]).map(p=>[Number(p[0])||0,Number(p[1])||0]); const segments=[]; for(let i=0;i<clean.length-1;i++){const a=clean[i],b=clean[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;segments.push({from:a,to:b,length:round(length),tangent:[round(dx/length),round(dy/length)],width});} return {kind:'spline-road-plan',points:clean,segments,width,intersectionPolicy:'sprite-special',renderPolicy:'continuous-strip'}; }

export function recommendJoinRepair(seamScore,{widthMismatch=0}={}){ if(seamScore<0.18&&widthMismatch<0.12)return {action:'accept',overlap:0,bridge:false,fade:false}; if(seamScore<0.42)return {action:'soft-blend',overlap:8,bridge:true,fade:true}; return {action:'hard-repair',overlap:16,bridge:true,fade:true,normalizeWidth:true}; }

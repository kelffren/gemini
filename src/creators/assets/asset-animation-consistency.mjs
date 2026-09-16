/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: ANIMATION FRAME CONSISTENCY FLICKER SILHOUETTE ANCHOR PALETTE ALPHA
 * purpose: measure temporal consistency across decoded sprite frames so authoring/delivery transforms cannot silently introduce flicker or anchor drift
 * public-api: analyzeAnimationConsistency(), judgeAnimationConsistency()
 * state-owned: none; pure build-time analysis
 * online: N/A; creator/build-time capability
 * do-not: infer gameplay timing, mutate pixels, or invent universal animation thresholds
 */

const round=(value,digits=6)=>Number(Number(value||0).toFixed(digits));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function rgbaKey(r,g,b,a){return (((r<<24)>>>0)|(g<<16)|(b<<8)|a)>>>0;}
function validateFrame(frame,index){
  const width=Math.round(Number(frame?.width)||0),height=Math.round(Number(frame?.height)||0),rgba=frame?.rgba;
  if(!width||!height||!Buffer.isBuffer(rgba)||rgba.length!==width*height*4)throw new Error(`ASSET_ANIMATION_FRAME_INVALID:${index}`);
  return {id:String(frame.id??index),width,height,rgba,anchor:frame.anchor?{x:Number(frame.anchor.x),y:Number(frame.anchor.y)}:null};
}

function frameFeatures(frame,alphaThreshold){
  let visible=0,alphaMass=0,sumX=0,sumY=0,minX=frame.width,minY=frame.height,maxX=-1,maxY=-1;
  const colors=new Set();
  for(let y=0;y<frame.height;y+=1){
    for(let x=0;x<frame.width;x+=1){
      const offset=(y*frame.width+x)*4,a=frame.rgba[offset+3];
      if(a<=alphaThreshold)continue;
      visible+=1;const weight=a/255;alphaMass+=weight;sumX+=x*weight;sumY+=y*weight;
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      if(colors.size<=8192)colors.add(rgbaKey(frame.rgba[offset],frame.rgba[offset+1],frame.rgba[offset+2],a));
    }
  }
  const bbox=visible?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:{x:0,y:0,w:0,h:0};
  return {visiblePixels:visible,alphaCoverage:visible/(frame.width*frame.height),alphaMass,centroid:alphaMass?{x:sumX/alphaMass,y:sumY/alphaMass}:{x:0,y:0},bbox,colors};
}

function maskIoU(a,b,alphaThreshold){
  if(a.width!==b.width||a.height!==b.height)return null;
  let intersection=0,union=0;
  for(let i=3;i<a.rgba.length;i+=4){const av=a.rgba[i]>alphaThreshold,bv=b.rgba[i]>alphaThreshold;if(av||bv)union+=1;if(av&&bv)intersection+=1;}
  return union?intersection/union:1;
}
function paletteJaccard(a,b){
  if(!a.size&&!b.size)return 1;let intersection=0;for(const value of a)if(b.has(value))intersection+=1;return intersection/Math.max(1,a.size+b.size-intersection);
}
function median(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return 0;const m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;}
function robustOutliers(values,z=4){
  const center=median(values),deviations=values.map(v=>Math.abs(v-center)),mad=median(deviations);
  if(!mad)return {median:center,mad:0,indexes:[]};
  const indexes=[];values.forEach((value,index)=>{if((0.6745*Math.abs(value-center))/mad>z)indexes.push(index);});
  return {median:center,mad,indexes};
}

export function analyzeAnimationConsistency(inputFrames=[],options={}){
  if(!Array.isArray(inputFrames)||inputFrames.length<2)throw new Error('ASSET_ANIMATION_REQUIRES_TWO_FRAMES');
  const alphaThreshold=Math.max(0,Math.min(254,Math.round(options.alphaThreshold??0))),frames=inputFrames.map(validateFrame),features=frames.map(frame=>frameFeatures(frame,alphaThreshold)),pairs=[];
  for(let i=0;i<frames.length-1;i+=1){
    const a=frames[i],b=frames[i+1],fa=features[i],fb=features[i+1],sameDimensions=a.width===b.width&&a.height===b.height;
    pairs.push({
      from:a.id,to:b.id,index:i,sameDimensions,
      maskIoU:sameDimensions?round(maskIoU(a,b,alphaThreshold)):null,
      alphaCoverageDelta:round(Math.abs(fa.alphaCoverage-fb.alphaCoverage)),
      alphaMassDeltaRatio:round(Math.abs(fa.alphaMass-fb.alphaMass)/Math.max(1,fa.alphaMass,fb.alphaMass)),
      centroidDistance:round(distance(fa.centroid,fb.centroid)),
      bboxAreaDeltaRatio:round(Math.abs(fa.bbox.w*fa.bbox.h-fb.bbox.w*fb.bbox.h)/Math.max(1,fa.bbox.w*fa.bbox.h,fb.bbox.w*fb.bbox.h)),
      paletteJaccard:round(paletteJaccard(fa.colors,fb.colors)),
      anchorDrift:a.anchor&&b.anchor?round(distance(a.anchor,b.anchor)):null
    });
  }
  const coverage=features.map(feature=>feature.alphaCoverage),coverageOutliers=robustOutliers(coverage,Number(options.outlierZ??4));
  const mass=features.map(feature=>feature.alphaMass),massOutliers=robustOutliers(mass,Number(options.outlierZ??4));
  return {
    version:'kelo-animation-consistency-v1',frameCount:frames.length,alphaThreshold,
    dimensions:[...new Set(frames.map(frame=>`${frame.width}x${frame.height}`))],
    frames:frames.map((frame,index)=>({id:frame.id,width:frame.width,height:frame.height,anchor:frame.anchor,visiblePixels:features[index].visiblePixels,alphaCoverage:round(features[index].alphaCoverage),alphaMass:round(features[index].alphaMass),centroid:{x:round(features[index].centroid.x),y:round(features[index].centroid.y)},bbox:features[index].bbox,visibleColors:features[index].colors.size})),
    pairs,
    temporal:{
      minMaskIoU:round(Math.min(...pairs.map(pair=>pair.maskIoU??1))),
      maxAlphaCoverageDelta:round(Math.max(...pairs.map(pair=>pair.alphaCoverageDelta))),
      maxAlphaMassDeltaRatio:round(Math.max(...pairs.map(pair=>pair.alphaMassDeltaRatio))),
      maxCentroidDistance:round(Math.max(...pairs.map(pair=>pair.centroidDistance))),
      minPaletteJaccard:round(Math.min(...pairs.map(pair=>pair.paletteJaccard))),
      maxAnchorDrift:round(Math.max(0,...pairs.map(pair=>pair.anchorDrift??0))),
      alphaCoverageOutlierFrames:coverageOutliers.indexes.map(index=>frames[index].id),
      alphaMassOutlierFrames:massOutliers.indexes.map(index=>frames[index].id)
    }
  };
}

export function judgeAnimationConsistency(report,limits={}){
  if(!report?.pairs)throw new Error('ASSET_ANIMATION_REPORT_REQUIRED');
  const reasons=[];
  if(limits.requireSameDimensions!==false&&report.dimensions.length!==1)reasons.push('dimension-drift');
  const checks=[
    ['minMaskIoU',report.temporal.minMaskIoU,(actual,limit)=>actual>=limit,'silhouette-iou-low'],
    ['maxAlphaCoverageDelta',report.temporal.maxAlphaCoverageDelta,(actual,limit)=>actual<=limit,'alpha-coverage-jump'],
    ['maxAlphaMassDeltaRatio',report.temporal.maxAlphaMassDeltaRatio,(actual,limit)=>actual<=limit,'alpha-mass-jump'],
    ['maxCentroidDistance',report.temporal.maxCentroidDistance,(actual,limit)=>actual<=limit,'centroid-jump'],
    ['minPaletteJaccard',report.temporal.minPaletteJaccard,(actual,limit)=>actual>=limit,'palette-churn'],
    ['maxAnchorDrift',report.temporal.maxAnchorDrift,(actual,limit)=>actual<=limit,'anchor-drift']
  ];
  for(const[key,actual,test,reason]of checks){const limit=Number(limits[key]);if(Number.isFinite(limit)&&!test(actual,limit))reasons.push(reason);}
  if(limits.rejectRobustOutliers===true&&(report.temporal.alphaCoverageOutlierFrames.length||report.temporal.alphaMassOutlierFrames.length))reasons.push('temporal-outlier');
  return {pass:reasons.length===0,reasons,limits:{...limits}};
}

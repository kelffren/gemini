/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG QUALITY AGENT FIDELITY PSNR EDGE ALPHA BORDER SEAM PIXEL ART RENDER EXACT COMPOSITED
 * purpose: deterministic before/after judge with asset-class hard gates and alpha-aware render-composition evidence
 * public-api: evaluatePixelFidelity(), judgePixelFidelity()
 * state-owned: none
 * online: N/A; creator/build-time quality gate
 * reuse: lossless optimizer, adaptive palette search, codec tournament, DELIVERY variants
 * do-not: approve by file size alone or let a visual/LLM opinion override failed hard metrics
 */

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
function luminance(r,g,b){return(77*r+150*g+29*b)/256;}
function exactByteEquality(a,b){if(Buffer.isBuffer(a)&&Buffer.isBuffer(b))return a.equals(b);if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i+=1)if(a[i]!==b[i])return false;return true;}
function srgbToLinear8(value){const x=value/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;}
function linearToDisplayDelta(value){return Math.abs(value)*255;}

function compositeLinear(rgb,alpha,bg){
  const a=alpha/255;
  return [0,1,2].map(i=>srgbToLinear8(rgb[i])*a+srgbToLinear8(bg[i])*(1-a));
}
function exactMetrics(){return{comparable:true,exactPixels:true,renderExactPixels:true,changedPixels:0,changedPixelRatio:0,renderChangedPixels:0,renderChangedPixelRatio:0,hiddenTransparentRgbChangedPixels:0,hiddenTransparentRgbChangedRatio:0,meanAbsRgb:0,rmseRgb:0,psnrRgb:Infinity,maxRgbDelta:0,alphaChangedPixels:0,alphaChangedRatio:0,alphaMaxDelta:0,edgeMae:0,largeDeltaRatio:0,borderChangedPixels:0,borderChangedRatio:0,borderMeanAbsRgb:0,borderMaxRgbDelta:0,premultipliedMeanAbsRgb:0,compositedMeanAbsRgb:0,compositedMaxRgbDelta:0};}

export function evaluatePixelFidelity(originalRgba,candidateRgba,width,height){
  if(!originalRgba||!candidateRgba||originalRgba.length!==candidateRgba.length||originalRgba.length!==width*height*4)return{comparable:false,exactPixels:false,renderExactPixels:false,changedPixels:null,changedPixelRatio:1,renderChangedPixels:null,renderChangedPixelRatio:1,hiddenTransparentRgbChangedPixels:null,hiddenTransparentRgbChangedRatio:1,meanAbsRgb:Infinity,rmseRgb:Infinity,psnrRgb:0,maxRgbDelta:255,alphaChangedPixels:null,alphaChangedRatio:1,alphaMaxDelta:255,edgeMae:Infinity,largeDeltaRatio:1,borderChangedPixels:null,borderChangedRatio:1,borderMeanAbsRgb:Infinity,borderMaxRgbDelta:255,premultipliedMeanAbsRgb:Infinity,compositedMeanAbsRgb:Infinity,compositedMaxRgbDelta:255};
  const pixelCount=width*height;if(exactByteEquality(originalRgba,candidateRgba))return exactMetrics();
  let changedPixels=0,renderChangedPixels=0,hiddenTransparentRgbChangedPixels=0,alphaChangedPixels=0,alphaMaxDelta=0,maxRgbDelta=0,absRgb=0,squaredRgb=0,largeDeltaPixels=0,borderPixels=0,borderChangedPixels=0,borderAbsRgb=0,borderMaxRgbDelta=0,premulAbs=0,compositeAbs=0,compositeSamples=0,compositeMax=0;
  const staticBackgrounds=[[0,0,0],[255,255,255],[128,128,128]];
  for(let y=0;y<height;y+=1){for(let x=0;x<width;x+=1){const pixel=y*width+x,o=pixel*4,onBorder=x===0||y===0||x===width-1||y===height-1;let changed=false,pixelRgbMax=0,pixelRgbAbs=0;for(let c=0;c<3;c+=1){const delta=Math.abs(originalRgba[o+c]-candidateRgba[o+c]);absRgb+=delta;squaredRgb+=delta*delta;pixelRgbAbs+=delta;if(delta>maxRgbDelta)maxRgbDelta=delta;if(delta>pixelRgbMax)pixelRgbMax=delta;if(delta)changed=true;const op=originalRgba[o+c]*(originalRgba[o+3]/255),cp=candidateRgba[o+c]*(candidateRgba[o+3]/255);premulAbs+=Math.abs(op-cp);}
    const oa=originalRgba[o+3],ca=candidateRgba[o+3],alphaDelta=Math.abs(oa-ca);if(alphaDelta){alphaChangedPixels+=1;changed=true;if(alphaDelta>alphaMaxDelta)alphaMaxDelta=alphaDelta;}
    const bothTransparent=oa===0&&ca===0,renderChanged=alphaDelta>0||(!bothTransparent&&pixelRgbMax>0);if(renderChanged)renderChangedPixels+=1;else if(bothTransparent&&pixelRgbMax>0)hiddenTransparentRgbChangedPixels+=1;
    const org=[originalRgba[o],originalRgba[o+1],originalRgba[o+2]],cand=[candidateRgba[o],candidateRgba[o+1],candidateRgba[o+2]],checker=((x>>3)+(y>>3))%2?[224,224,224]:[32,32,32],backgrounds=[...staticBackgrounds,checker];
    for(const bg of backgrounds){const a=compositeLinear(org,oa,bg),b=compositeLinear(cand,ca,bg);for(let c=0;c<3;c+=1){const delta=linearToDisplayDelta(a[c]-b[c]);compositeAbs+=delta;compositeSamples+=1;if(delta>compositeMax)compositeMax=delta;}}
    if(pixelRgbMax>12)largeDeltaPixels+=1;if(changed)changedPixels+=1;if(onBorder){borderPixels+=1;borderAbsRgb+=pixelRgbAbs;if(changed)borderChangedPixels+=1;if(pixelRgbMax>borderMaxRgbDelta)borderMaxRgbDelta=pixelRgbMax;}
  }}
  let edgeError=0,edgeCount=0;for(let y=0;y<height;y+=1){for(let x=0;x<width;x+=1){const o=(y*width+x)*4,oLum=luminance(originalRgba[o],originalRgba[o+1],originalRgba[o+2]),cLum=luminance(candidateRgba[o],candidateRgba[o+1],candidateRgba[o+2]);if(x+1<width){const n=o+4,oEdge=Math.abs(oLum-luminance(originalRgba[n],originalRgba[n+1],originalRgba[n+2])),cEdge=Math.abs(cLum-luminance(candidateRgba[n],candidateRgba[n+1],candidateRgba[n+2]));edgeError+=Math.abs(oEdge-cEdge);edgeCount+=1;}if(y+1<height){const n=o+width*4,oEdge=Math.abs(oLum-luminance(originalRgba[n],originalRgba[n+1],originalRgba[n+2])),cEdge=Math.abs(cLum-luminance(candidateRgba[n],candidateRgba[n+1],candidateRgba[n+2]));edgeError+=Math.abs(oEdge-cEdge);edgeCount+=1;}}}
  const meanAbsRgb=absRgb/Math.max(1,pixelCount*3),mseRgb=squaredRgb/Math.max(1,pixelCount*3),rmseRgb=Math.sqrt(mseRgb),psnrRgb=mseRgb===0?Infinity:10*Math.log10((255*255)/mseRgb);
  return{comparable:true,exactPixels:changedPixels===0,renderExactPixels:renderChangedPixels===0,changedPixels,changedPixelRatio:changedPixels/Math.max(1,pixelCount),renderChangedPixels,renderChangedPixelRatio:renderChangedPixels/Math.max(1,pixelCount),hiddenTransparentRgbChangedPixels,hiddenTransparentRgbChangedRatio:hiddenTransparentRgbChangedPixels/Math.max(1,pixelCount),meanAbsRgb,rmseRgb,psnrRgb,maxRgbDelta,alphaChangedPixels,alphaChangedRatio:alphaChangedPixels/Math.max(1,pixelCount),alphaMaxDelta,edgeMae:edgeError/Math.max(1,edgeCount),largeDeltaRatio:largeDeltaPixels/Math.max(1,pixelCount),borderChangedPixels,borderChangedRatio:borderChangedPixels/Math.max(1,borderPixels),borderMeanAbsRgb:borderAbsRgb/Math.max(1,borderPixels*3),borderMaxRgbDelta,premultipliedMeanAbsRgb:premulAbs/Math.max(1,pixelCount*3),compositedMeanAbsRgb:compositeAbs/Math.max(1,compositeSamples),compositedMaxRgbDelta:compositeMax};
}

const POLICY_LIMITS={
  balanced:{minPsnrRgb:50,maxMeanAbsRgb:0.75,maxAlphaDelta:0,maxEdgeMae:0.55,maxLargeDeltaRatio:0.001,maxBorderMeanAbsRgb:0.9,maxBorderRgbDelta:18,maxCompositedMeanAbsRgb:0.55,maxCompositedRgbDelta:14},
  'pixel-art':{minPsnrRgb:58,maxMeanAbsRgb:0.28,maxAlphaDelta:0,maxEdgeMae:0.22,maxLargeDeltaRatio:0.00025,maxBorderMeanAbsRgb:0.35,maxBorderRgbDelta:8,maxCompositedMeanAbsRgb:0.18,maxCompositedRgbDelta:6},
  'ui-crisp':{minPsnrRgb:56,maxMeanAbsRgb:0.35,maxAlphaDelta:0,maxEdgeMae:0.25,maxLargeDeltaRatio:0.0003,maxBorderMeanAbsRgb:0.4,maxBorderRgbDelta:8,maxCompositedMeanAbsRgb:0.22,maxCompositedRgbDelta:6},
  'fx-alpha':{minPsnrRgb:49,maxMeanAbsRgb:0.9,maxAlphaDelta:0,maxEdgeMae:0.75,maxLargeDeltaRatio:0.0015,maxBorderMeanAbsRgb:1.2,maxBorderRgbDelta:24,maxCompositedMeanAbsRgb:0.7,maxCompositedRgbDelta:18},
  'seam-safe':{minPsnrRgb:60,maxMeanAbsRgb:0.20,maxAlphaDelta:0,maxEdgeMae:0.18,maxLargeDeltaRatio:0.0001,maxBorderMeanAbsRgb:0,maxBorderRgbDelta:0,maxCompositedMeanAbsRgb:0.12,maxCompositedRgbDelta:4}
};

export function judgePixelFidelity(metrics,policy='strict',overrides={}){
  if(!metrics?.comparable)return{pass:false,score:0,policy,reasons:['not-comparable']};
  if(policy==='strict')return{pass:metrics.exactPixels,score:metrics.exactPixels?1:0,policy,reasons:metrics.exactPixels?[]:['pixel-difference']};
  if(policy==='render-exact'){const pass=metrics.renderExactPixels===true&&metrics.alphaMaxDelta===0;return{pass,score:pass?1:0,policy,reasons:pass?[]:[...(metrics.alphaMaxDelta===0?[]:['alpha']),...(metrics.renderExactPixels?[]:['visible-pixel-difference'])],limits:{alphaExact:true,visibleRgbExact:true,hiddenTransparentRgbMayChange:true}};}
  const limits={...(POLICY_LIMITS[policy]||POLICY_LIMITS.balanced),...overrides},checks=[['psnr',metrics.psnrRgb>=limits.minPsnrRgb],['mean-rgb',metrics.meanAbsRgb<=limits.maxMeanAbsRgb],['alpha',metrics.alphaMaxDelta<=limits.maxAlphaDelta],['edges',metrics.edgeMae<=limits.maxEdgeMae],['large-delta',metrics.largeDeltaRatio<=limits.maxLargeDeltaRatio],['border-mean',metrics.borderMeanAbsRgb<=limits.maxBorderMeanAbsRgb],['border-max',metrics.borderMaxRgbDelta<=limits.maxBorderRgbDelta],['composited-mean',metrics.compositedMeanAbsRgb<=limits.maxCompositedMeanAbsRgb],['composited-max',metrics.compositedMaxRgbDelta<=limits.maxCompositedRgbDelta]],reasons=checks.filter(([,pass])=>!pass).map(([name])=>name);
  const psnrScore=metrics.psnrRgb===Infinity?1:clamp01((metrics.psnrRgb-35)/25),meanScore=clamp01(1-metrics.meanAbsRgb/Math.max(0.0001,limits.maxMeanAbsRgb*2)),edgeScore=clamp01(1-metrics.edgeMae/Math.max(0.0001,limits.maxEdgeMae*2)),alphaScore=metrics.alphaMaxDelta<=limits.maxAlphaDelta?1:0,largeDeltaScore=clamp01(1-metrics.largeDeltaRatio/Math.max(0.000001,limits.maxLargeDeltaRatio*2)),borderScore=limits.maxBorderRgbDelta===0?(metrics.borderMaxRgbDelta===0?1:0):clamp01(1-metrics.borderMeanAbsRgb/Math.max(0.0001,limits.maxBorderMeanAbsRgb*2)),compositeScore=clamp01(1-metrics.compositedMeanAbsRgb/Math.max(0.0001,limits.maxCompositedMeanAbsRgb*2));
  const score=0.22*psnrScore+0.17*meanScore+0.15*edgeScore+0.12*alphaScore+0.07*largeDeltaScore+0.12*borderScore+0.15*compositeScore;
  return{pass:reasons.length===0,score:Number(score.toFixed(6)),policy,reasons,limits};
}

/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: compare compiled RGBA output against a golden baseline without external services
 * public-api: scoreVisualRegression()
 */
const F=Object.freeze;
const clamp=v=>Math.max(0,Math.min(1,v));
export function scoreVisualRegression(actual,expected,{maxMeanDelta=2,maxChangedRatio=.01,channelThreshold=8}={}){
 const a=actual?.data||actual,b=expected?.data||expected;if(!a||!b||a.length!==b.length||a.length%4)throw new Error('ASSET_VISUAL_REGRESSION_INPUT_MISMATCH');
 let sum=0,max=0,changedPixels=0,alphaChanged=0;const pixels=a.length/4;
 for(let i=0;i<a.length;i+=4){let pixelChanged=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);sum+=d;max=Math.max(max,d);if(d>channelThreshold)pixelChanged=true;if(c===3&&d>channelThreshold)alphaChanged++;}if(pixelChanged)changedPixels++;}
 const meanChannelDelta=sum/a.length,changedRatio=changedPixels/Math.max(1,pixels),pass=meanChannelDelta<=maxMeanDelta&&changedRatio<=maxChangedRatio;
 return F({schema:'kelo-visual-regression-v1',pass,meanChannelDelta,maxChannelDelta:max,changedPixels,changedRatio,alphaChangedPixels:alphaChanged,score:clamp(1-(meanChannelDelta/Math.max(1,maxMeanDelta))*0.45-(changedRatio/Math.max(.0001,maxChangedRatio))*0.55),thresholds:F({maxMeanDelta,maxChangedRatio,channelThreshold})});
}

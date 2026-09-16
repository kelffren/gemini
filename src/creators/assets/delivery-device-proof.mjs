/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY QA
 * owner: Kelo Creator Asset Bridge
 * keys: IOS SAFARI DEVICE PROOF DECODE DRAW MEMORY PROMOTION
 * purpose: validate real-device evidence before any DELIVERY candidate can become runtime-authoritative
 * public-api: validateDeliveryDeviceProof()
 * state-owned: none
 * online: N/A; publish-time evidence contract
 */

function finite(value){return Number.isFinite(Number(value))?Number(value):null;}
export function validateDeliveryDeviceProof(proof,options={}){
  const reasons=[];
  if(!proof||typeof proof!=='object')return{pass:false,reasons:['missing-proof'],normalized:null};
  const platform=String(proof.platform||'').toLowerCase(),browser=String(proof.browser||'').toLowerCase(),device=String(proof.device||''),runs=Math.round(Number(proof.runs)||0),decodeP50Ms=finite(proof.decodeP50Ms),decodeP95Ms=finite(proof.decodeP95Ms),drawP50Ms=finite(proof.drawP50Ms),drawP95Ms=finite(proof.drawP95Ms),peakMemoryBytes=finite(proof.peakMemoryBytes),measuredAt=String(proof.measuredAt||'');
  if(platform!=='ios')reasons.push('platform-not-ios');if(browser!=='safari')reasons.push('browser-not-safari');if(!device)reasons.push('device-missing');if(runs<(options.minRuns??20))reasons.push('insufficient-runs');if(decodeP50Ms==null||decodeP95Ms==null)reasons.push('decode-metrics-missing');if(drawP50Ms==null||drawP95Ms==null)reasons.push('draw-metrics-missing');if(!measuredAt||Number.isNaN(Date.parse(measuredAt)))reasons.push('measured-at-invalid');if(decodeP50Ms!=null&&decodeP95Ms!=null&&decodeP50Ms>decodeP95Ms)reasons.push('decode-percentiles-invalid');if(drawP50Ms!=null&&drawP95Ms!=null&&drawP50Ms>drawP95Ms)reasons.push('draw-percentiles-invalid');
  const normalized={schema:'kelo-delivery-device-proof-v1',platform,browser,device,osVersion:String(proof.osVersion||''),browserVersion:String(proof.browserVersion||''),runs,decodeP50Ms,decodeP95Ms,drawP50Ms,drawP95Ms,peakMemoryBytes,measuredAt,source:String(proof.source||'real-device')};
  return{pass:reasons.length===0,reasons,normalized};
}

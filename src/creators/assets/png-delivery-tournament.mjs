/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG DELIVERY OXIPNG STRIP SAFE ALPHA RENDER EXACT METADATA
 * purpose: compete DELIVERY-only PNG transformations that may normalize hidden RGB or remove rendering-irrelevant metadata, while proving visible pixels/alpha and colour metadata remain safe
 * public-api: optimizePngDeliveryTournament()
 * state-owned: none; temporary files only
 * online: N/A; build/publish-time capability
 * do-not: use result as SOURCE/AUTHORING or accept a candidate that fails render-exact/metadata gates
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {decodePngRgba, optimizePngLossless} from './png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';
import {pngRenderMetadataFingerprint} from './png-render-metadata.mjs';

function commandAvailable(command) {
  const probe=spawnSync(command,['--version'],{stdio:'ignore'});
  return !probe.error || probe.error?.code!=='ENOENT';
}

function run(command,args,cwd) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout:10*60*1000});
  return {
    ok:!result.error&&result.status===0,
    status:result.status,
    signal:result.signal,
    stderr:String(result.stderr||'').slice(-4000),
    error:result.error?String(result.error.message||result.error):null
  };
}

function validate(buffer,original,sourceFingerprint,policy='render-exact') {
  try {
    const decoded=decodePngRgba(buffer);
    if(decoded.ihdr.width!==original.ihdr.width||decoded.ihdr.height!==original.ihdr.height) {
      return {pass:false,score:0,reasons:['dimension-change'],metrics:null,metadataSafe:false};
    }
    const metrics=evaluatePixelFidelity(original.rgba,decoded.rgba,original.ihdr.width,original.ihdr.height);
    const verdict=judgePixelFidelity(metrics,policy);
    const metadataSafe=pngRenderMetadataFingerprint(decoded)===sourceFingerprint;
    const reasons=[...verdict.reasons];
    if(!metadataSafe) reasons.push('render-metadata-change');
    return {pass:verdict.pass&&metadataSafe,score:verdict.score,reasons,metrics,metadataSafe};
  } catch(error) {
    return {pass:false,score:0,reasons:['decode-error'],metrics:null,metadataSafe:false,error:String(error?.message||error)};
  }
}

function record(label,tool,buffer,validation,runInfo=null,policy='render-exact') {
  return {label,tool,policy,buffer,bytes:buffer?.length??null,pass:Boolean(validation?.pass),score:validation?.score??0,reasons:validation?.reasons||[],metrics:validation?.metrics||null,metadataSafe:validation?.metadataSafe??null,error:validation?.error||null,run:runInfo};
}

function publicRecord(item) {
  return {
    label:item.label,tool:item.tool,policy:item.policy,bytes:item.bytes,pass:item.pass,score:item.score,reasons:item.reasons,
    exactPixels:item.metrics?.exactPixels??null,
    renderExactPixels:item.metrics?.renderExactPixels??null,
    hiddenTransparentRgbChangedPixels:item.metrics?.hiddenTransparentRgbChangedPixels??null,
    metadataSafe:item.metadataSafe,error:item.error,
    run:item.run?{ok:item.run.ok,status:item.run.status,signal:item.run.signal,error:item.run.error,stderr:item.run.stderr}:null
  };
}

export function optimizePngDeliveryTournament(sourceBuffer,options={}) {
  const effort=options.effort||'balanced';
  const original=decodePngRgba(sourceBuffer);
  const sourceFingerprint=pngRenderMetadataFingerprint(original);
  const strict=optimizePngLossless(sourceBuffer,options.losslessOptions);
  const strictValidation=validate(strict.buffer,original,sourceFingerprint,'strict');
  const candidates=[record('png:strict-authoring','kelo',strict.buffer,strictValidation,null,'strict')];
  const available={oxipng:commandAvailable('oxipng')};

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-png-delivery-'));
  const sourcePath=path.join(temp,'source.png');
  fs.writeFileSync(sourcePath,sourceBuffer);
  try {
    if(available.oxipng) {
      const profiles=effort==='deep'
        ? [
            {label:'oxipng:web-o4-alpha',args:['-o','4','--strip','safe','--alpha']},
            {label:'oxipng:web-o6-alpha',args:['-o','6','--strip','safe','--alpha']},
            {label:'oxipng:web-o6-zopfli-alpha',args:['-o','6','-z','--strip','safe','--alpha']}
          ]
        : [{label:'oxipng:web-o4-alpha',args:['-o','4','--strip','safe','--alpha']}];
      for(const profile of profiles) {
        const target=path.join(temp,`${profile.label.replaceAll(':','-')}.png`);
        fs.copyFileSync(sourcePath,target);
        const runInfo=run('oxipng',[...profile.args,target],temp);
        if(!runInfo.ok||!fs.existsSync(target)) {
          candidates.push(record(profile.label,'oxipng',null,{pass:false,reasons:['tool-error']},runInfo));
          continue;
        }
        const buffer=fs.readFileSync(target);
        candidates.push(record(profile.label,'oxipng',buffer,validate(buffer,original,sourceFingerprint,'render-exact'),runInfo));
      }
    }
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }

  const accepted=candidates.filter(item=>item.pass&&item.buffer).sort((a,b)=>a.bytes-b.bytes||b.score-a.score);
  const winner=accepted[0]||candidates[0];
  const savedBytes=Math.max(0,sourceBuffer.length-winner.bytes);
  return {
    buffer:winner.buffer,
    report:{
      version:'kelo-png-delivery-tournament-v1',
      effort,
      sourceBytes:sourceBuffer.length,
      optimizedBytes:winner.bytes,
      savedBytes,
      savedPercent:sourceBuffer.length?Number(((savedBytes/sourceBuffer.length)*100).toFixed(3)):0,
      availableTools:available,
      contract:'DELIVERY-only; visible RGB + alpha exact; hidden RGB under alpha=0 may change; rendering metadata fingerprint locked',
      winner:publicRecord(winner),
      candidates:candidates.map(publicRecord)
    }
  };
}

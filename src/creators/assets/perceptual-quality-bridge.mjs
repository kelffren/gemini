/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PERCEPTUAL QUALITY SSIMULACRA2 BUTTERAUGLI VERSIONED EVIDENCE IQA
 * purpose: gather versioned independent perceptual evidence without overriding deterministic hard gates
 * public-api: inspectPerceptualQuality()
 * state-owned: none
 * online: N/A; build/lab-time capability
 */

import {spawnSync} from 'node:child_process';
function run(command,args,timeout=120000){const result=spawnSync(command,args,{encoding:'utf8',timeout});return{ok:!result.error&&result.status===0,status:result.status,stdout:String(result.stdout||'').trim(),stderr:String(result.stderr||'').trim(),error:result.error?String(result.error.message||result.error):null};}
function probe(command){for(const args of[['--version'],['-V'],['--help']]){const result=run(command,args,4000);if(result.error?.includes('ENOENT'))return{available:false,version:null};if(result.ok||result.status!==null){const text=`${result.stdout}\n${result.stderr}`.trim(),version=text.split(/\r?\n/).find(Boolean)?.slice(0,240)||null;return{available:true,version};}}return{available:false,version:null};}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function parseNamed(text,names){const source=String(text||'');for(const name of names){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),match=source.match(new RegExp(`${escaped}\\s*(?:[:=]|is)?\\s*(-?\\d+(?:\\.\\d+)?)`,'i'));if(match)return finite(match[1]);}const lines=source.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(lines.length===1&&/^-?\d+(?:\.\d+)?$/.test(lines[0]))return finite(lines[0]);return null;}
function parseIqaJson(stdout){try{const parsed=JSON.parse(stdout);return{ssimulacra2:finite(parsed.ssimulacra2??parsed.SSIMULACRA2),psnrExternal:finite(parsed.psnr??parsed.PSNR),ssim:finite(parsed.ssim??parsed.SSIM),butteraugli:finite(parsed.butteraugli??parsed.Butteraugli)};}catch{return null;}}

export function inspectPerceptualQuality(referencePath,candidatePath){
  const toolInfo={iqa:probe('iqa-cli'),ssimulacra2:probe('ssimulacra2'),butteraugli:probe('butteraugli')},metrics={},evidence=[];
  if(toolInfo.iqa.available){const result=run('iqa-cli',['--reference',referencePath,'--distorted',candidatePath,'--metric','ssimulacra2,psnr,ssim,butteraugli']);evidence.push({tool:'iqa-cli',version:toolInfo.iqa.version,...result});if(result.ok){const parsed=parseIqaJson(result.stdout);if(parsed)Object.assign(metrics,parsed);}}
  if(metrics.ssimulacra2==null&&toolInfo.ssimulacra2.available){const result=run('ssimulacra2',[referencePath,candidatePath]);evidence.push({tool:'ssimulacra2',version:toolInfo.ssimulacra2.version,...result});if(result.ok)metrics.ssimulacra2=parseNamed(`${result.stdout}\n${result.stderr}`,['ssimulacra2','score']);}
  if(metrics.butteraugli==null&&toolInfo.butteraugli.available){const result=run('butteraugli',[referencePath,candidatePath]);evidence.push({tool:'butteraugli',version:toolInfo.butteraugli.version,...result});if(result.ok)metrics.butteraugli=parseNamed(`${result.stdout}\n${result.stderr}`,['butteraugli','distance','score']);}
  const interpretations=[];if(metrics.ssimulacra2!=null)interpretations.push(metrics.ssimulacra2>=90?'ssimulacra2-very-high':metrics.ssimulacra2>=70?'ssimulacra2-high':'ssimulacra2-review');if(metrics.butteraugli!=null)interpretations.push(metrics.butteraugli<1?'butteraugli-low-difference':metrics.butteraugli<2?'butteraugli-subtle-difference':'butteraugli-review');
  return{version:'kelo-perceptual-quality-advisory-v2',authority:'advisory-unless-publish-policy-requires-metric',tools:toolInfo,metrics,interpretations,evidence};
}

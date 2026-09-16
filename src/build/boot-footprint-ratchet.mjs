/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: BOOT FOOTPRINT RATCHET FIRST PLAYABLE BYTES SCRIPT CSS INDEX MOBILE
 * purpose: measure resources required before kelo:boot-ready and reject silent critical-path byte growth
 * public-api: measureBootFootprint(), compareBootFootprints()
 * state-owned: none
 * online: N/A; CI/build-time only
 * do-not: load resources, mutate index.html or infer lazy runtime assets
 */
import fs from 'node:fs';
import path from 'node:path';
const READY_MARKER='window.__keloBootReady=true';
const byte=n=>Number.isFinite(Number(n))&&Number(n)>=0?Math.round(Number(n)):0;
function attrs(tag){const out={};for(const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g))out[String(match[1]).toLowerCase()]=match[3];return out;}
function localPath(url){const raw=String(url||'').trim();if(!raw||/^(?:[a-z]+:|\/\/|data:|blob:)/i.test(raw))return null;return decodeURIComponent(raw.split('#')[0].split('?')[0]).replace(/^\.\//,'').replace(/^\/+/, '');}
export function measureBootFootprint(rootDir,{htmlPath='index.html',readyMarker=READY_MARKER}={}){
  const root=path.resolve(rootDir),htmlFile=path.join(root,htmlPath),html=fs.readFileSync(htmlFile,'utf8'),markerIndex=html.indexOf(readyMarker);
  if(markerIndex<0)throw new Error('BOOT_FOOTPRINT_READY_MARKER_NOT_FOUND');
  const prefix=html.slice(0,markerIndex+readyMarker.length),refs=[];
  for(const match of prefix.matchAll(/<(script|link)\b[^>]*>/gi)){
    const tag=match[0],type=String(match[1]).toLowerCase(),a=attrs(tag);
    let url=null,kind=null;
    if(type==='script'&&a.src){url=a.src;kind='script';}
    else if(type==='link'&&a.href&&String(a.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')){url=a.href;kind='style';}
    const repoPath=localPath(url);if(!repoPath)continue;
    const full=path.resolve(root,repoPath);if(full!==root&&!full.startsWith(root+path.sep))throw new Error(`BOOT_FOOTPRINT_PATH_ESCAPE:${repoPath}`);
    const exists=fs.existsSync(full)&&fs.statSync(full).isFile();refs.push({kind,path:repoPath,bytes:exists?fs.statSync(full).size:0,exists});
  }
  const uniqueMap=new Map();for(const ref of refs)if(!uniqueMap.has(`${ref.kind}:${ref.path}`))uniqueMap.set(`${ref.kind}:${ref.path}`,ref);
  const resources=[...uniqueMap.values()].sort((a,b)=>a.path.localeCompare(b.path)),missing=resources.filter(r=>!r.exists),externalStoredBytes=resources.reduce((s,r)=>s+r.bytes,0),htmlPrefixBytes=Buffer.byteLength(prefix);
  return Object.freeze({schema:'kelo-boot-footprint-v1',htmlPath,readyMarker,htmlPrefixBytes,referenceCount:refs.length,resourceCount:resources.length,externalStoredBytes,totalMeasuredCriticalBytes:htmlPrefixBytes+externalStoredBytes,missing:Object.freeze(missing.map(r=>r.path)),resources:Object.freeze(resources.map(r=>Object.freeze({...r})))});
}
export function compareBootFootprints(base,head,{maxHtmlPrefixGrowthBytes=512}={}){
  const baseMap=new Map((base?.resources||[]).map(r=>[`${r.kind}:${r.path}`,r])),headMap=new Map((head?.resources||[]).map(r=>[`${r.kind}:${r.path}`,r]));
  const regressions=[],improvements=[],added=[],removed=[];
  for(const [key,item] of headMap){const prev=baseMap.get(key);if(!prev){added.push(item);regressions.push({type:'critical-resource-added',path:item.path,bytes:item.bytes});continue;}const delta=byte(item.bytes)-byte(prev.bytes);if(delta>0)regressions.push({type:'critical-resource-grew',path:item.path,baseBytes:byte(prev.bytes),headBytes:byte(item.bytes),deltaBytes:delta});else if(delta<0)improvements.push({path:item.path,baseBytes:byte(prev.bytes),headBytes:byte(item.bytes),savedBytes:-delta});}
  for(const [key,item] of baseMap)if(!headMap.has(key))removed.push(item);
  const externalDelta=byte(head?.externalStoredBytes)-byte(base?.externalStoredBytes),htmlDelta=byte(head?.htmlPrefixBytes)-byte(base?.htmlPrefixBytes);
  if(externalDelta>0)regressions.push({type:'critical-external-total-grew',deltaBytes:externalDelta});
  if(byte(head?.resourceCount)>byte(base?.resourceCount))regressions.push({type:'critical-resource-count-grew',baseCount:byte(base?.resourceCount),headCount:byte(head?.resourceCount)});
  if(htmlDelta>Math.max(0,byte(maxHtmlPrefixGrowthBytes)))regressions.push({type:'boot-html-prefix-grew',deltaBytes:htmlDelta,toleranceBytes:byte(maxHtmlPrefixGrowthBytes)});
  for(const missing of head?.missing||[])regressions.push({type:'missing-critical-resource',path:missing});
  return Object.freeze({schema:'kelo-boot-footprint-ratchet-v1',pass:regressions.length===0,regressions:Object.freeze(regressions),improvements:Object.freeze(improvements),added:Object.freeze(added),removed:Object.freeze(removed),summary:Object.freeze({baseExternalBytes:byte(base?.externalStoredBytes),headExternalBytes:byte(head?.externalStoredBytes),externalDeltaBytes:externalDelta,baseResourceCount:byte(base?.resourceCount),headResourceCount:byte(head?.resourceCount),htmlPrefixDeltaBytes:htmlDelta,savedBytes:improvements.reduce((s,i)=>s+i.savedBytes,0)})});
}

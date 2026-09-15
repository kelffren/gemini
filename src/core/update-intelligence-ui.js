/* KELO-INDEX
 * area: CORE / SETTINGS / UPDATE INTELLIGENCE
 * owner: KeloUpdateIntelligenceUI
 * keys: UPDATE METRICS DELTA VERIFY HOTSET CDN HEALTH DIAGNOSTICS MOBILE
 * purpose: expose updater/gate health and timing inside Settings without polling or boot cost
 * public-api: KeloUpdateIntelligenceUI.render/snapshot/copyDiagnostics
 * do-not: NO interval, NO second loop, NO automatic apply, NO gameplay authority
 */
(function(root){
'use strict';
if(root.KeloUpdateIntelligenceUI)return;
const VERSION='kelo-update-intelligence-ui-v1';
let mounted=false;
let card=null;
let lastEvent=null;
let lastEventAt=null;
const UPDATE_EVENTS=['checking','available','staging','delta-plan','staging-progress','consistency-wait','staged','applying','health-committed','health-hold','blocked','error','staging-error'];
const GATE_EVENTS=['checking','available','current','heavy-start','heavy-ready','heavy-error','hotset-learned','error'];

function esc(v){return String(v==null?'—':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function shortBuild(v){const s=String(v||'');return s?s.slice(0,8):'—';}
function fmtMs(v){const n=Number(v);return Number.isFinite(n)?(n<1000?Math.round(n)+' ms':(n/1000).toFixed(2)+' s'):'—';}
function fmtBytes(v){const n=Number(v);if(!Number.isFinite(n))return '—';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(2)+' MB';}
function updaterState(){try{return root.KeloUpdater?.getState?.()||null;}catch(_){return null;}}
function gateState(){try{return root.KeloUpdateGate?.getState?.()||null;}catch(_){return null;}}
function snapshot(){
  const u=updaterState(),g=gateState(),m=u&&u.metrics||{},s=u&&u.stage||{};
  return Object.freeze({version:VERSION,time:new Date().toISOString(),gate:g,updater:u,summary:{status:u&&u.status||g&&g.lastReason||'idle',installedBuild:u&&u.installedBuild||g&&g.installedBuild||null,deployedBuild:u&&u.deployedBuild||g&&g.deployedBuild||null,availableBuild:u&&u.availableBuild||null,blockedBuild:u&&u.blockedBuild||null,stageStatus:s.status||null,deltaFiles:s.deltaFiles||0,downloadedBytes:s.downloadedBytes||0,verified:!!s.verified,compareMs:m.compareMs,indexMs:m.indexMs,downloadMs:m.downloadMs,timeToReadyMs:m.timeToReadyMs,verifiedFiles:m.verifiedFiles||0,syntaxChecked:m.syntaxChecked||0,hotsetHits:m.hotsetHits||0,consistencyRetries:m.consistencyRetries||0,compareCacheHit:!!m.compareCacheHit,healthAttempts:m.healthAttempts||0,lastEvent,lastEventAt}});
}
function ensureStyle(){if(document.getElementById('kelo-update-intel-style'))return;const style=document.createElement('style');style.id='kelo-update-intel-style';style.textContent='.kui-card{margin:0 0 12px;padding:11px;border-radius:16px;background:#0b1a1d;border:1px solid rgba(91,190,163,.24)}.kui-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.kui-title b{font-size:12px;color:#b9f0df}.kui-badge{font-size:9px;padding:5px 7px;border-radius:999px;background:#10282a;color:#9fd9ca;border:1px solid rgba(159,217,202,.15)}.kui-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.kui-metric{min-width:0;padding:8px;border-radius:11px;background:#0f2225;border:1px solid rgba(255,255,255,.05)}.kui-metric small{display:block;color:#819d95;font-size:8px;text-transform:uppercase;letter-spacing:.06em}.kui-metric strong{display:block;margin-top:3px;color:#edf8f3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kui-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.kui-actions button{min-height:38px;border-radius:10px;border:1px solid rgba(91,190,163,.25);background:#10282a;color:#b9f0df;font-size:10px;font-weight:800}.kui-warn{margin-top:7px;color:#e4be7a;font-size:9px;line-height:1.3}';document.head.appendChild(style);}
function ensureCard(){
  if(card&&card.isConnected)return card;const panel=document.getElementById('kelo-download-center');if(!panel)return null;const safety=panel.querySelector('.kdc-safety');if(!safety)return null;ensureStyle();card=document.createElement('section');card.className='kui-card';card.id='kelo-update-intelligence';card.innerHTML='<div class="kui-title"><b>Update Intelligence</b><span class="kui-badge" id="kui-status">—</span></div><div class="kui-grid" id="kui-grid"></div><div class="kui-warn" id="kui-warn"></div><div class="kui-actions"><button type="button" data-kui="check">Comprobar</button><button type="button" data-kui="prepare">Preparar</button><button type="button" data-kui="apply">Aplicar READY</button><button type="button" data-kui="copy">Copiar diagnóstico</button></div>';safety.insertAdjacentElement('afterend',card);card.addEventListener('click',onAction);mounted=true;return card;
}
async function onAction(e){const action=e.target&&e.target.getAttribute&&e.target.getAttribute('data-kui');if(!action)return;e.target.disabled=true;try{
  if(action==='check'){if(root.KeloUpdater?.check)await root.KeloUpdater.check({force:true});else await root.KeloUpdateGate?.checkNow?.();}
  else if(action==='prepare'){if(!root.KeloUpdater)await root.KeloUpdateGate?.wakeHeavy?.('settings-manual');const u=updaterState();if(u&&u.availableBuild)await root.KeloUpdater.prepareUpdate(u.availableBuild,{foreground:true});}
  else if(action==='apply'){if(!root.KeloUpdater)await root.KeloUpdateGate?.wakeHeavy?.('settings-manual');const u=updaterState();if(u&&u.status==='ready')await root.KeloUpdater.applyUpdate();}
  else if(action==='copy'){await copyDiagnostics();}
}catch(error){console.error('[Update Intelligence]',error);try{root.showToast?.('Updater: '+String(error&&error.message||error));}catch(_){}}finally{e.target.disabled=false;render();}}
async function copyDiagnostics(){const text=JSON.stringify(snapshot(),null,2);try{await navigator.clipboard.writeText(text);root.showToast?.('Diagnóstico copiado');return true;}catch(_){try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(ok)root.showToast?.('Diagnóstico copiado');return !!ok;}catch(__){return false;}}}
function metric(label,value){return '<div class="kui-metric"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>';}
function render(){const c=ensureCard();if(!c)return false;const s=snapshot(),x=s.summary,u=s.updater;const status=document.getElementById('kui-status'),grid=document.getElementById('kui-grid'),warn=document.getElementById('kui-warn');if(status)status.textContent=x.status||'idle';if(grid)grid.innerHTML=[metric('Instalado',shortBuild(x.installedBuild)),metric('Disponible',shortBuild(x.availableBuild||x.deployedBuild)),metric('Delta',String(x.deltaFiles)+' archivos'),metric('Bytes',fmtBytes(x.downloadedBytes)),metric('READY',fmtMs(x.timeToReadyMs)),metric('Descarga',fmtMs(x.downloadMs)),metric('Verificados',String(x.verifiedFiles)),metric('JS syntax',String(x.syntaxChecked)),metric('Hotset hits',String(x.hotsetHits)),metric('CDN retries',String(x.consistencyRetries)),metric('Compare',fmtMs(x.compareMs)),metric('Health',String(x.healthAttempts)+' intento(s)')].join('');if(warn){const parts=[];if(x.blockedBuild)parts.push('Build bloqueado '+shortBuild(x.blockedBuild));if(u&&u.lastError)parts.push(String(u.lastError));if(x.lastEvent)parts.push('Último evento: '+x.lastEvent);warn.textContent=parts.join(' · ')||'Hash verify + CDN consistency + hot cache + health shield.';}return true;}
function noteEvent(name,event){lastEvent=name;lastEventAt=Date.now();render();}
UPDATE_EVENTS.forEach(function(n){root.addEventListener('kelo:update:'+n,function(e){noteEvent('update:'+n,e);});});
GATE_EVENTS.forEach(function(n){root.addEventListener('kelo:update-gate:'+n,function(e){noteEvent('gate:'+n,e);});});
root.addEventListener('kelo:download-center:open',function(){setTimeout(render,0);});
root.KeloUpdateIntelligenceUI=Object.freeze({version:VERSION,render,snapshot,copyDiagnostics});
setTimeout(render,0);
})(typeof globalThis!=='undefined'?globalThis:window);

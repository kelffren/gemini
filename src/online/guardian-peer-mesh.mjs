/* KELO-INDEX
 * area: ONLINE / GUARDIAN PEER MESH
 * owner: Kelo Guardian P2P client
 * keys: WEBRTC SIGNAL SINGLE SOCKET RELAY ASSET CHUNKS SHA256 LATENCY TURN FALLBACK SAFARI UI
 * purpose: establece DataChannels entre nodos Guardian usando KeloNetAuthority como signaling único
 * authority: canal P2P solo transporta probes/assets verificados; nunca gameplay/economia/PvP/autenticacion
 * do-not: NO segundo WebSocket, NO token en peer channel, NO eval, NO asset cross-origin, NO archivo > 512KB
 */
const VERSION='guardian-peer-mesh-v1.1.0';
const root=globalThis;
const sessions=new Map(),transfers=new Map();
const listeners=new Set();
const MAX_ASSET_BYTES=512*1024,CHUNK_BYTES=18*1024,MAX_SESSIONS=2;
const CACHE_NAME='kelo-guardian-verified-assets-v1';
let host=null,detachHost=null,boundNodeId=null,lastError=null,bytesSent=0,bytesReceived=0,probes=0,panel=null;

function emit(){const state=getState();listeners.forEach(fn=>{try{fn(state);}catch{}});renderUi();}
function net(){return root.KeloNetAuthority||null;}
function safePath(value){const path=String(value||'');if(!/^\/assets\/[A-Za-z0-9_./-]{1,480}$/.test(path)||path.includes('..'))throw new Error('GUARDIAN_P2P_ASSET_PATH_INVALID');return path;}
function validSha(value){const sha=String(value||'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(sha))throw new Error('GUARDIAN_P2P_SHA_INVALID');return sha;}
function randomId(prefix='gp'){try{return prefix+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,20);}catch{return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);}}
function b64(bytes){let out='';const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);for(let i=0;i<u.length;i+=8192)out+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(out);}
function unb64(value){const s=atob(String(value||'')),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
async function sha256(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
function channelSend(channel,obj){if(!channel||channel.readyState!=='open')throw new Error('GUARDIAN_P2P_CHANNEL_CLOSED');const text=JSON.stringify(obj);if(text.length>32000)throw new Error('GUARDIAN_P2P_FRAME_TOO_LARGE');channel.send(text);bytesSent+=new TextEncoder().encode(text).byteLength;}
function iceServers(){const configured=root.KELO_GUARDIAN_ICE_SERVERS;if(Array.isArray(configured)&&configured.length)return configured;return[{urls:'stun:stun.l.google.com:19302'}];}
function networkRequest(type,payload,timeout){const n=net();if(!n||typeof n.guardianRequest!=='function')return Promise.reject(new Error('GUARDIAN_SIGNAL_TRANSPORT_UNAVAILABLE'));return n.guardianRequest(type,payload,timeout);}
function networkSignal(sessionId,signal){const n=net();if(!n||typeof n.guardianSignal!=='function')throw new Error('GUARDIAN_SIGNAL_TRANSPORT_UNAVAILABLE');return n.guardianSignal(sessionId,signal);}
function closePc(row){try{row.channel?.close?.();}catch{}try{row.pc?.close?.();}catch{}row.channel=null;row.pc=null;}
function closeSession(id,reason='local-close',notify=true){const row=sessions.get(id);if(!row)return false;closePc(row);sessions.delete(id);if(notify){try{net()?.guardianClosePeer?.(id,reason);}catch{}}emit();return true;}
function closeAll(reason,notify){for(const id of [...sessions.keys()])closeSession(id,reason,notify);transfers.clear();}
function setupChannel(row,channel){
  row.channel=channel;channel.binaryType='arraybuffer';
  channel.onopen=()=>{row.connectedAt=Date.now();row.state='connected';emit();try{channelSend(channel,{kind:'probe',id:randomId('probe'),sentAt:Date.now()});}catch{}};
  channel.onclose=()=>{row.state='closed';emit();};
  channel.onerror=()=>{row.state='error';emit();};
  channel.onmessage=event=>handlePeerMessage(row,event.data).catch(error=>{lastError=String(error?.message||error);emit();});
}
function createSession(sessionId,role,peerNodeId,expiresAt){
  if(sessions.has(sessionId))return sessions.get(sessionId);if(sessions.size>=MAX_SESSIONS)throw new Error('GUARDIAN_P2P_SESSION_LIMIT');
  if(!host?.createPeerConnection)throw new Error('GUARDIAN_WEBRTC_UNAVAILABLE');
  const row={sessionId,role,peerNodeId:String(peerNodeId||''),expiresAt:Number(expiresAt)||Date.now()+60000,state:'connecting',pc:null,channel:null,connectedAt:null,rttMs:null};
  const pc=host.createPeerConnection({iceServers:iceServers(),onDataChannel:channel=>setupChannel(row,channel),onIceCandidate:candidate=>{try{networkSignal(sessionId,{kind:'ice',candidate:candidate.candidate,sdpMid:candidate.sdpMid??null,sdpMLineIndex:candidate.sdpMLineIndex??null});}catch{}}});
  row.pc=pc;pc.onconnectionstatechange=()=>{row.state=pc.connectionState||row.state;if(['failed','closed'].includes(pc.connectionState))closeSession(sessionId,'webrtc-'+pc.connectionState,true);else emit();};sessions.set(sessionId,row);emit();return row;
}
async function startOffer(msg){const row=createSession(msg.sessionId,'offerer',msg.peerNodeId,msg.expiresAt);const channel=row.pc.createDataChannel('kelo-guardian-relay-v1',{ordered:true});setupChannel(row,channel);const offer=await row.pc.createOffer();await row.pc.setLocalDescription(offer);networkSignal(row.sessionId,{kind:'offer',sdp:row.pc.localDescription.sdp});}
async function receiveSignal(msg){
  let row=sessions.get(msg.sessionId);const sig=msg.signal||{};
  if(!row){if(sig.kind!=='offer')return;row=createSession(msg.sessionId,'answerer',msg.peerNodeId,msg.expiresAt);}
  if(sig.kind==='offer'){await row.pc.setRemoteDescription({type:'offer',sdp:String(sig.sdp||'')});const answer=await row.pc.createAnswer();await row.pc.setLocalDescription(answer);networkSignal(row.sessionId,{kind:'answer',sdp:row.pc.localDescription.sdp});}
  else if(sig.kind==='answer'){await row.pc.setRemoteDescription({type:'answer',sdp:String(sig.sdp||'')});}
  else if(sig.kind==='ice'){try{await row.pc.addIceCandidate({candidate:String(sig.candidate||''),sdpMid:sig.sdpMid??null,sdpMLineIndex:sig.sdpMLineIndex??null});}catch(error){if(row.pc.remoteDescription)throw error;}}
}
async function serveAsset(row,msg){
  if(host?.getState?.().preferences?.allowAssets!==true)return;const path=safePath(msg.path),expected=validSha(msg.sha256),url=new URL(path,location.origin);if(url.origin!==location.origin)throw new Error('GUARDIAN_P2P_ASSET_ORIGIN_DENIED');
  let response=null;try{response=await (await caches.open(CACHE_NAME)).match(url.href);}catch{}if(!response)response=await fetch(url.href,{cache:'force-cache'});if(!response?.ok)return channelSend(row.channel,{kind:'asset-error',id:msg.id,code:'NOT_FOUND'});
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>MAX_ASSET_BYTES)return channelSend(row.channel,{kind:'asset-error',id:msg.id,code:'TOO_LARGE'});const actual=await sha256(bytes);if(actual!==expected)return channelSend(row.channel,{kind:'asset-error',id:msg.id,code:'HASH_MISMATCH'});
  const total=Math.ceil(bytes.byteLength/CHUNK_BYTES);channelSend(row.channel,{kind:'asset-start',id:msg.id,path,sha256:actual,bytes:bytes.byteLength,total});
  for(let i=0;i<total;i++){const chunk=bytes.subarray(i*CHUNK_BYTES,Math.min(bytes.length,(i+1)*CHUNK_BYTES));channelSend(row.channel,{kind:'asset-chunk',id:msg.id,index:i,data:b64(chunk)});if(i%4===3)await new Promise(resolve=>setTimeout(resolve,0));}
  channelSend(row.channel,{kind:'asset-end',id:msg.id});
}
async function finishTransfer(row,t){
  const chunks=t.chunks;if(chunks.some(x=>!x))throw new Error('GUARDIAN_P2P_CHUNK_MISSING');let total=0;const decoded=chunks.map(x=>{const u=unb64(x);total+=u.byteLength;return u;});if(total!==t.bytes||total>MAX_ASSET_BYTES)throw new Error('GUARDIAN_P2P_ASSET_SIZE_INVALID');const all=new Uint8Array(total);let offset=0;for(const u of decoded){all.set(u,offset);offset+=u.byteLength;}const actual=await sha256(all);if(actual!==t.sha256)throw new Error('GUARDIAN_P2P_HASH_MISMATCH');
  try{const cache=await caches.open(CACHE_NAME);await cache.put(new URL(t.path,location.origin).href,new Response(all,{headers:{'Content-Type':'application/octet-stream','X-Kelo-SHA256':actual}}));}catch{}
  transfers.delete(t.id);bytesReceived+=all.byteLength;root.dispatchEvent?.(new CustomEvent('kelo:guardian-asset-received',{detail:{path:t.path,sha256:actual,bytes:all.byteLength,peerNodeId:row.peerNodeId}}));emit();
}
async function handlePeerMessage(row,data){
  if(typeof data!=='string'||data.length>33000)throw new Error('GUARDIAN_P2P_FRAME_INVALID');bytesReceived+=new TextEncoder().encode(data).byteLength;let msg;try{msg=JSON.parse(data);}catch{throw new Error('GUARDIAN_P2P_JSON_INVALID');}
  if(msg.kind==='probe'){channelSend(row.channel,{kind:'pong',id:String(msg.id||''),sentAt:Number(msg.sentAt)||0,replyAt:Date.now()});return;}
  if(msg.kind==='pong'){row.rttMs=Math.max(0,Date.now()-(Number(msg.sentAt)||Date.now()));probes++;emit();return;}
  if(msg.kind==='asset-request'){await serveAsset(row,msg);return;}
  if(msg.kind==='asset-start'){const path=safePath(msg.path),hash=validSha(msg.sha256),bytes=Number(msg.bytes),total=Number(msg.total);if(!Number.isInteger(bytes)||bytes<0||bytes>MAX_ASSET_BYTES||!Number.isInteger(total)||total<1||total>64)throw new Error('GUARDIAN_P2P_ASSET_META_INVALID');transfers.set(String(msg.id),{id:String(msg.id),path,sha256:hash,bytes,total,chunks:new Array(total)});return;}
  if(msg.kind==='asset-chunk'){const t=transfers.get(String(msg.id));if(!t)return;const index=Number(msg.index);if(!Number.isInteger(index)||index<0||index>=t.total||String(msg.data||'').length>26000)throw new Error('GUARDIAN_P2P_CHUNK_INVALID');t.chunks[index]=String(msg.data);return;}
  if(msg.kind==='asset-end'){const t=transfers.get(String(msg.id));if(t)await finishTransfer(row,t);return;}
}
function handleNetwork(event){const msg=event?.detail||event;if(!msg?.t)return;Promise.resolve().then(async()=>{if(msg.t==='guardian:peer:session')await startOffer(msg);else if(msg.t==='guardian:peer:invite')createSession(msg.sessionId,'answerer',msg.peerNodeId,msg.expiresAt);else if(msg.t==='guardian:peer:signal')await receiveSignal(msg);else if(msg.t==='guardian:peer:closed')closeSession(msg.sessionId,msg.reason||'server-closed',false);}).catch(error=>{lastError=String(error?.message||error);emit();});}
async function ensureBound(){const state=host?.getState?.(),n=net();if(!state?.donorEnabled||!state?.node||!n?.isOnline?.())return false;if(boundNodeId===state.nodeId)return true;await n.guardianBind(state.nodeId);boundNodeId=state.nodeId;lastError=null;emit();return true;}
function syncHostState(){const state=host?.getState?.();if(!state?.donorEnabled||!state?.node){boundNodeId=null;closeAll('donor-disabled',true);emit();return;}ensureBound().catch(error=>{lastError=String(error?.message||error);emit();});}
function onNetworkOpen(){boundNodeId=null;ensureBound().catch(error=>{lastError=String(error?.message||error);emit();});}
function onNetworkClose(){boundNodeId=null;closeAll('network-closed',false);emit();}
async function requestPeer(region='global'){if(!await ensureBound())throw new Error('GUARDIAN_P2P_NOT_BOUND');return networkRequest('guardian:peer:request',{region:String(region||'global').slice(0,48)},8000);}
function openChannels(){return [...sessions.values()].filter(x=>x.channel?.readyState==='open');}
function waitForChannel(timeoutMs=8000){const ready=openChannels()[0];if(ready)return Promise.resolve(ready);return new Promise((resolve,reject)=>{let off=null;const timer=setTimeout(()=>{off?.();reject(new Error('GUARDIAN_P2P_CONNECT_TIMEOUT'));},timeoutMs);off=onChange(state=>{if(state.connected>0){clearTimeout(timer);off?.();resolve(openChannels()[0]);}});});}
async function requestAsset(path,sha){path=safePath(path);sha=validSha(sha);let row=openChannels()[0];if(!row){await requestPeer();row=await waitForChannel(8000);}const id=randomId('asset');channelSend(row.channel,{kind:'asset-request',id,path,sha256:sha});return{id,peerNodeId:row.peerNodeId};}
function ensureUi(){if(panel&&panel.isConnected)return panel;const sheet=document.querySelector('#kelo-download-center .kdc-sheet');if(!sheet)return null;panel=document.getElementById('kelo-guardian-peer-panel')||document.createElement('section');panel.id='kelo-guardian-peer-panel';panel.style.cssText='margin:8px 0;padding:10px;border-radius:14px;background:#0b171a;border:1px solid rgba(120,180,255,.22);color:#dcecff;font:600 11px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';if(!panel.isConnected)sheet.appendChild(panel);panel.onclick=async e=>{if(e.target?.dataset?.guardianPeer!=='connect')return;e.target.disabled=true;try{await requestPeer();root.showToast?.('Guardian P2P: negociando enlace');}catch(error){lastError=String(error?.message||error);root.showToast?.(lastError);}finally{e.target.disabled=false;renderUi();}};return panel;}
function renderUi(){const el=ensureUi();if(!el)return;const s=getState(),hs=host?.getState?.()||{},eligible=!!(hs.donorEnabled&&hs.preferences?.allowRelay);const peer=s.sessions[0];el.innerHTML='<b>Guardian P2P</b><div style="opacity:.72;margin:4px 0">'+(s.connected?'Conectado · '+s.connected+' peer'+(s.connected>1?'s':'')+(peer?.rttMs!=null?' · '+peer.rttMs+' ms':''):(s.boundNodeId?'Nodo enlazado · esperando peer':'Sin enlace de signaling'))+'</div>'+(eligible&&!s.connected?'<button data-guardian-peer="connect" style="min-height:40px;border-radius:11px;border:1px solid rgba(120,180,255,.35);background:#10263a;color:#dcecff;font-weight:800;padding:0 12px">Probar enlace P2P</button>':'')+'<div style="opacity:.55;margin-top:5px;font-size:9px">Assets ≤512 KB con SHA-256 · mismo WebSocket para signaling · '+(s.turnConfigured?'TURN configurado':'STUN directo')+'</div>'+(s.lastError?'<div style="color:#ffaaa0;margin-top:5px">'+String(s.lastError).replace(/[<>]/g,'')+'</div>':'');}
function attach(deviceHost=root.KeloGuardianDeviceHost){if(host)return true;host=deviceHost;if(!host)return false;window.addEventListener('kelo:guardian-network',handleNetwork);window.addEventListener('kelo:network-open',onNetworkOpen);window.addEventListener('kelo:network-close',onNetworkClose);detachHost=host.onChange?.(syncHostState);ensureUi();syncHostState();emit();return true;}
function stop(){try{detachHost?.();}catch{}detachHost=null;window.removeEventListener('kelo:guardian-network',handleNetwork);window.removeEventListener('kelo:network-open',onNetworkOpen);window.removeEventListener('kelo:network-close',onNetworkClose);closeAll('mesh-stop',true);boundNodeId=null;host=null;emit();}
function getState(){return Object.freeze({version:VERSION,boundNodeId,sessions:Object.freeze([...sessions.values()].map(x=>Object.freeze({sessionId:x.sessionId,role:x.role,peerNodeId:x.peerNodeId,state:x.state,rttMs:x.rttMs,expiresAt:x.expiresAt}))),connected:openChannels().length,bytesSent,bytesReceived,probes,lastError,maxAssetBytes:MAX_ASSET_BYTES,singleSocketSignaling:true,gameplayAuthority:false,economyAuthority:false,pvpAuthority:false,turnConfigured:Array.isArray(root.KELO_GUARDIAN_ICE_SERVERS)&&root.KELO_GUARDIAN_ICE_SERVERS.some(x=>String(x?.urls||'').startsWith('turn'))});}
function onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}

export const GuardianPeerMesh=Object.freeze({version:VERSION,attach,stop,ensureBound,requestPeer,requestAsset,getState,onChange});
root.KeloGuardianPeerMesh=GuardianPeerMesh;
if(root.KeloGuardianDeviceHost)attach(root.KeloGuardianDeviceHost);

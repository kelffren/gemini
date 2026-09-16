'use strict';
/* KELO-INDEX
 * area: SERVER / PVP PRESENTATION WIRE
 * owner-adjacent: Kelo server WebSocket transport + PvP authority
 * keys: PVP PRESENTATION DELTA SNAPSHOT COSMETIC AVATAR CREATOR SAME SOCKET
 * purpose: separa presentation pesada del snapshot competitivo; envía envelope server-derived solo cuando cambia y deja presentationKey pequeño en snapshots
 * do-not: NO segundo socket, NO client-trusted URL/revision, NO gameplay mutation, NO timer/loop propio
 */
const crypto=require('node:crypto');
const MISSING=Symbol('missing');
function presentationIdentity(manifest){
  const m=manifest&&typeof manifest==='object'?manifest:null;if(!m)return'';
  const avatar=String(m.revisionId||m.contentId||'').slice(0,240),modular=String(m.creatorAppearance&&m.creatorAppearance.revisionKey||'').slice(0,4096);
  return avatar||modular?avatar+'\n'+modular:'';
}
function presentationKey(manifest){const id=presentationIdentity(manifest);return id?'p1:'+crypto.createHash('sha256').update(id).digest('hex').slice(0,20):null;}
function installPvpPresentationWire({WebSocket}={}){
  const WS=WebSocket||require('ws').WebSocket;if(!WS||!WS.prototype||typeof WS.prototype.send!=='function')throw new Error('PVP_PRESENTATION_WEBSOCKET_REQUIRED');
  if(WS.prototype.send.__keloPvpPresentationWire)return WS.prototype.send.__keloPvpPresentationApi;
  const nativeSend=WS.prototype.send,states=new WeakMap();let presentationsSent=0,presentationsSkipped=0,manifestsStripped=0,pvpSnapshots=0;
  function stateFor(socket){let s=states.get(socket);if(!s){s={ownId:null,inPvp:false,cache:new Map(),sent:new Map()};states.set(socket,s);}return s;}
  function emitPresentation(socket,s,actorId,manifest,serverTime){
    const id=String(actorId||'');if(!id||id===s.ownId)return presentationKey(manifest);const key=presentationKey(manifest),previous=s.sent.has(id)?s.sent.get(id):MISSING;
    s.cache.set(id,manifest||null);if(previous===key){presentationsSkipped++;return key;}s.sent.set(id,key);presentationsSent++;
    nativeSend.call(socket,JSON.stringify({t:'pvp:presentation',actorId:id,presentationKey:key,avatarManifest:manifest||null,serverTime:Number(serverTime)||Date.now(),source:'server-authoritative-pvp-presentation'}));return key;
  }
  function observeState(socket,s,msg){
    const players=msg.players&&typeof msg.players==='object'?msg.players:null;if(!players)return msg;
    if(msg.t==='welcome'&&msg.id)s.ownId=String(msg.id);
    const own=s.ownId&&players[s.ownId];if(own){const nextPvp=own.zone==='pvp';if(s.inPvp&&!nextPvp)s.sent.clear();s.inPvp=nextPvp||s.inPvp&&msg.t==='pvp:snapshot';}
    for(const [id,row] of Object.entries(players))if(row&&Object.prototype.hasOwnProperty.call(row,'avatarManifest'))s.cache.set(String(id),row.avatarManifest||null);
    if(!s.inPvp||msg.t!=='state')return msg;
    const outPlayers={};for(const [id,row] of Object.entries(players)){if(!row||typeof row!=='object'){outPlayers[id]=row;continue;}const manifest=Object.prototype.hasOwnProperty.call(row,'avatarManifest')?row.avatarManifest:s.cache.get(String(id))||null,key=emitPresentation(socket,s,id,manifest,msg.serverTime),copy={...row,presentationKey:key};if(Object.prototype.hasOwnProperty.call(copy,'avatarManifest')){delete copy.avatarManifest;manifestsStripped++;}outPlayers[id]=copy;}
    return{...msg,players:outPlayers,source:msg.source||'server-aoi-v1'};
  }
  function observePvpSnapshot(socket,s,msg){
    s.inPvp=true;pvpSnapshots++;const players=msg.players&&typeof msg.players==='object'?msg.players:{},outPlayers={};
    for(const [id,row] of Object.entries(players)){const manifest=s.cache.get(String(id))||null,key=emitPresentation(socket,s,id,manifest,msg.serverTime);outPlayers[id]=row&&typeof row==='object'?{...row,presentationKey:key}:row;}
    const visible=new Set(Object.keys(players));for(const id of [...s.sent.keys()])if(!visible.has(id))s.sent.delete(id);
    return{...msg,players:outPlayers};
  }
  function send(data,...rest){
    if(typeof data!=='string'||data.charCodeAt(0)!==123)return nativeSend.call(this,data,...rest);let msg;try{msg=JSON.parse(data);}catch(_){return nativeSend.call(this,data,...rest);}const s=stateFor(this);
    if(msg.t==='welcome'||msg.t==='state')msg=observeState(this,s,msg);if(msg.t==='pvp:snapshot')msg=observePvpSnapshot(this,s,msg);return nativeSend.call(this,JSON.stringify(msg),...rest);
  }
  const api=Object.freeze({version:'pvp-presentation-wire-v1',presentationKey,audit:()=>Object.freeze({version:'pvp-presentation-wire-v1',serverDerived:true,sameSocket:true,fullManifestEverySnapshot:false,presentationsSent,presentationsSkipped,manifestsStripped,pvpSnapshots})});
  Object.defineProperty(send,'__keloPvpPresentationWire',{value:true});Object.defineProperty(send,'__keloPvpPresentationApi',{value:api});WS.prototype.send=send;return api;
}
module.exports={installPvpPresentationWire,presentationKey,presentationIdentity};

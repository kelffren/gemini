/* KELO-INDEX
 * area: NETWORK / WORLD NOTIFICATIONS
 * owner: Kelo World Notification Center + KeloNetAuthority
 * keys: NOTIFICATION ONLINE BROADCAST COMMERCE EVENT CAMERA FOCUS SINGLE WEBSOCKET
 * purpose: conecta KeloNotifications al transporte existente y resuelve CTA world:focus-location sin crear otro WebSocket
 * do-not: NO abrir sockets, NO confiar autorización cliente, NO escribir window.camera directamente
 */
(function(){
'use strict';
if(window.KELO_WORLD_NOTIFICATION_ONLINE_BRIDGE)return;
const VERSION='kelo-world-notification-online-bridge-v1.0.0';
let installed=false;
function net(){return window.KeloNetAuthority||null;}
function notifications(){return window.KeloNotifications||null;}
function installTransport(){
  const center=notifications(),authority=net();
  if(installed||!center||!authority||typeof center.installTransport!=='function'||typeof authority.requestCommerce!=='function')return false;
  center.installTransport({
    broadcast(item){
      if(typeof authority.isOnline==='function'&&!authority.isOnline())return Promise.reject(new Error('KELO_NOTIFICATION_NETWORK_OFFLINE'));
      return authority.requestCommerce('world_notification',{notification:item}).then(result=>{
        if(result&&result.ok===false)throw new Error(result.code||'KELO_NOTIFICATION_BROADCAST_REJECTED');
        return result;
      });
    },
    subscribe(receive){
      const handler=event=>{
        const msg=event&&event.detail;
        if(!msg||msg.kind!=='world-notification'||!msg.notification)return;
        receive(msg.notification);
      };
      window.addEventListener('kelo:commerce-server-event',handler);
      return()=>window.removeEventListener('kelo:commerce-server-event',handler);
    }
  });
  installed=true;
  return true;
}
function focusLocation(payload){
  const p=payload||{},x=Number(p.x),y=Number(p.y),camera=window.KeloCamera;
  if(!camera||!Number.isFinite(x)||!Number.isFinite(y)){
    try{window.dispatchEvent(new CustomEvent('kelo:world-location-unresolved',{detail:p}));}catch(_){}
    return false;
  }
  try{
    if(typeof camera.clearPvPDirectorIntent==='function')camera.clearPvPDirectorIntent();
    const focused=typeof camera.focus==='function'?camera.focus({x,y},{snap:true,source:'world-notification'}):false;
    if(focused){
      try{window.dispatchEvent(new CustomEvent('kelo:world-location-focused',{detail:{...p,x,y}}));}catch(_){}
      if(typeof window.showToast==='function')window.showToast(p.reason==='invasion-started'?'Zona de invasión localizada':'Ubicación localizada');
    }
    return !!focused;
  }catch(_){return false;}
}
function installFocus(){
  const bus=window.KeloEvents;
  if(bus&&typeof bus.on==='function'){bus.on('world:focus-location',focusLocation);return true;}
  window.addEventListener('world:focus-location',event=>focusLocation(event&&event.detail));
  return true;
}
function boot(){installTransport();installFocus();}
boot();
if(!installed){window.addEventListener('load',installTransport,{once:true});setTimeout(installTransport,250);setTimeout(installTransport,1200);}
window.KELO_WORLD_NOTIFICATION_ONLINE_BRIDGE=Object.freeze({version:VERSION,installTransport,focusLocation,getState:()=>Object.freeze({installed,online:!!(net()&&net().isOnline&&net().isOnline())})});
window.KELO_WORLD_NOTIFICATION_ONLINE_AUDIT=Object.freeze({version:VERSION,singleWebSocket:true,serverAuthorizationRequired:true,commerceEnvelopeBridge:true,cameraOwner:'KeloCamera',directCameraMutation:false});
})();
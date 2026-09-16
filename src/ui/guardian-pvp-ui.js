/* KELO-INDEX
 * area: UI / GUARDIAN PVP
 * owner: KeloGuardianPvPUI
 * keys: GUARDIAN PVP LAB MOBILE ADMIN HOST START STOP STATUS
 * purpose: añade al panel Guardian un control móvil para arrancar/detener la sala PvP temporal
 * consumes: KeloGuardianUI + KeloGuardianPvPHost + KeloGuardianPvPNetAdapter + KeloPvPWorld
 * do-not: NO conceder permisos Master, NO iniciar si servidor central está activo, NO tocar economía
 */
(function(root){
'use strict';
if(root.KeloGuardianPvPUI||!root.KeloGuardianPvPHost)return;
const VERSION='kelo-guardian-pvp-ui-v1';let busy=false,lastMessage='';
function state(){try{return root.KeloGuardianPvPHost.state();}catch(_){return{};}}
function net(){try{return root.KeloGuardianPvPNetAdapter?.state?.()||{};}catch(_){return{};}}
function guardian(){try{return root.KeloGuardian?.state?.()||{};}catch(_){return{};}}
function label(){
 const h=state(),n=net(),g=guardian();
 if(n.centralOnline)return{disabled:true,text:'SERVIDOR CENTRAL ACTIVO',note:'Guardian PvP Lab se bloquea para evitar doble autoridad.'};
 if(h.active)return{disabled:false,text:'DETENER PVP LAB',note:`Sala ${h.roomId||'pvp-lab'} · tick ${h.latestSnapshot?.serverTick||0} · ${h.masterActive?'este dispositivo es host':'host remoto'}.`};
 if(!g.enabled)return{disabled:true,text:'ENCIENDE GUARDIAN PRIMERO',note:'Activa Guardian para descubrir o crear un Master.'};
 if(!g.master?.nodeId)return{disabled:true,text:'FALTA MASTER GUARDIAN',note:g.masterEligible?'Usa el botón de Host/Master de arriba en este dispositivo.':'Espera a que haya un Master Guardian disponible.'};
 return{disabled:false,text:'⚔ INICIAR PVP LAB',note:'Usará Guardian solo para gameplay temporal; KC, inventario y persistencia siguen fuera.'};
}
async function toggle(){
 if(busy)return;busy=true;sync();
 try{
   const h=state();
   if(h.active){
     try{if(root.KeloPvPWorld?.state?.mode==='pvp')root.KeloPvPWorld.leave?.();}catch(_){}
     root.KeloGuardianPvPHost.stop();lastMessage='PvP Lab detenido.';
   }else{
     const n=net();if(n.centralOnline)throw new Error('GUARDIAN_PVP_CENTRAL_SERVER_ACTIVE');
     root.KeloGuardianPvPHost.start('pvp-lab');
     lastMessage='PvP Lab listo.';
     try{if(root.KeloPvPWorld?.state?.mode==='social')root.KeloPvPWorld.enter?.();}catch(_){}
   }
 }catch(error){lastMessage=String(error?.message||error);}
 finally{busy=false;sync();}
}
function sync(){
 const card=document.getElementById('kelo-guardian-card');if(!card)return false;let wrap=card.querySelector('#kelo-guardian-pvp-lab');
 if(!wrap){wrap=document.createElement('div');wrap.id='kelo-guardian-pvp-lab';wrap.style.cssText='margin-top:10px;padding-top:10px;border-top:1px solid rgba(231,197,106,.13)';card.appendChild(wrap);}
 const l=label();wrap.innerHTML=`<button type="button" class="kg-action ${state().active?'danger':'master'}" data-kelo-guardian-pvp ${busy||l.disabled?'disabled':''}>${busy?'PROCESANDO…':l.text}</button><div class="kg-note">${l.note}</div>${lastMessage?`<div class="kg-message">${lastMessage}</div>`:''}`;
 const btn=wrap.querySelector('[data-kelo-guardian-pvp]');if(btn)btn.onclick=()=>void toggle();return true;
}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});}
const observer=new MutationObserver(schedule);
if(document.body)observer.observe(document.body,{childList:true,subtree:true});else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
root.addEventListener('kelo:guardian-state',schedule,{passive:true});root.addEventListener('kelo:guardian-pvp-state',schedule,{passive:true});root.addEventListener('kelo:guardian-pvp-net-state',schedule,{passive:true});
root.KeloGuardianPvPUI=Object.freeze({version:VERSION,sync,toggle});
root.KELO_GUARDIAN_PVP_UI_AUDIT=Object.freeze({version:VERSION,mobileControl:true,centralDoubleAuthorityBlocked:true,permissionGrant:false,economyAuthority:false});
schedule();
})(typeof globalThis!=='undefined'?globalThis:window);

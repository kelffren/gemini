/* KELO-INDEX
 * area: CORE / MOBILE NETWORK
 * owner: KELO_TRAFFIC_CONTROLLER
 * purpose: one adaptive authority for background network work on mobile; gameplay always wins
 * do-not: never gate authoritative gameplay/network messages; this controls optional/background loading only
 */
(function(root){
'use strict';
if(root.KELO_TRAFFIC_CONTROLLER)return;
const VERSION='1.0.0';
const listeners=new Set();
const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
let emaMbps=null,emaRtt=null,lastProbe=null,active=0;
const state={profile:'balanced',concurrency:2,backgroundAllowed:true,playerBusy:false,hidden:document.hidden===true,saveData:!!(conn&&conn.saveData),effectiveType:conn&&conn.effectiveType||null,frameP95:null,pressure:null};

function perf(){
 try{
  const s=root.KELO_PERF&&root.KELO_PERF.getSnapshot?root.KELO_PERF.getSnapshot():null;
  state.frameP95=s?Number(s.frameP95Ms)||null:null;state.pressure=s?Number(s.pressure)||null:null;
 }catch(_){}
}
function busy(){
 try{const i=root.input;return !!(i&&(i.active||i.touchActive||Math.abs(i.normX||0)>.02||Math.abs(i.normY||0)>.02));}catch(_){return false;}
}
function classify(){
 perf();state.hidden=document.hidden===true;state.playerBusy=busy();state.saveData=!!(conn&&conn.saveData);state.effectiveType=conn&&conn.effectiveType||null;
 const slowNet=state.saveData||/^(slow-2g|2g|3g)$/.test(String(state.effectiveType||''))||(emaMbps!=null&&emaMbps<1.5)||(emaRtt!=null&&emaRtt>450);
 const stressed=(state.frameP95!=null&&state.frameP95>28)||(state.pressure!=null&&state.pressure>1);
 if(state.hidden||state.playerBusy||stressed){state.profile='protect';state.concurrency=0;state.backgroundAllowed=false;}
 else if(slowNet){state.profile='conserve';state.concurrency=1;state.backgroundAllowed=!state.saveData;}
 else if((emaMbps!=null&&emaMbps>=8)&&(emaRtt==null||emaRtt<180)){state.profile='fast';state.concurrency=3;state.backgroundAllowed=true;}
 else{state.profile='balanced';state.concurrency=2;state.backgroundAllowed=true;}
 for(const fn of listeners)try{fn(snapshot());}catch(_){}
 return state;
}
function snapshot(){return Object.freeze({version:VERSION,profile:state.profile,concurrency:state.concurrency,backgroundAllowed:state.backgroundAllowed,playerBusy:state.playerBusy,hidden:state.hidden,saveData:state.saveData,effectiveType:state.effectiveType,measuredMbps:emaMbps,measuredRtt:emaRtt,frameP95:state.frameP95,pressure:state.pressure,active});}
function canStart(priority){
 classify();priority=Number(priority)||4;
 if(priority<=1)return !state.hidden;
 if(!state.backgroundAllowed)return false;
 return active<state.concurrency;
}
async function measure(url){
 if(document.hidden)return snapshot();
 const target=url||'manifest.webmanifest';
 const started=performance.now();
 try{
  const res=await fetch(target+(target.includes('?')?'&':'?')+'keloProbe='+Date.now(),{cache:'no-store',credentials:'same-origin'});
  const blob=await res.blob(),ms=Math.max(1,performance.now()-started),mbps=(blob.size*8)/(ms*1000);
  emaMbps=emaMbps==null?mbps:(emaMbps*.75+mbps*.25);emaRtt=emaRtt==null?ms:(emaRtt*.8+ms*.2);
  lastProbe=Date.now();
 }catch(_){}
 classify();return snapshot();
}
async function run(task,opts){
 opts=opts||{};const priority=Number(opts.priority)||4;
 while(!canStart(priority))await new Promise(r=>setTimeout(r,state.playerBusy?180:350));
 active++;
 try{return await task();}finally{active=Math.max(0,active-1);classify();}
}
function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
document.addEventListener('visibilitychange',classify,{passive:true});
if(conn&&conn.addEventListener)conn.addEventListener('change',classify);
setInterval(classify,1000);setTimeout(()=>measure(),2500);
root.KELO_TRAFFIC_CONTROLLER=Object.freeze({version:VERSION,snapshot,canStart,run,measure,subscribe,classify});
classify();
})(typeof globalThis!=='undefined'?globalThis:window);

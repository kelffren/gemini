/* KELO-INDEX
 * area: HISTORY / CLIENT
 * owner: Game History Chronicle
 * purpose: captura únicamente hitos semánticos del cliente para la crónica local; no crea autoridad de gameplay
 * performance: event-driven, sin polling ni render loop
 */
(function(root){
'use strict';
if(root.KELO_GAME_HISTORY)return;
const KEY='kelo.gameHistory.local.v1',MAX=180;
const local=[];
function load(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(a))local.push(...a.slice(-MAX));}catch(_){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(local.slice(-MAX)));}catch(_){}}
function clean(v,n=180){return String(v==null?'':v).trim().slice(0,n);}
function record(raw){
  const e={id:clean(raw?.id,100)||('local:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2,7)),type:clean(raw?.type,60)||'local_event',category:clean(raw?.category,40)||'player',importance:Math.max(1,Math.min(5,Number(raw?.importance)||1)),title:clean(raw?.title,120)||'Hito',summary:clean(raw?.summary,700),occurredAt:Number(raw?.occurredAt)||Date.now(),source:'client-observed'};
  local.push(e);if(local.length>MAX)local.splice(0,local.length-MAX);save();
  root.dispatchEvent?.(new CustomEvent('kelo:history-recorded',{detail:e}));
  return e;
}
function observe(name,mapper){root.KeloEvents?.on?.(name,p=>{try{const v=mapper(p||{});if(v)record(v);}catch(_){}});}
load();
observe('title:unlocked',p=>({type:'title_unlocked',category:'prestige',importance:2,title:'Nuevo título desbloqueado',summary:clean(p.titleName||p.titleId||'Un jugador alcanzó un nuevo título.')}));
observe('arena:champion',p=>({type:'arena_champion',category:'champions',importance:4,title:'Nuevo campeón de Arena',summary:clean(p.name||p.playerName||'Un jugador conquistó la Arena.')}));
observe('world:first',p=>({type:'world_first',category:'world',importance:5,title:'World First',summary:clean(p.summary||p.name||'Se registró un nuevo World First.')}));
observe('relic:captured',p=>({type:'relic_captured',category:'relics',importance:5,title:'Reliquia capturada',summary:clean(p.summary||p.serial||'Una reliquia cambió de manos.')}));
observe('city:conquered',p=>({type:'city_conquered',category:'cities',importance:5,title:'Ciudad conquistada',summary:clean(p.summary||p.cityName||'Una Gran Ciudad cambió de gobierno.')}));
function list(){return local.slice().sort((a,b)=>b.occurredAt-a.occurredAt);}
async function refresh(){
  root.dispatchEvent?.(new CustomEvent('kelo:history-refresh-requested'));
  return list();
}
root.KELO_GAME_HISTORY=Object.freeze({version:'game-history-client-v1',record,list,refresh,polling:false,maxLocal:MAX});
})(typeof globalThis!=='undefined'?globalThis:window);

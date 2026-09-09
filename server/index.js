/* KELO-INDEX
 * area: SERVER
 * owner: Kelo server authority + server/pvp-authority.js for PvP simulation
 * keys: WEBSOCKET AUTHORITY INPUT INTENT FIXED TIMESTEP RECONCILIATION PVP TITLES COMMERCE FORGE
 * purpose: autoridad server-side; PvP acepta inputs/intents, nunca daño/posición final declarados por cliente
 * online: pose sigue para mundo social; dentro de PvP la posición, dash, cooldown, mana, hits, HP, CC, muerte y kills nacen del fixed-step server
 */
'use strict';
const { WebSocketServer } = require('ws');
const { createNobilityService, safePlayerId } = require('./nobility-store');
const { createPlayerEconomyStore } = require('./player-economy-store');
const { createForgeService } = require('./forge-store');
const { createCommerceService } = require('./commerce-store');
const { createTitleService } = require('./title-store');
const { createPvpAuthority, FIXED_DT, SNAPSHOT_HZ } = require('./pvp-authority');

const PORT=Number(process.env.PORT||2567),MAX=32,WORLD={w:3600,h:3200};
const VISUAL_EVENT_ALLOWLIST=new Set(['CAST_CONFIRMED','PROJECTILE_SPAWNED','PROJECTILE_HIT','PROJECTILE_EXPIRED','ABILITY_IMPACT','STATUS_APPLIED','STATUS_REMOVED','SHIELD_APPLIED','SHIELD_BROKEN','DASH_STARTED','DASH_ENDED','DEATH']);
const players=new Map();let seq=1;
const economy=createPlayerEconomyStore({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
const nobility=createNobilityService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
const forge=createForgeService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,economyStore:economy});
const titles=createTitleService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,enableSupabase:process.env.KELO_TITLES_SUPABASE==='1',tableName:process.env.KELO_TITLES_TABLE||'title_players'});
function connectionsForPlayerKey(playerKey){const rows=[];players.forEach(p=>{if(p.playerKey===String(playerKey))rows.push(p)});return rows;}
const commerce=createCommerceService({economyStore:economy,resolvePlayerName:playerKey=>connectionsForPlayerKey(playerKey)[0]?.name||String(playerKey),isPlayerOnline:playerKey=>connectionsForPlayerKey(playerKey).length>0});
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function shortId(value,max){return value==null?null:String(value).replace(/[^a-zA-Z0-9_:\-.]/g,'').slice(0,max||96);}
function safeVec(value){if(!value||!Number.isFinite(Number(value.x))||!Number.isFinite(Number(value.y)))return null;return{x:clamp(Number(value.x),-256,WORLD.w+256),y:clamp(Number(value.y),-256,WORLD.h+256)};}
function safeDirection(value){if(!value||!Number.isFinite(Number(value.x))||!Number.isFinite(Number(value.y)))return null;const x=Number(value.x),y=Number(value.y),len=Math.hypot(x,y);if(!len||len>1000)return null;return{x:Number((x/len).toFixed(5)),y:Number((y/len).toFixed(5))};}
function send(ws,obj){if(ws&&ws.readyState===1)ws.send(JSON.stringify(obj));}
function broadcast(obj,except){const raw=JSON.stringify(obj);players.forEach(p=>{if(p!==except&&p.ws&&p.ws.readyState===1)p.ws.send(raw)});}
function publicState(){const out={};players.forEach((p,id)=>{out[id]={id:p.id,playerKey:p.playerKey,name:p.name,x:p.x,y:p.y,face:p.face,gait:p.gait,zone:p.zone,hp:Number.isFinite(p.hp)?p.hp:100,maxHp:Number.isFinite(p.maxHp)?p.maxHp:100,mana:Number.isFinite(p.mana)?p.mana:100,maxMana:Number.isFinite(p.maxMana)?p.maxMana:100,nobilityRank:p.nobilityRank||'none',nobilityPower:p.nobilityPower||0,equippedTitleId:p.equippedTitleId||null,armorScore:p.armorScore||0,auraRank:p.auraRank||0,averageQuality:p.averageQuality||0,averageGrade:p.averageGrade||0,equipmentSummary:Array.isArray(p.equipmentSummary)?p.equipmentSummary:[]}});return out;}
function notifyCommerce(playerKeys,reason,exceptPlayerKey){[...new Set((playerKeys||[]).filter(Boolean).map(String))].forEach(playerKey=>{if(playerKey===exceptPlayerKey)return;const snapshot=commerce.snapshot(playerKey);connectionsForPlayerKey(playerKey).forEach(p=>send(p.ws,{t:'commerce:event',reason:reason||null,snapshot,source:'server-authoritative'}))});}
function sanitizeVisualContext(raw){const c=raw&&typeof raw==='object'?raw:{},gp=c.gameplay&&typeof c.gameplay==='object'?c.gameplay:{},visual=c.visual&&typeof c.visual==='object'?c.visual:{};return{castId:shortId(c.castId,96),abilityId:Number.isSafeInteger(Number(c.abilityId))?clamp(Number(c.abilityId),0,100000):null,abilityKey:shortId(c.abilityKey,64),origin:safeVec(c.origin),target:safeVec(c.target),direction:safeDirection(c.direction),gameplay:{speed:Number.isFinite(Number(gp.speed))?clamp(Number(gp.speed),0,5000):0,range:Number.isFinite(Number(gp.range))?clamp(Number(gp.range),0,5000):0,radius:Number.isFinite(Number(gp.radius))?clamp(Number(gp.radius),0,1000):0},visual:{scale:Number.isFinite(Number(visual.scale))?clamp(Number(visual.scale),.05,8):1,seed:Number.isFinite(Number(visual.seed))?(Number(visual.seed)>>>0):0,variant:shortId(visual.variant,64)},projectileId:shortId(c.projectileId,96),statusId:shortId(c.statusId,96),confirmed:true};}
function sanitizeVisualMeta(raw){const m=raw&&typeof raw==='object'?raw:{},targetActorId=shortId(m.targetActorId,80);return{status:shortId(m.status,40),duration:Number.isFinite(Number(m.duration))?clamp(Number(m.duration),0,120):null,targetActorId:targetActorId&&players.has(targetActorId)?targetActorId:null,amount:Number.isFinite(Number(m.amount))?clamp(Number(m.amount),-1000000,1000000):null,reason:shortId(m.reason,80)};}
function protocolError(ws,requestId,code,message){send(ws,{t:'error',requestId:requestId||null,code,message:message||code});}
async function refreshNobility(me,requestId){const snapshot=await nobility.snapshot(me.playerKey,me.name);me.nobilityRank=snapshot.rank.id;me.nobilityPower=snapshot.rank.power;send(me.ws,{t:'nobility:snapshot',requestId:requestId||null,snapshot});return snapshot;}
async function refreshTitles(me,requestId){const snapshot=await titles.snapshot(me.playerKey);me.equippedTitleId=snapshot.equippedTitleId||null;send(me.ws,{t:'titles:snapshot',requestId:requestId||null,snapshot});return snapshot;}
async function refreshForge(me,requestId){const snapshot=await forge.snapshot(me.playerKey);me.armorScore=snapshot.armorScore;me.auraRank=snapshot.auraRank;me.averageQuality=snapshot.averageQuality;me.averageGrade=snapshot.averageGrade;me.equipmentSummary=snapshot.equipmentSummary;send(me.ws,{t:'forge:snapshot',requestId:requestId||null,snapshot,source:forge.source});return snapshot;}
async function recordConfirmedKill(killerConnectionId,victimConnectionId,context){const killer=players.get(String(killerConnectionId||'')),victim=players.get(String(victimConnectionId||''));if(!killer||!victim||!killer.playerKey||!victim.playerKey)return{counted:false,reason:'PLAYER_NOT_CONNECTED'};const result=await titles.recordConfirmedKill(killer.playerKey,victim.playerKey,context);killer.equippedTitleId=result.snapshot.equippedTitleId||null;send(killer.ws,{t:'titles:snapshot',requestId:null,snapshot:result.snapshot,newUnlocks:result.newUnlocks||[]});if(result.counted)broadcast({t:'state',players:publicState()},killer);return result;}
const pvp=createPvpAuthority({onKill:(killer,victim,context)=>recordConfirmedKill(killer.id,victim.id,Object.assign({mode:'pvp',serverConfirmed:true},context||{}))});

const wss=new WebSocketServer({port:PORT});
wss.keloServerHooks=Object.freeze({recordConfirmedOpenWorldKill:recordConfirmedKill,pvpAuthority:pvp});
console.log(`Kelo room ws://0.0.0.0:${PORT} · fixed PvP ${Math.round(1/FIXED_DT)}Hz · snapshots ${SNAPSHOT_HZ}Hz · Nobleza ${nobility.source} · Titles ${titles.source} · Forge ${forge.source} · Commerce ${commerce.version}`);

wss.on('connection',ws=>{
  if(players.size>=MAX){ws.close(1013,'room full');return;}
  const id='p'+seq++,me={id,ws,playerKey:null,name:'Kelo',x:1400,y:1600,vx:0,vy:0,face:'down',gait:'idle',zone:'plaza',hp:100,maxHp:100,mana:100,maxMana:100,nobilityRank:'none',nobilityPower:0,equippedTitleId:null,armorScore:0,auraRank:0,averageQuality:0,averageGrade:0,equipmentSummary:[]};
  players.set(id,me);pvp.register(me);send(ws,{t:'welcome',id,players:publicState(),nobilitySource:nobility.source,titleSource:titles.source,forgeSource:forge.source,commerceSource:'server-authoritative',pvpAuthority:pvp.audit()});broadcast({t:'join',player:publicState()[id]},me);
  ws.on('message',async buf=>{
    let msg;try{msg=JSON.parse(String(buf))}catch(_){return;}
    try{
      if(msg.t==='hello'){if(typeof msg.name==='string'&&msg.name.trim())me.name=msg.name.trim().slice(0,24);me.playerKey=safePlayerId(msg.playerKey);economy.ensure(me.playerKey);await nobility.ensurePlayer(me.playerKey,me.name);await titles.ensurePlayer(me.playerKey);await forge.ensurePlayer(me.playerKey);send(ws,{t:'identity',playerKey:me.playerKey});await refreshNobility(me,msg.requestId);await refreshTitles(me,msg.requestId);await refreshForge(me,msg.requestId);send(ws,{t:'commerce:event',reason:'hello',snapshot:commerce.snapshot(me.playerKey),source:'server-authoritative'});broadcast({t:'state',players:publicState()},me);return;}
      if(msg.t==='pose'){
        if(me.zone==='pvp'||me._pvpActive)return;
        if(Number.isFinite(msg.x))me.x=clamp(msg.x,20,WORLD.w-20);if(Number.isFinite(msg.y))me.y=clamp(msg.y,20,WORLD.h-20);if(['up','down','left','right'].includes(msg.face))me.face=msg.face;if(['idle','walk','run'].includes(msg.gait))me.gait=msg.gait;if(['plaza','cafe','open-world','market'].includes(msg.zone))me.zone=msg.zone;return;
      }
      if(!me.playerKey){protocolError(ws,msg.requestId,'IDENTITY_REQUIRED','Envía hello antes de usar sistemas autoritativos.');return;}
      if(msg.t==='pvp:input'){
        const result=pvp.ingest(me,msg.intent&&typeof msg.intent==='object'?msg.intent:msg,Date.now());
        if(!result.ok)send(ws,{t:'pvp:reject',sequence:msg.intent&&msg.intent.sequence||msg.sequence||null,code:result.reason,ackSequence:result.ackSequence||me._pvpAck||0,source:'server-authoritative'});
        return;
      }
      if(msg.t==='visual:event'){if(!VISUAL_EVENT_ALLOWLIST.has(msg.name)){protocolError(ws,msg.requestId,'INVALID_VISUAL_EVENT','Evento visual no permitido.');return;}broadcast({t:'visual:event',name:msg.name,actorId:me.id,context:sanitizeVisualContext(msg.context),meta:sanitizeVisualMeta(msg.meta),serverTime:Date.now(),source:'server-visual-relay-v1'},me);return;}
      if(msg.t==='commerce:request'){const op=String(msg.op||'').slice(0,64),payload=msg.payload&&typeof msg.payload==='object'?msg.payload:{},result=await commerce.handle(me.playerKey,op,payload,msg.requestId),notifyIds=Array.isArray(result.notifyPlayerIds)?result.notifyPlayerIds.slice():[],response={...result};delete response.notifyPlayerIds;send(ws,{t:'commerce:result',requestId:msg.requestId||null,...response,source:'server-authoritative'});notifyCommerce(notifyIds,op,me.playerKey);return;}
      if(msg.t==='nobility:get'){await refreshNobility(me,msg.requestId);return;}
      if(msg.t==='nobility:donate'){const currency=msg.currency==='kc'?'kc':msg.currency==='gold'?'gold':null,amount=Math.floor(Number(msg.amount));if(!currency||!Number.isSafeInteger(amount)||amount<=0){protocolError(ws,msg.requestId,'INVALID_DONATION','Donación inválida.');return;}const result=await nobility.donate(me.playerKey,me.name,currency,amount);me.nobilityRank=result.snapshot.rank.id;me.nobilityPower=result.snapshot.rank.power;send(ws,{t:'nobility:donated',requestId:msg.requestId||null,donationAdded:result.donationAdded,snapshot:result.snapshot});broadcast({t:'state',players:publicState()},me);return;}
      if(msg.t==='titles:get'){await refreshTitles(me,msg.requestId);return;}
      if(msg.t==='titles:equip'){const snapshot=await titles.equip(me.playerKey,msg.titleId);me.equippedTitleId=snapshot.equippedTitleId||null;send(ws,{t:'titles:equipped',requestId:msg.requestId||null,snapshot});broadcast({t:'state',players:publicState()},me);return;}
      if(msg.t==='titles:unequip'){const snapshot=await titles.unequip(me.playerKey);me.equippedTitleId=null;send(ws,{t:'titles:unequipped',requestId:msg.requestId||null,snapshot});broadcast({t:'state',players:publicState()},me);return;}
      if(msg.t==='combat:resolve'){const result=await nobility.resolveDamage(me.playerKey,me.name,msg.baseDamage);send(ws,{t:'combat:resolved',requestId:msg.requestId||null,...result,projectionOnly:true});return;}
      if(msg.t==='forge:get'){await refreshForge(me,msg.requestId);return;}
      if(msg.t==='forge:attempt'){const result=await forge.attempt(me.playerKey,{itemId:msg.itemId,forgeType:msg.forgeType,materialLevel:msg.materialLevel,crystals:msg.crystals});me.armorScore=result.armorScore;me.auraRank=result.auraRank;me.averageQuality=result.averageQuality;me.averageGrade=result.averageGrade;me.equipmentSummary=result.equipmentSummary;send(ws,{t:'forge:result',requestId:msg.requestId||null,...result,source:'server-authoritative'});send(ws,{t:'commerce:event',reason:'forge:attempt',snapshot:commerce.snapshot(me.playerKey),source:'server-authoritative'});broadcast({t:'state',players:publicState()},me);return;}
      if(msg.t==='forge:combine'){const snapshot=await forge.combine(me.playerKey,msg.materialId);me.armorScore=snapshot.armorScore;me.auraRank=snapshot.auraRank;me.averageQuality=snapshot.averageQuality;me.averageGrade=snapshot.averageGrade;me.equipmentSummary=snapshot.equipmentSummary;send(ws,{t:'forge:combined',requestId:msg.requestId||null,snapshot});return;}
    }catch(err){const raw=String(err&&err.message||err),known=['INSUFFICIENT_GOLD','INSUFFICIENT_KC','INVALID_AMOUNT','INVALID_CURRENCY','ITEM_NOT_OWNED','INVALID_FORGE_TYPE','INVALID_TIER','MAX_TIER','INVALID_MATERIAL_LEVEL','TOO_MANY_CRYSTALS','INVALID_CRYSTAL','MATERIAL_REQUIRED','CRYSTAL_REQUIRED','INVALID_MATERIAL','MAX_MATERIAL_LEVEL','NEED_SIX','INVALID_VISUAL_EVENT','UNKNOWN_TITLE','TITLE_LOCKED','INVALID_PLAYER_ID','UNKNOWN_COMMERCE_OPERATION'],code=known.find(k=>raw.includes(k))||'SERVER_ERROR';console.error('protocol error',msg&&msg.t,raw);protocolError(ws,msg&&msg.requestId,code,code);}
  });
  ws.on('close',()=>{const playerKey=me.playerKey;pvp.unregister(me);players.delete(id);broadcast({t:'leave',id});if(playerKey&&!connectionsForPlayerKey(playerKey).length){const result=commerce.disconnect(playerKey);notifyCommerce(result.notifyPlayerIds||[],'disconnect',playerKey);}});
});

let fixedTick=0;
setInterval(()=>{
  const now=Date.now();pvp.step(FIXED_DT,now);fixedTick++;
  if(fixedTick%Math.max(1,Math.round((1/FIXED_DT)/SNAPSHOT_HZ))===0&&players.size){const snapshot=pvp.snapshot(now),events=pvp.consumeEvents(),raw=JSON.stringify({t:'pvp:snapshot',...snapshot,events,source:'server-authoritative'});players.forEach(p=>{if(p.ws&&p.ws.readyState===1)p.ws.send(raw)});}
  if(fixedTick%6===0&&players.size){const raw=JSON.stringify({t:'state',players:publicState()});players.forEach(p=>{if(p.ws&&p.ws.readyState===1)p.ws.send(raw)});}
},1000/60);

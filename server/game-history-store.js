'use strict';

/* KELO-INDEX
 * area: SERVER / HISTORY
 * owner: Game History Chronicle
 * keys: HISTORY CHRONICLE SERVER AUTHORITATIVE EVENTS PROVENANCE TIMELINE
 * purpose: almacena eventos históricos importantes confirmados por servidor y expone snapshots ligeros
 * do-not: NO confiar eventos valiosos declarados por cliente; NO guardar spam de combate/frame
 */
function cleanText(v,max=160){return String(v==null?'':v).trim().slice(0,max);}
function cleanId(v,max=96){return cleanText(v,max).replace(/[^a-zA-Z0-9_:\-.]/g,'');}
function createGameHistoryStore(options={}){
  const limit=Math.max(100,Math.min(10000,Number(options.limit)||2500));
  const rows=[];
  let seq=0;
  function record(raw={}){
    const now=Date.now();
    const event=Object.freeze({
      id:cleanId(raw.id)||('hist:'+now.toString(36)+':'+(++seq).toString(36)),
      type:cleanId(raw.type,64)||'world_event',
      category:cleanId(raw.category,48)||'world',
      importance:Math.max(1,Math.min(5,Number(raw.importance)||1)),
      title:cleanText(raw.title,140)||'Evento de Kelo World',
      summary:cleanText(raw.summary,900),
      occurredAt:Number.isFinite(Number(raw.occurredAt))?Number(raw.occurredAt):now,
      actorId:cleanId(raw.actorId,96)||null,
      actorName:cleanText(raw.actorName,80)||null,
      targetId:cleanId(raw.targetId,96)||null,
      targetName:cleanText(raw.targetName,80)||null,
      clanId:cleanId(raw.clanId,96)||null,
      cityId:cleanId(raw.cityId,96)||null,
      artifactSerial:cleanId(raw.artifactSerial,120)||null,
      season:cleanText(raw.season,64)||null,
      source:cleanId(raw.source,80)||'server-authoritative',
      meta:raw.meta&&typeof raw.meta==='object'?raw.meta:{}
    });
    rows.push(event);
    if(rows.length>limit)rows.splice(0,rows.length-limit);
    return event;
  }
  function list({limit:requested=200,since=0,category=null}={}){
    const max=Math.max(1,Math.min(500,Number(requested)||200));
    const floor=Number(since)||0,cat=category?String(category):null;
    return rows.filter(r=>r.occurredAt>=floor&&(!cat||r.category===cat)).sort((a,b)=>b.occurredAt-a.occurredAt).slice(0,max);
  }
  function snapshot(opts){const events=list(opts);return{ok:true,version:'game-history-store-v1',events,count:events.length,totalBuffered:rows.length,serverTime:Date.now()};}
  function audit(){return{version:'game-history-store-v1',buffered:rows.length,limit,serverAuthoritative:true};}
  return Object.freeze({record,list,snapshot,audit});
}
module.exports={createGameHistoryStore};

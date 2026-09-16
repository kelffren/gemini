/* KELO-INDEX
 * area: SERVER / HTTP BOOTSTRAP
 * owner: Kelo server HTTP composition
 * purpose: inject Sprite Factory + Admin Game Tuning APIs and PvP presentation delta wire into the existing Kelo server without creating parallel servers/transports
 * do-not: NO second listen(), NO second WebSocket, NO API/GitHub secret in client, NO gameplay authority changes
 */
'use strict';
const http=require('http');
const {createOnlineIdentityStore}=require('./online-identity-store');
const {createSpriteAiService}=require('./sprite-ai-service');
const {createSpriteAiHttpHandler}=require('./sprite-ai-http');
const {createGameTuningPublisher}=require('./game-tuning-publisher');
const {createGameTuningHttpHandler}=require('./game-tuning-http');
const {installPvpPresentationWire}=require('./pvp-presentation-wire');

const identity=createOnlineIdentityStore({supabaseUrl:process.env.SUPABASE_URL,supabasePublishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,requireAuth:false});
const spriteAi=createSpriteAiService();
const gameTuning=createGameTuningPublisher();
const pvpPresentation=installPvpPresentationWire();
const handlers=[createSpriteAiHttpHandler({service:spriteAi,identity}),createGameTuningHttpHandler({publisher:gameTuning,identity})];
const spriteAiStatus=spriteAi.status(),tuningStatus=gameTuning.audit();
console.log(`[Sprite AI] HTTP ready · provider ${spriteAiStatus.provider} · model ${spriteAiStatus.model} · ${spriteAiStatus.configured?'configured':'key-missing'}`);
console.log(`[Game Tuning] HTTP ready · ${tuningStatus.repository}@${tuningStatus.branch} · ${tuningStatus.configured?'publish-ready':'publish-key-missing'}`);
console.log(`[PvP Presentation] ${pvpPresentation.version} · same-socket delta presentation ready`);
const nativeCreateServer=http.createServer;
http.createServer=function patchedCreateServer(...args){
  let listenerIndex=-1;for(let i=args.length-1;i>=0;i--)if(typeof args[i]==='function'){listenerIndex=i;break;}
  if(listenerIndex<0)return nativeCreateServer.apply(http,args);
  const downstream=args[listenerIndex];
  args[listenerIndex]=function keloUnifiedHttpListener(req,res){
    (async()=>{for(const handle of handlers){if(await handle(req,res))return;}if(!res.writableEnded)downstream(req,res);})().catch(error=>{console.error('[Kelo HTTP bootstrap]',error);if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});if(!res.writableEnded)res.end(JSON.stringify({ok:false,error:'KELO_HTTP_BOOTSTRAP_ERROR'}));});
  };
  const server=nativeCreateServer.apply(http,args);http.createServer=nativeCreateServer;return server;
};
require('./index');

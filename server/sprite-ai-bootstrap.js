/* KELO-INDEX
 * area: SERVER / HTTP BOOTSTRAP
 * owner: Kelo server HTTP composition
 * purpose: compose Sprite Factory, Admin Game Tuning and durable MMORPG world-state owner into the existing Kelo HTTP server without creating a second server
 * do-not: NO second listen(), NO API/GitHub/bridge secret in client, NO second gameplay authority
 */
'use strict';
const http=require('http');
const {createOnlineIdentityStore}=require('./online-identity-store');
const {createSpriteAiService}=require('./sprite-ai-service');
const {createSpriteAiHttpHandler}=require('./sprite-ai-http');
const {createGameTuningPublisher}=require('./game-tuning-publisher');
const {createGameTuningHttpHandler}=require('./game-tuning-http');
const {createServerStateBridge}=require('./server-state-bridge');
const {createWorldStateStore}=require('./world-state-store');

const identity=createOnlineIdentityStore({supabaseUrl:process.env.SUPABASE_URL,supabasePublishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,requireAuth:false});
const spriteAi=createSpriteAiService();
const gameTuning=createGameTuningPublisher();
const stateBridge=createServerStateBridge();
const worldState=createWorldStateStore({bridge:stateBridge});
globalThis.KeloWorldStateStore=worldState;
const handlers=[createSpriteAiHttpHandler({service:spriteAi,identity}),createGameTuningHttpHandler({publisher:gameTuning,identity})];
const spriteAiStatus=spriteAi.status(),tuningStatus=gameTuning.audit(),worldStateStatus=worldState.audit();
console.log(`[Sprite AI] HTTP ready · provider ${spriteAiStatus.provider} · ${spriteAiStatus.model||spriteAiStatus.space||'unconfigured'} · ${spriteAiStatus.configured?'configured':'not-configured'} · paid-fallback ${spriteAiStatus.allowPaidFallback?'enabled':'disabled'}`);
console.log(`[Game Tuning] HTTP ready · ${tuningStatus.repository}@${tuningStatus.branch} · ${tuningStatus.configured?'publish-ready':'publish-key-missing'}`);
console.log(`[World State] ${worldStateStatus.source} · ${worldStateStatus.durable?'durable':'transition'} · replay ${worldStateStatus.replayable?'ready':'off'} · clientWritable ${worldStateStatus.clientWritable}`);
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

/* KELO-INDEX
 * area: SERVER / SPRITE AI BOOTSTRAP
 * owner: Kelo server HTTP composition
 * purpose: inject Sprite Factory API into the existing Kelo HTTP server without creating a second server
 * do-not: NO second listen(), NO API secret in client, NO gameplay authority changes
 */
'use strict';
const http=require('http');
const {createOnlineIdentityStore}=require('./online-identity-store');
const {createSpriteAiService}=require('./sprite-ai-service');
const {createSpriteAiHttpHandler}=require('./sprite-ai-http');

const identity=createOnlineIdentityStore({supabaseUrl:process.env.SUPABASE_URL,supabasePublishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,requireAuth:false});
const spriteAi=createSpriteAiService();
const handleSpriteAi=createSpriteAiHttpHandler({service:spriteAi,identity});
const spriteAiStatus=spriteAi.status();
console.log(`[Sprite AI] HTTP ready · provider ${spriteAiStatus.provider} · model ${spriteAiStatus.model} · ${spriteAiStatus.configured?'configured':'key-missing'}`);
const nativeCreateServer=http.createServer;
http.createServer=function patchedCreateServer(...args){
  let listenerIndex=-1;for(let i=args.length-1;i>=0;i--)if(typeof args[i]==='function'){listenerIndex=i;break;}
  if(listenerIndex<0)return nativeCreateServer.apply(http,args);
  const downstream=args[listenerIndex];
  args[listenerIndex]=function keloUnifiedHttpListener(req,res){
    Promise.resolve(handleSpriteAi(req,res)).then(handled=>{if(!handled&&!res.writableEnded)downstream(req,res);}).catch(error=>{console.error('[Sprite AI bootstrap]',error);if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});}if(!res.writableEnded)res.end(JSON.stringify({ok:false,error:'SPRITE_AI_BOOTSTRAP_ERROR'}));});
  };
  const server=nativeCreateServer.apply(http,args);http.createServer=nativeCreateServer;return server;
};
require('./index');

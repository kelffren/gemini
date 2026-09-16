/* KELO-INDEX
 * area: ENVIRONMENT / ONLINE
 * owner: canonical world environment synchronization
 * owns: initial REST convergence, Supabase Realtime subscription, role-gated publish RPC and revision ordering
 * does-not-own: rendering, Creator preview state, auth UI or service-role secrets
 */
import { KELO_SUPABASE_PUBLIC_CONFIG } from '../online/kelo-supabase-public-config.mjs';
import { installEnvironmentRuntime, normalizeEnvironmentState } from './environment-runtime.mjs';

const VERSION='kelo-world-environment-sync-v1';
const TOPIC='world:environment';
const SOCKET_TOPIC=`realtime:${TOPIC}`;
const BROADCAST_EVENT='environment_changed';
const SELECT_PATH='world_environment_state?id=eq.global&select=id,revision,schema_version,biome,weather,time_of_day,ambient_density,music_mood,accent,updated_by,updated_at&limit=1';
const RECONNECT_DELAYS=[1000,2000,4000,8000,15000];

const trimSlash=value=>String(value||'').replace(/\/+$/,'');
const numberOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

export function rowToWorldEnvironmentEnvelope(row={}){
  const state=normalizeEnvironmentState({
    biome:row.biome,
    weather:row.weather,
    timeOfDay:row.time_of_day??row.timeOfDay,
    ambientDensity:row.ambient_density??row.ambientDensity,
    musicMood:row.music_mood??row.musicMood,
    accent:row.accent
  });
  return Object.freeze({
    id:String(row.id||'global'),
    revision:Math.max(0,Math.trunc(numberOr(row.revision,0))),
    schemaVersion:Math.max(1,Math.trunc(numberOr(row.schema_version??row.schemaVersion,1))),
    state,
    updatedAt:row.updated_at??row.updatedAt??null,
    updatedBy:row.updated_by??row.updatedBy??null
  });
}

function normalizeBroadcastEnvelope(value={}){
  const raw=value?.payload&&value?.event===BROADCAST_EVENT?value.payload:value;
  if(!raw||typeof raw!=='object')return null;
  const state=raw.state&&typeof raw.state==='object'?normalizeEnvironmentState(raw.state):normalizeEnvironmentState(raw);
  return Object.freeze({
    id:String(raw.id||'global'),
    revision:Math.max(0,Math.trunc(numberOr(raw.revision,0))),
    schemaVersion:Math.max(1,Math.trunc(numberOr(raw.schemaVersion??raw.schema_version,1))),
    state,
    updatedAt:raw.updatedAt??raw.updated_at??null,
    updatedBy:raw.updatedBy??raw.updated_by??null
  });
}

async function responseJson(response){
  const text=await response.text();let data=null;
  try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!response.ok){
    const message=data?.message||data?.error_description||data?.error||data?.hint||`HTTP_${response.status}`;
    const error=new Error(String(message));error.status=response.status;error.data=data;throw error;
  }
  return data;
}

export function installWorldEnvironmentSync(root=globalThis,{config=KELO_SUPABASE_PUBLIC_CONFIG,fetchImpl=null,autoStart=true}={}){
  if(root?.KELO_WORLD_ENVIRONMENT_SYNC?.version===VERSION)return root.KELO_WORLD_ENVIRONMENT_SYNC;
  const runtime=installEnvironmentRuntime(root),base=trimSlash(config?.url),publishableKey=String(config?.publishableKey||''),fetcher=fetchImpl||root?.fetch?.bind?.(root)||globalThis.fetch?.bind?.(globalThis);
  if(!base||!publishableKey||typeof fetcher!=='function')throw new Error('WORLD_ENVIRONMENT_SYNC_CONFIG_REQUIRED');

  let envelope=null,socket=null,heartbeatTimer=0,reconnectTimer=0,reconnectAttempt=0,refSeq=0,joinRef=null,started=false,stopped=false;
  const listeners=[];
  const audit={version:VERSION,ready:false,started:false,connected:false,lastRevision:0,lastRefreshAt:0,lastRealtimeAt:0,lastPublishAt:0,reconnects:0,lastError:null};

  const nextRef=()=>String(++refSeq);
  function dispatch(name,detail){try{root?.dispatchEvent?.(new root.CustomEvent(name,{detail}));}catch{}}
  function headers(extra={}){return Object.assign({'apikey':publishableKey,'Accept':'application/json'},extra);}
  function clearHeartbeat(){if(heartbeatTimer){root.clearInterval?.(heartbeatTimer);heartbeatTimer=0;}}
  function clearReconnect(){if(reconnectTimer){root.clearTimeout?.(reconnectTimer);reconnectTimer=0;}}

  function accept(next,{source='sync'}={}){
    if(!next||next.id!=='global'||next.revision<=0)return false;
    if(envelope&&next.revision<envelope.revision)return false;
    if(envelope&&next.revision===envelope.revision&&source!=='refresh')return false;
    envelope=next;audit.lastRevision=next.revision;
    runtime.receivePublished?.(next.state,{source:`world-${source}`,revision:next.revision,updatedAt:next.updatedAt,updatedBy:next.updatedBy});
    dispatch('kelo:world-environment-synced',Object.freeze({source,envelope:next}));
    return true;
  }

  async function refresh({source='refresh'}={}){
    try{
      const data=await responseJson(await fetcher(`${base}/rest/v1/${SELECT_PATH}`,{headers:headers()}));
      const row=Array.isArray(data)?data[0]:data;
      if(!row)throw new Error('WORLD_ENVIRONMENT_STATE_MISSING');
      const next=rowToWorldEnvironmentEnvelope(row);accept(next,{source});audit.lastRefreshAt=Date.now();audit.ready=true;audit.lastError=null;return next;
    }catch(error){audit.lastError=String(error?.message||error);dispatch('kelo:world-environment-sync-error',{stage:'refresh',error});throw error;}
  }

  async function publish(nextState,{accessToken=null,expectedRevision=null,source='creator'}={}){
    const token=String(accessToken||'').trim();if(!token)throw new Error('AUTH_REQUIRED');
    const state=normalizeEnvironmentState(nextState),expected=expectedRevision==null?(envelope?.revision||null):expectedRevision;
    try{
      const data=await responseJson(await fetcher(`${base}/rest/v1/rpc/publish_world_environment`,{
        method:'POST',
        headers:headers({'Authorization':`Bearer ${token}`,'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify({p_state:state,p_expected_revision:expected})
      }));
      const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('WORLD_ENVIRONMENT_PUBLISH_EMPTY');
      const next=rowToWorldEnvironmentEnvelope(row);accept(next,{source:'publish'});audit.lastPublishAt=Date.now();audit.lastError=null;
      dispatch('kelo:world-environment-published',Object.freeze({source,envelope:next}));return next;
    }catch(error){
      audit.lastError=String(error?.message||error);
      if(String(error?.message||'').includes('ENVIRONMENT_REVISION_CONFLICT')){try{await refresh({source:'conflict-refresh'});}catch{}}
      dispatch('kelo:world-environment-sync-error',{stage:'publish',source,error});throw error;
    }
  }

  function scheduleReconnect(){
    if(stopped||reconnectTimer)return;
    const delay=RECONNECT_DELAYS[Math.min(reconnectAttempt,RECONNECT_DELAYS.length-1)];reconnectAttempt+=1;audit.reconnects+=1;
    reconnectTimer=root.setTimeout?.(()=>{reconnectTimer=0;connect();},delay)||0;
  }

  function handleSocketMessage(event){
    let message;try{message=JSON.parse(String(event?.data||''));}catch{return;}
    if(message?.event==='phx_reply'&&message?.ref===joinRef&&message?.payload?.status==='ok'){
      audit.connected=true;reconnectAttempt=0;audit.lastError=null;
      dispatch('kelo:world-environment-realtime-ready',{topic:TOPIC});return;
    }
    if(message?.event==='broadcast'){
      const wrapper=message.payload||{};
      if(wrapper.event!==BROADCAST_EVENT)return;
      const next=normalizeBroadcastEnvelope(wrapper);if(!next)return;
      if(accept(next,{source:'realtime'}))audit.lastRealtimeAt=Date.now();
    }
  }

  function connect(){
    if(stopped||typeof root?.WebSocket!=='function')return false;
    clearReconnect();clearHeartbeat();try{socket?.close?.();}catch{}
    const wsBase=base.replace(/^http:/,'ws:').replace(/^https:/,'wss:');
    const url=`${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(publishableKey)}&vsn=1.0.0`;
    try{socket=new root.WebSocket(url);}catch(error){audit.lastError=String(error?.message||error);scheduleReconnect();return false;}
    socket.addEventListener('open',()=>{
      joinRef=nextRef();
      socket.send(JSON.stringify({topic:SOCKET_TOPIC,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false}},ref:joinRef,join_ref:joinRef}));
      heartbeatTimer=root.setInterval?.(()=>{if(socket?.readyState===1)socket.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:nextRef()}));},25000)||0;
    });
    socket.addEventListener('message',handleSocketMessage);
    socket.addEventListener('error',()=>{audit.lastError='REALTIME_SOCKET_ERROR';});
    socket.addEventListener('close',()=>{audit.connected=false;clearHeartbeat();if(!stopped)scheduleReconnect();});
    return true;
  }

  function addListener(target,event,handler,options){if(!target?.addEventListener)return;target.addEventListener(event,handler,options);listeners.push([target,event,handler,options]);}
  async function start(){
    if(started)return api;started=true;stopped=false;audit.started=true;
    try{await refresh({source:'initial'});}catch(error){console.warn('[Kelo environment sync] initial refresh unavailable',error);}
    connect();
    addListener(root,'online',()=>{void refresh({source:'online'}).catch(()=>{});if(!audit.connected)connect();},{passive:true});
    addListener(root,'pageshow',()=>void refresh({source:'pageshow'}).catch(()=>{}),{passive:true});
    addListener(root.document,'visibilitychange',()=>{if(root.document?.visibilityState==='visible')void refresh({source:'visible'}).catch(()=>{});},{passive:true});
    return api;
  }
  function stop(){stopped=true;started=false;audit.started=false;audit.connected=false;clearReconnect();clearHeartbeat();for(const [target,event,handler,options] of listeners.splice(0))try{target.removeEventListener(event,handler,options);}catch{}try{socket?.close?.();}catch{}socket=null;return true;}

  const api=Object.freeze({
    version:VERSION,start,stop,refresh,publish,
    get envelope(){return envelope;},
    get revision(){return envelope?.revision||0;},
    get connected(){return audit.connected;},
    get audit(){return Object.freeze({...audit});}
  });
  try{root.KELO_WORLD_ENVIRONMENT_SYNC=api;}catch{}
  if(autoStart&&root?.document)void start();
  return api;
}

if(typeof window!=='undefined'&&window.document)installWorldEnvironmentSync(window);

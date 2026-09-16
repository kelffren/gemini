/* KELO-INDEX
 * area: ENVIRONMENT / RUNTIME
 * owner: active world environment state
 * owns: native time/weather/ambient rendering, temporary previews and locally cached canonical state
 * does-not-own: network transport, publish authorization, map versioning or gameplay rules
 */
const VERSION='kelo-environment-runtime-v2';
const STORAGE_KEY='kelo.world.environment.active.v1';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const VALID={
  biome:new Set(['plaza','city','forest','swamp','desert','snow','coast']),
  weather:new Set(['clear','rain','fog','storm','snow']),
  timeOfDay:new Set(['dawn','day','sunset','night'])
};
const BIOME_ACCENT={plaza:'#c9a55f',city:'#7f9eb8',forest:'#2f7d55',swamp:'#4e6f58',desert:'#b58a4b',snow:'#9fc8dc',coast:'#4b9cb8'};
const PARTICLES=Object.freeze(Array.from({length:40},(_,i)=>Object.freeze({x:(i*37+11)%101,y:(i*61+7)%107,speed:.32+(i%7)*.08,size:1+(i%3),drift:((i%5)-2)*.8})));

function fieldSource(value={}){return value?.fields&&typeof value.fields==='object'?{...value.fields,accent:value.accent??value.fields.accent}:value||{};}
export function normalizeEnvironmentState(value={}){
  const src=fieldSource(value),biome=VALID.biome.has(String(src.biome))?String(src.biome):'plaza',weather=VALID.weather.has(String(src.weather))?String(src.weather):'clear',timeOfDay=VALID.timeOfDay.has(String(src.timeOfDay))?String(src.timeOfDay):'day';
  return Object.freeze({biome,weather,timeOfDay,ambientDensity:clamp(src.ambientDensity??50,0,100),musicMood:String(src.musicMood||'calm').slice(0,80),accent:String(src.accent||BIOME_ACCENT[biome]||'#7f9eb8').slice(0,32),updatedAt:Date.now()});
}
function safeParse(raw){try{return raw?JSON.parse(raw):null;}catch{return null;}}
function emit(root,name,detail){try{root.dispatchEvent?.(new root.CustomEvent(name,{detail}));}catch{}}
function rgba(hex,alpha){const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return `rgba(100,130,160,${alpha})`;const n=parseInt(m[1],16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;}
function timeColor(time,density){const k=.7+.3*(density/100);if(time==='night')return `rgba(2,9,28,${(.44*k).toFixed(3)})`;if(time==='sunset')return `rgba(166,61,45,${(.20*k).toFixed(3)})`;if(time==='dawn')return `rgba(90,70,135,${(.16*k).toFixed(3)})`;return `rgba(72,142,205,${(.045*k).toFixed(3)})`;}

export function installEnvironmentRuntime(root=globalThis){
  if(root?.KELO_ENVIRONMENT_RUNTIME?.version===VERSION)return root.KELO_ENVIRONMENT_RUNTIME;
  let approved=normalizeEnvironmentState(safeParse(root?.localStorage?.getItem?.(STORAGE_KEY))||{}),current=approved,previewBase=null,registered=false,lastRevision=0,lastPublicationMeta=null;

  function drawFog(g,w,h,t,density){const a=.06+.16*(density/100);g.fillStyle=`rgba(225,235,238,${a})`;for(let i=0;i<6;i++){const x=((i*191+t*.012*(i%2?1:-1))%(w+360))-180,y=h*(.25+(i%4)*.18),rx=160+(i%3)*70,ry=55+(i%2)*35;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}}
  function drawWeather(g,w,h,t,state){
    if(state.weather==='clear'||state.weather==='fog')return;const count=Math.round(8+24*(state.ambientDensity/100));
    if(state.weather==='rain'||state.weather==='storm'){g.strokeStyle='rgba(202,224,246,.62)';g.lineWidth=1;g.beginPath();for(let i=0;i<count;i++){const p=PARTICLES[i],x=((p.x/100*w)+(t*.22*p.drift))%w,y=((p.y/100*h)+t*p.speed)%h;g.moveTo(x,y);g.lineTo(x+3,y+18+p.size*3);}g.stroke();}
    else if(state.weather==='snow'){g.fillStyle='rgba(248,252,255,.88)';for(let i=0;i<count;i++){const p=PARTICLES[i],x=((p.x/100*w)+Math.sin(t*.001+i)*18)%w,y=((p.y/100*h)+t*p.speed*.22)%h;g.beginPath();g.arc(x,y,1.6+p.size*.55,0,Math.PI*2);g.fill();}}
    if(state.weather==='storm'&&Math.floor(t/170)%29===0){g.fillStyle='rgba(244,248,255,.16)';g.fillRect(0,0,w,h);}
  }
  function draw(g){
    const canvas=g?.canvas;if(!canvas)return;const w=canvas.width||0,h=canvas.height||0;if(w<2||h<2)return;const t=root.performance?.now?.()||Date.now(),state=current,density=state.ambientDensity;
    g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle=timeColor(state.timeOfDay,density);g.fillRect(0,0,w,h);
    const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,rgba(state.accent,.13+.12*(density/100)));g.fillStyle=grad;g.fillRect(0,0,w,h);
    if(state.weather==='fog')drawFog(g,w,h,t,density);drawWeather(g,w,h,t,state);
    const vignette=g.createRadialGradient(w*.5,h*.44,Math.min(w,h)*.18,w*.5,h*.44,Math.max(w,h)*.72);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,`rgba(0,0,0,${.16+.18*(density/100)})`);g.fillStyle=vignette;g.fillRect(0,0,w,h);g.restore();
  }
  function register(){
    if(registered)return true;const layers=root?.KELO_ENVIRONMENT_LAYERS;if(!layers?.register)return false;
    try{layers.register({id:'runtime-environment-state',phase:'vfx_weather_lighting',priority:900,required:false,visibleDuringReset:true,ownership:'environment-runtime',ready:()=>true,draw});registered=true;return true;}catch(error){if(String(error?.message||error).includes('duplicate layer')){registered=true;return true;}console.error('[Kelo Environment Runtime] layer registration failed',error);return false;}
  }
  function persistApproved(){try{root.localStorage?.setItem?.(STORAGE_KEY,JSON.stringify(approved));}catch{}}
  function set(next,{temporary=false,persist=false,source='runtime'}={}){
    const normalized=normalizeEnvironmentState(next);if(temporary&&previewBase===null)previewBase=current;if(!temporary)previewBase=null;current=normalized;
    if(persist){approved=normalized;persistApproved();}
    register();emit(root,'kelo:environment-changed',Object.freeze({state:current,approved,temporary:!!temporary,persistent:!!persist,source,revision:lastRevision}));return current;
  }
  function applyTemporary(next,{source='creator'}={}){const state=set(next,{temporary:true,persist:false,source});return Object.freeze({ok:true,mode:'native-runtime',temporary:true,persistent:false,state,message:`NATIVE TEST · ${state.biome} / ${state.weather} / ${state.timeOfDay}`});}
  function restoreTemporary(reason='manual'){if(previewBase!==null){current=previewBase;previewBase=null;}else current=approved;emit(root,'kelo:environment-changed',Object.freeze({state:current,approved,temporary:false,persistent:true,source:`restore:${reason}`,revision:lastRevision}));return Object.freeze({ok:true,restored:true,state:current,message:'Native environment restored'});}
  function publish(next,{source='creator-approved',revision=null,updatedAt=null,updatedBy=null}={}){
    if(revision!=null)lastRevision=Math.max(lastRevision,Math.trunc(Number(revision)||0));lastPublicationMeta=Object.freeze({revision:lastRevision,updatedAt,updatedBy,source});
    const state=set(next,{temporary:false,persist:true,source});return Object.freeze({ok:true,temporary:false,persistent:true,state,revision:lastRevision,message:`ACTIVE ENVIRONMENT · ${state.biome} / ${state.weather} / ${state.timeOfDay}`});
  }
  function receivePublished(next,{source='world-sync',revision=null,updatedAt=null,updatedBy=null}={}){
    const incomingRevision=Math.max(0,Math.trunc(Number(revision)||0));if(incomingRevision&&lastRevision&&incomingRevision<lastRevision)return Object.freeze({ok:false,stale:true,state:current,revision:lastRevision});
    const normalized=normalizeEnvironmentState(next);approved=normalized;persistApproved();if(incomingRevision)lastRevision=incomingRevision;lastPublicationMeta=Object.freeze({revision:lastRevision,updatedAt,updatedBy,source});
    const previewActive=previewBase!==null;if(previewActive)previewBase=approved;else current=approved;
    register();emit(root,'kelo:environment-changed',Object.freeze({state:current,approved,temporary:previewActive,persistent:true,source,revision:lastRevision,remote:true}));
    return Object.freeze({ok:true,remote:true,previewPreserved:previewActive,state:current,approved,revision:lastRevision});
  }
  function reset(){previewBase=null;lastRevision=0;lastPublicationMeta=null;approved=normalizeEnvironmentState({});current=approved;try{root.localStorage?.removeItem?.(STORAGE_KEY);}catch{}emit(root,'kelo:environment-changed',Object.freeze({state:current,approved,temporary:false,persistent:false,source:'reset',revision:0}));return current;}

  const api=Object.freeze({version:VERSION,applyTemporary,restoreTemporary,publish,receivePublished,reset,refreshLayer:register,get state(){return current;},get approved(){return approved;},get temporary(){return previewBase!==null;},get revision(){return lastRevision;},get publicationMeta(){return lastPublicationMeta;}});root.KELO_ENVIRONMENT_RUNTIME=api;register();emit(root,'kelo:environment-runtime-ready',Object.freeze({version:VERSION,state:current}));return api;
}

if(typeof window!=='undefined'&&window.document)installEnvironmentRuntime(window);

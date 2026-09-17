/* KELO-INDEX
 * area: FOUNDATION / EVERGREEN / RUNTIME COMPATIBILITY
 * owner: Kelo Evergreen Runtime Compatibility
 * keys: FEATURE DETECTION CAPABILITY FALLBACK SAFARI IOS WEBKIT PROGRESSIVE ENHANCEMENT
 * purpose: detect web-platform capabilities without browser/version sniffing and derive a safe runtime degradation profile
 * public-api: RUNTIME_CAPABILITY_SPECS, detectRuntimeCapabilities, createRuntimeCompatibilityPlan, assertCoreRuntimeCompatible
 * state-owned: none; returns immutable snapshots only
 * online: reports online transport capabilities but owns no connection or authority
 * extension-points: add capability descriptors with deterministic probes and explicit fallbacks
 * do-not: NO userAgent gating, NO browser-name branching, NO gameplay mutation, NO provider calls
 */

const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze({...row})));

export const RUNTIME_CAPABILITY_SPECS=freezeRows([
  {id:'es-modules',tier:'core',fallback:null,probe:()=>true},
  {id:'promise',tier:'core',fallback:null,probe:env=>typeof env?.Promise==='function'},
  {id:'url',tier:'core',fallback:null,probe:env=>typeof env?.URL==='function'},
  {id:'fetch',tier:'core',fallback:null,probe:env=>typeof env?.fetch==='function'},
  {id:'canvas-2d',tier:'core',fallback:null,probe:env=>canCreateCanvasContext(env,'2d')},
  {id:'websocket',tier:'online',fallback:'request-response transport or reconnect screen',probe:env=>typeof env?.WebSocket==='function'},
  {id:'service-worker',tier:'enhancement',fallback:'online-first direct network path',probe:env=>Boolean(env?.navigator&&'serviceWorker' in env.navigator)},
  {id:'indexed-db',tier:'enhancement',fallback:'memory/session cache only',probe:env=>Boolean(env?.indexedDB)},
  {id:'webgl2',tier:'enhancement',fallback:'Canvas2D/WebGL1 presentation path',probe:env=>canCreateCanvasContext(env,'webgl2')},
  {id:'offscreen-canvas',tier:'enhancement',fallback:'main-thread canvas work with budgets',probe:env=>typeof env?.OffscreenCanvas==='function'},
  {id:'image-bitmap',tier:'enhancement',fallback:'HTMLImageElement/canvas decode path',probe:env=>typeof env?.createImageBitmap==='function'},
  {id:'compression-stream',tier:'enhancement',fallback:'server/build compression or uncompressed payload',probe:env=>typeof env?.CompressionStream==='function'},
  {id:'web-locks',tier:'enhancement',fallback:'single-owner in-process coordination',probe:env=>Boolean(env?.navigator?.locks&&typeof env.navigator.locks.request==='function')},
  {id:'broadcast-channel',tier:'enhancement',fallback:'storage/event bridge or single-tab mode',probe:env=>typeof env?.BroadcastChannel==='function'},
  {id:'structured-clone',tier:'enhancement',fallback:'domain serializer/JSON-safe clone',probe:env=>typeof env?.structuredClone==='function'},
  {id:'visual-viewport',tier:'enhancement',fallback:'window innerWidth/innerHeight viewport math',probe:env=>Boolean(env?.visualViewport)},
  {id:'pointer-events',tier:'enhancement',fallback:'touch/mouse input adapters',probe:env=>typeof env?.PointerEvent==='function'},
  {id:'resize-observer',tier:'enhancement',fallback:'resize event plus explicit layout refresh',probe:env=>typeof env?.ResizeObserver==='function'},
  {id:'intersection-observer',tier:'enhancement',fallback:'viewport math/residency budget path',probe:env=>typeof env?.IntersectionObserver==='function'}
]);

function canCreateCanvasContext(env,name){
  try{
    const doc=env?.document;
    if(!doc||typeof doc.createElement!=='function')return false;
    const canvas=doc.createElement('canvas');
    return Boolean(canvas&&typeof canvas.getContext==='function'&&canvas.getContext(name));
  }catch{return false;}
}

function probe(spec,env){
  try{return Boolean(spec.probe(env));}catch{return false;}
}

export function detectRuntimeCapabilities(env=globalThis){
  const rows=RUNTIME_CAPABILITY_SPECS.map(spec=>Object.freeze({
    id:spec.id,
    tier:spec.tier,
    supported:probe(spec,env),
    fallback:spec.fallback
  }));
  return Object.freeze({
    schemaVersion:1,
    capabilities:Object.freeze(rows),
    byId:Object.freeze(Object.fromEntries(rows.map(row=>[row.id,row])))
  });
}

export function createRuntimeCompatibilityPlan(snapshot=detectRuntimeCapabilities()){
  const rows=Array.isArray(snapshot?.capabilities)?snapshot.capabilities:[];
  const missingCore=rows.filter(row=>row.tier==='core'&&!row.supported);
  const missingOnline=rows.filter(row=>row.tier==='online'&&!row.supported);
  const degraded=rows.filter(row=>row.tier==='enhancement'&&!row.supported);
  const fallbacks=rows
    .filter(row=>!row.supported&&row.fallback)
    .map(row=>Object.freeze({capability:row.id,fallback:row.fallback}));
  const mode=missingCore.length?'unsupported':(missingOnline.length?'degraded-online':(degraded.length?'degraded':'full'));
  return Object.freeze({
    mode,
    compatible:missingCore.length===0,
    onlineReady:missingCore.length===0&&missingOnline.length===0,
    missingCore:Object.freeze(missingCore.map(row=>row.id)),
    missingOnline:Object.freeze(missingOnline.map(row=>row.id)),
    degraded:Object.freeze(degraded.map(row=>row.id)),
    fallbacks:Object.freeze(fallbacks)
  });
}

export function assertCoreRuntimeCompatible(snapshot=detectRuntimeCapabilities()){
  const plan=createRuntimeCompatibilityPlan(snapshot);
  if(!plan.compatible)throw new Error(`EVERGREEN_RUNTIME_INCOMPATIBLE:${plan.missingCore.join(',')}`);
  return plan;
}

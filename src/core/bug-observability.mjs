const DEFAULT_KEY='kelo:bug-observability:v1';

function safeStorage(root){
  try{return root?.sessionStorage||null;}catch{return null;}
}
function now(){return new Date().toISOString();}
function trim(value,max=500){const s=String(value??'');return s.length>max?s.slice(0,max)+'…':s;}

export function createBugObserver({root=globalThis,flow='unknown',bugId=null,version=null,storageKey=DEFAULT_KEY,maxEvents=80}={}){
  const storage=safeStorage(root);
  const read=()=>{
    try{const parsed=JSON.parse(storage?.getItem(storageKey)||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
  };
  const write=events=>{try{storage?.setItem(storageKey,JSON.stringify(events.slice(-maxEvents)));}catch{}};
  const mark=(milestone,data={})=>{
    const event={at:now(),flow,bugId,version,milestone:trim(milestone,80),data:{}};
    for(const [k,v] of Object.entries(data||{}))event.data[trim(k,80)]=trim(v,300);
    const events=read();events.push(event);write(events);
    try{root.dispatchEvent?.(new CustomEvent('kelo:bug-milestone',{detail:event}));}catch{}
    return event;
  };
  const fail=(error,phase='UNHANDLED')=>mark('FAIL',{phase,name:error?.name||'Error',message:error?.message||error,stack:error?.stack||''});
  return Object.freeze({mark,fail,read,clear(){try{storage?.removeItem(storageKey);}catch{}},last(){const e=read();return e[e.length-1]||null;}});
}

export function installBugErrorCapture({root=globalThis,observer=createBugObserver({root,flow:'global'})}={}){
  if(root.__keloBugErrorCaptureInstalled)return observer;
  root.__keloBugErrorCaptureInstalled=true;
  try{root.addEventListener('error',event=>observer.fail(event.error||event.message,'window.error'));}catch{}
  try{root.addEventListener('unhandledrejection',event=>observer.fail(event.reason,'unhandledrejection'));}catch{}
  return observer;
}

/* KELO-INDEX
 * area: STUDIO / DIAGNOSTICS / WORLD SURGERY
 * purpose: compatibility shim that exposes ONE surgery control plane everywhere
 * source-of-truth: ./world-surgery-control.mjs
 * safety: no independent config/storage; all callers share the same flags and flight recorder
 */

import {getWorldSurgery,openWorldSurgeryControl} from './world-surgery-control.mjs';

const LEGACY_CONFIG_KEY='kelo.worldSurgery.config.v1';
const NEW_CONFIG_KEY='kelo.world-surgery.config.v1';
const LEGACY_MAP=Object.freeze({indexedDbStore:'storage',explorerController:'explorerRange',shell:'studioShell'});

function migrateLegacyConfig(root,base){
  try{
    if(root.localStorage?.getItem(NEW_CONFIG_KEY))return;
    const raw=root.localStorage?.getItem(LEGACY_CONFIG_KEY);
    if(!raw)return;
    const legacy=JSON.parse(raw);
    const known=new Set((base.modules||[]).map(row=>row.id));
    for(const [legacyKey,value] of Object.entries(legacy||{})){
      const key=LEGACY_MAP[legacyKey]||legacyKey;
      if(known.has(key))base.setEnabled(key,value!==false);
    }
  }catch(error){
    console.warn('[World Surgery] legacy config migration skipped',error);
  }
}

export function installWorldSurgery({root=globalThis}={}){
  const existing=root.KELO_WORLD_SURGERY;
  if(existing?.version==='world-surgery-v1.1.0-unified')return existing;

  const base=getWorldSurgery({root});
  migrateLegacyConfig(root,base);
  const tokens=new Map();

  const api=Object.freeze({
    ...base,
    version:'world-surgery-v1.1.0-unified',

    // Compatibility names used by earlier surgical wiring.
    moduleStart(key,phase='runtime',meta={}){
      const token=base.start(key,phase,meta);
      if(token)tokens.set(key,token);
      return token;
    },
    moduleDone(key,tokenOrMeta=null,maybeMeta={}){
      const token=tokenOrMeta&&typeof tokenOrMeta==='object'&&tokenOrMeta.id?tokenOrMeta:tokens.get(key)||null;
      const meta=tokenOrMeta&&typeof tokenOrMeta==='object'&&!tokenOrMeta.id?tokenOrMeta:maybeMeta;
      if(token)base.done(token,meta||{});
      tokens.delete(key);
    },
    moduleDisabled(key,phase='runtime'){
      base.markStatus(key,'DISABLED',{phase});
      tokens.delete(key);
    },
    moduleFailed(key,error){
      const token=tokens.get(key)||null;
      if(token)base.fail(token,error);
      else base.markStatus(key,'FAILED',{message:String(error?.message||error||'UNKNOWN')});
      tokens.delete(key);
    },

    openPanel(){return openWorldSurgeryControl({root});},
    markBisect(result){return base.recordBisect(result);},
    resetFlight(){return base.clearFlight();},
    get config(){return base.getConfig().flags;},
    get flight(){return base.getFlight();},
    get bisect(){return base.getBisect();}
  });

  root.KELO_WORLD_SURGERY=api;
  return api;
}

export function openWorldSurgeryPanel({root=globalThis}={}){
  installWorldSurgery({root});
  return openWorldSurgeryControl({root});
}

if(typeof window!=='undefined')installWorldSurgery({root:window});

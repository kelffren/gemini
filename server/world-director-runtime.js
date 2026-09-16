/* KELO-INDEX
 * area: SERVER / WORLD DIRECTOR
 * owner: KeloWorldDirectorRuntime
 * keys: HOURLY SCHEDULER SNAPSHOT DOCUMENT ATOMIC WRITE SINGLE TIMER
 * purpose: ejecuta un unico ciclo horario, sobrescribe un documento compacto y publica la propuesta validada
 * public-api: createWorldDirectorRuntime().start/stop/runNow/record/presence/current/status
 * consumes: world-director-service
 * state-owned: un timer horario y latest-world-director.json
 * online: vive solo en server; el cliente nunca decide evento/recompensa
 * do-not: NO timer por jugador, NO historial infinito, NO guardar chat/posiciones crudas
 */
'use strict';
const fs=require('fs');
const path=require('path');
const os=require('os');
const {createWorldDirector}=require('./world-director-service');

const HOUR_MS=60*60*1000;

function createAtomicSnapshotWriter(directory){
  const dir=directory||process.env.KELO_WORLD_DIRECTOR_SNAPSHOT_DIR||path.join(os.tmpdir(),'kelo-world-director');
  const target=path.join(dir,'latest-world-director.json');
  return Object.freeze({
    path:target,
    async write(snapshot,event){
      await fs.promises.mkdir(dir,{recursive:true});
      const tmp=`${target}.${process.pid}.tmp`;
      const body=JSON.stringify({schemaVersion:1,writtenAt:Date.now(),snapshot,event},null,2)+'\n';
      await fs.promises.writeFile(tmp,body,{encoding:'utf8',mode:0o600});
      await fs.promises.rename(tmp,target);
      return target;
    }
  });
}

function createWorldDirectorRuntime(options={}){
  const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
  const writer=options.writer||createAtomicSnapshotWriter(options.snapshotDir);
  const beforeGenerate=typeof options.beforeGenerate==='function'?options.beforeGenerate:null;
  let timer=null,running=false,lastRun=null;
  const director=options.director||createWorldDirector({
    clock,
    aiGenerator:options.aiGenerator,
    openai:options.openai,
    maxPlayers:options.maxPlayers,
    persistSnapshot:(snapshot,event)=>writer.write(snapshot,event),
    publishEvent:options.publishEvent
  });

  function msToNextHour(now){const next=(Math.floor(now/HOUR_MS)+1)*HOUR_MS;return Math.max(1000,next-now);}
  async function runNow(runOptions={}){if(running)return{ok:false,skipped:true,reason:'RUN_IN_PROGRESS'};running=true;try{if(beforeGenerate)await beforeGenerate(director);const result=await director.generate(clock(),runOptions);lastRun={at:clock(),ok:!!result.ok,source:result.source||null,eventId:result.event&&result.event.id||null,skipped:!!result.skipped};return result;}finally{running=false;}}
  function scheduleNext(){if(timer)clearTimeout(timer);const delay=msToNextHour(clock());timer=setTimeout(async()=>{try{await runNow();}catch(error){console.error('[KeloWorldDirector]',error);}finally{scheduleNext();}},delay);if(typeof timer.unref==='function')timer.unref();}
  function start(){if(timer)return false;scheduleNext();return true;}
  function stop(){if(!timer)return false;clearTimeout(timer);timer=null;return true;}
  function status(){return Object.freeze({running,scheduled:!!timer,snapshotPath:writer.path||null,lastRun,director:director.audit()});}

  return Object.freeze({version:'kelo-world-director-runtime-v1.0.1',start,stop,runNow,record:director.record,presence:director.presence,current:director.current,status,director});
}

module.exports={createWorldDirectorRuntime,createAtomicSnapshotWriter};

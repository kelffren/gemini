/* KELO-INDEX
 * area: TEST / WORLD DIRECTOR
 * keys: WORLD DIRECTOR RUNTIME HOURLY DOCUMENT ATOMIC PRIVACY
 * hace: valida que el runtime produzca un unico documento horario sin identidades de jugador
 * online: N/A; smoke server-side
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createWorldDirectorRuntime}=require('./world-director-runtime');

(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-world-director-test-'));
  let now=Date.UTC(2026,8,16,7,0,0);
  const runtime=createWorldDirectorRuntime({clock:()=>now,snapshotDir:dir,aiGenerator:false});
  for(let i=0;i<10;i++)runtime.record(`p${i}`,'presence',{zoneId:'plaza',partySize:1});
  const result=await runtime.runNow({force:true});
  assert.equal(result.ok,true);assert.ok(result.event);
  const target=path.join(dir,'latest-world-director.json');
  assert.equal(fs.existsSync(target),true);
  const doc=JSON.parse(fs.readFileSync(target,'utf8'));
  assert.equal(doc.snapshot.activePlayers,10);
  assert.equal(JSON.stringify(doc).includes('p0'),false,'hourly document must not contain player identity');
  assert.equal(runtime.status().snapshotPath,target);
  console.log('world-director runtime smoke PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});

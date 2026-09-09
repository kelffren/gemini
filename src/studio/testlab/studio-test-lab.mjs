/* KELO-INDEX
 * area: STUDIO / TEST LAB
 * owner: reusable isolated test-fixture lifecycle
 * owns: fixture reset/run/step/event log orchestration only
 * does-not-own: gameplay rules, UI, persistence, networking, LIVE state or domain adapters
 * reuse: Ability first; mounts/items/NPC/balance workspaces can provide their own adapter
 */
const clone=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
export function createStudioTestLab({fixtureFactory,executor,stepper=null,cleanup=null,describe=null,onState=null}={}){
  if(typeof fixtureFactory!=='function')throw new Error('STUDIO_TEST_LAB_FIXTURE_FACTORY_REQUIRED');
  if(typeof executor!=='function')throw new Error('STUDIO_TEST_LAB_EXECUTOR_REQUIRED');
  let fixture=null,events=[],running=false,runId=0,disposed=false;
  const emitState=()=>{try{onState?.(snapshot());}catch{}};
  function emit(type,data={}){const row=Object.freeze({id:`test-event:${++runId}:${events.length+1}`,type:String(type||'EVENT'),at:Date.now(),data:Object.freeze(clone(data)||{})});events.push(row);if(events.length>80)events=events.slice(-80);emitState();return row;}
  function viewFixture(){return clone(typeof describe==='function'?describe(fixture):fixture);}
  function snapshot(){return Object.freeze({version:'studio-test-lab-v1.0.0',running,runId,fixture:viewFixture(),events:Object.freeze(events.map(clone))});}
  function ensure(){if(disposed)throw new Error('STUDIO_TEST_LAB_DISPOSED');if(!fixture)reset();return fixture;}
  function reset(config={}){if(disposed)throw new Error('STUDIO_TEST_LAB_DISPOSED');if(fixture&&typeof cleanup==='function')try{cleanup(fixture);}catch{}fixture=fixtureFactory(clone(config)||{});events=[];runId++;emit('FIXTURE_RESET',{config:clone(config)||{}});return snapshot();}
  async function run(input={}){const current=ensure();if(running)throw new Error('STUDIO_TEST_LAB_ALREADY_RUNNING');running=true;emit('RUN_STARTED',{});try{const result=await executor({fixture:current,input,emit});emit('RUN_COMPLETE',{ok:result?.ok!==false,reason:result?.reason||null});return Object.freeze(clone(result)||{});}catch(error){emit('RUN_FAILED',{message:error?.message||String(error)});throw error;}finally{running=false;emitState();}}
  async function step(seconds=1){const current=ensure();if(typeof stepper!=='function')throw new Error('STUDIO_TEST_LAB_STEPPER_UNAVAILABLE');const dt=Math.max(0,Number(seconds)||0),result=await stepper({fixture:current,seconds:dt,emit});emit('TIME_ADVANCED',{seconds:dt});emitState();return Object.freeze(clone(result)||{});}
  function destroy(){if(disposed)return false;disposed=true;if(fixture&&typeof cleanup==='function')try{cleanup(fixture);}catch{}fixture=null;events=[];running=false;return true;}
  reset();
  return Object.freeze({version:'studio-test-lab-v1.0.0',run,step,reset,snapshot,destroy,get running(){return running;}});
}

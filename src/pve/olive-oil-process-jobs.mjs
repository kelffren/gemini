/* KELO-INDEX
 * area: ECON / OLIVE OIL PROCESS JOBS
 * owner: KeloOliveOilProcessJobs
 * purpose: event-driven timed station jobs and collectible outputs for olive production
 * consumes: KeloProductionChain; inventory adapter supplied by caller
 * do-not: NO interval/RAF, NO second inventory, NO recipe duplication
 */
const F=Object.freeze;
export function create({recipes=globalThis.KeloProductionChain,now=()=>Date.now(),consume,give}={}){
 if(!recipes||!consume||!give)throw Error('OLIVE_PROCESS_FOUNDATION_UNAVAILABLE');const jobs=new Map();
 function start(stationId,recipeId){const old=jobs.get(stationId);if(old&&old.state!=='COLLECTED')return{ok:false,error:'STATION_BUSY',job:snapshot(stationId)};const r=recipes.getRecipe(recipeId);if(!r)return{ok:false,error:'RECIPE_NOT_FOUND'};const c=consume(r.inputs);if(!c.ok)return c;const t=now(),job={stationId,recipeId,state:'PROCESSING',startedAt:t,readyAt:t+r.seconds*1000,outputs:r.outputs};jobs.set(stationId,job);return{ok:true,job:snapshot(stationId)}}
 function snapshot(stationId){const j=jobs.get(stationId);if(!j)return null;if(j.state==='PROCESSING'&&now()>=j.readyAt)j.state='READY';return F({...j,outputs:F({...j.outputs}),remainingMs:j.state==='PROCESSING'?Math.max(0,j.readyAt-now()):0})}
 function collect(stationId){const j=jobs.get(stationId),s=snapshot(stationId);if(!j)return{ok:false,error:'NO_JOB'};if(s.state!=='READY')return{ok:false,error:'NOT_READY',job:s};for(const [id,n] of Object.entries(j.outputs)){const r=give(id,n);if(!r.ok)return r}j.state='COLLECTED';return{ok:true,job:snapshot(stationId),outputs:{...j.outputs}}}
 return F({start,snapshot,collect,list:()=>F([...jobs.keys()].map(snapshot))});
}

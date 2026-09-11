/* KELO-INDEX
 * area: CREATORS / EVOLUTION / MEMORY
 * owner: KeloEvolution experiment-memory contract
 * purpose: keep deterministic experiment/champion records without owning persistence
 * public-api: createEvolutionMemory, recordEvolutionExperiment, promoteEvolutionChampion, summarizeEvolutionMemory, mutationFailureCount
 * consumes: serializable evolution reports supplied by callers
 * state-owned: none; every operation returns a new immutable snapshot
 * online: persistence remains external and can move from Git artifacts to server storage without changing this contract
 * do-not: no localStorage, Git writes, network, gameplay state or hidden mutation
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const finite=value=>Number.isFinite(Number(value));
const text=value=>String(value??'').trim();

export function createEvolutionMemory({systemId='generic',champion=null,entries=[]}={}){
  if(!Array.isArray(entries))throw new Error('EVOLUTION_MEMORY_ENTRIES_ARRAY_REQUIRED');
  return freeze({schema:'kelo-evolution-memory-v1',systemId:text(systemId)||'generic',champion:champion?copy(champion):null,entries:entries.map(copy)});
}

export function recordEvolutionExperiment(memoryInput,record,{maxEntries=250}={}){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(record?.id);
  if(!id)throw new Error('EVOLUTION_EXPERIMENT_ID_REQUIRED');
  const entry=freeze({id,at:text(record?.at)||null,sourceSha:text(record?.sourceSha)||null,candidateId:text(record?.candidateId)||null,accepted:Boolean(record?.accepted),baselineScore:finite(record?.baselineScore)?Number(record.baselineScore):null,candidateScore:finite(record?.candidateScore)?Number(record.candidateScore):null,delta:finite(record?.delta)?Number(record.delta):null,mutations:copy(record?.mutations||[]),metrics:copy(record?.metrics||{}),failures:copy(record?.failures||[]),artifacts:copy(record?.artifacts||[])});
  const withoutDuplicate=memory.entries.filter(row=>row.id!==id),limit=Math.max(1,Math.min(5000,Math.floor(Number(maxEntries)||250))),entries=[...withoutDuplicate,entry].slice(-limit);
  return createEvolutionMemory({...memory,entries});
}

export function promoteEvolutionChampion(memoryInput,{candidateId,score,fingerprint=null,metadata={}}={}){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(candidateId);
  if(!id||!finite(score))throw new Error('EVOLUTION_CHAMPION_INVALID');
  return createEvolutionMemory({...memory,champion:{candidateId:id,score:Number(score),fingerprint:text(fingerprint)||null,metadata:copy(metadata)}});
}

export function mutationFailureCount(memoryInput,mutationId){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(mutationId);if(!id)return 0;
  let count=0;for(const entry of memory.entries){if(entry.accepted)continue;for(const mutation of entry.mutations||[])if(text(mutation?.geneId||mutation?.key)===id)count++;}
  return count;
}

export function summarizeEvolutionMemory(memoryInput){
  const memory=createEvolutionMemory(memoryInput||{}),accepted=memory.entries.filter(row=>row.accepted),rejected=memory.entries.length-accepted.length,deltas=accepted.map(row=>row.delta).filter(finite).map(Number);
  return freeze({systemId:memory.systemId,experiments:memory.entries.length,accepted:accepted.length,rejected,acceptanceRate:memory.entries.length?accepted.length/memory.entries.length:0,meanAcceptedDelta:deltas.length?deltas.reduce((sum,value)=>sum+value,0)/deltas.length:0,champion:copy(memory.champion)});
}

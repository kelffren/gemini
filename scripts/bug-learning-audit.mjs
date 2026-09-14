/* KELO-INDEX
 * area: QA / BUGS / EVOLUTION
 * owner: Bug Intelligence learning contract audit
 * purpose: verify bounded autonomous-learning state, stale-policy handling and non-escalation safety invariants
 * public-api: CLI [--strict]
 * consumes: bugs/learning/STATE.json, bugs/RISK_MAP.json, KeloEvolution fingerprint
 * state-owned: none
 * online: N/A
 * do-not: never mutate learning state or bug registry
 */

import fs from 'node:fs';
import path from 'node:path';
import {evolutionFingerprint} from '../src/creators/evolution/evolution-engine.mjs';

const root=process.cwd();
const strict=process.argv.includes('--strict');
const statePath=path.join(root,'bugs','learning','STATE.json');
const riskPath=path.join(root,'bugs','RISK_MAP.json');
const failures=[];
const warnings=[];
const finite=value=>Number.isFinite(Number(value));

if(!fs.existsSync(statePath)){console.error('BUG LEARNING AUDIT FAILED\n- bugs/learning/STATE.json missing');process.exit(1);}
let state=null,riskMap=null;
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch(error){failures.push(`STATE.json invalid JSON: ${error.message}`);}
try{riskMap=JSON.parse(fs.readFileSync(riskPath,'utf8'));}catch(error){failures.push(`RISK_MAP.json invalid JSON: ${error.message}`);}

if(state){
  if(state.schema!=='kelo-bug-learning-v1')failures.push(`unsupported schema ${state.schema}`);
  if(state.system_id!=='bug-intelligence')failures.push('system_id must be bug-intelligence');
  const safety=state.safety||{};
  if(JSON.stringify(safety.auto_write_scope)!==JSON.stringify(['bugs/learning/STATE.json']))failures.push('auto_write_scope must remain exactly bugs/learning/STATE.json');
  if(safety.arbitrary_source_code_writes!==false)failures.push('arbitrary_source_code_writes must be false');
  if(safety.bug_state_mutation!==false)failures.push('bug_state_mutation must be false');
  if(safety.auto_close!==false)failures.push('auto_close must be false');
  if(safety.requires_holdout_for_policy_promotion!==true)failures.push('requires_holdout_for_policy_promotion must be true');
  if(Number(safety.min_rule_multiplier)!==.75||Number(safety.max_rule_multiplier)!==1.75)failures.push('rule multiplier bounds changed from 0.75..1.75');
  if(Number(safety.max_hotspot_bonus)!==20)failures.push('max_hotspot_bonus must remain 20');

  const ruleIds=new Set((riskMap?.rules||[]).map(rule=>rule.id));
  for(const [id,value] of Object.entries(state.champion?.multipliers||{})){
    if(!ruleIds.has(id))failures.push(`champion multiplier references unknown risk rule ${id}`);
    if(!finite(value)||Number(value)<.75||Number(value)>1.75)failures.push(`multiplier ${id} out of bounds: ${value}`);
  }
  if(state.champion?.accepted_from_last_cycle===true&&Number(state.training?.holdout_examples||0)<2)failures.push('policy promoted without minimum holdout evidence');

  const seenFiles=new Set();
  for(const hotspot of state.hotspots||[]){
    const file=String(hotspot?.file||'').trim();
    if(!file)failures.push('hotspot missing file');
    if(seenFiles.has(file))failures.push(`duplicate hotspot ${file}`);seenFiles.add(file);
    if(!finite(hotspot?.risk_bonus)||Number(hotspot.risk_bonus)<0||Number(hotspot.risk_bonus)>20)failures.push(`hotspot ${file} risk_bonus out of bounds`);
    if(!['low','medium','high'].includes(hotspot?.confidence))failures.push(`hotspot ${file} invalid confidence ${hotspot?.confidence}`);
    if(!Array.isArray(hotspot?.bug_ids)||!Array.isArray(hotspot?.matched_rules)||!Array.isArray(hotspot?.recommended_tests))failures.push(`hotspot ${file} arrays malformed`);
  }
  if((state.hotspots||[]).length>60)failures.push('hotspot count exceeds 60');
  if((state.prevention_gaps||[]).length>80)failures.push('prevention gap count exceeds 80');

  const memory=state.memory||{};
  if(memory.schema!=='kelo-evolution-memory-v2')failures.push(`memory schema invalid ${memory.schema}`);
  if(memory.systemId!=='bug-intelligence-risk-policy')failures.push(`memory systemId invalid ${memory.systemId}`);
  if(!Array.isArray(memory.entries))failures.push('memory.entries must be array');
  if((memory.entries||[]).length>250)failures.push('memory exceeds 250 experiments');

  const dangerous=JSON.stringify(state);
  if(/"status"\s*:\s*"(?:VERIFIED|CLOSED)"/i.test(dangerous))failures.push('learning state must not encode bug lifecycle closure as authority');
  if(/authorization\s*[:=]\s*bearer\s+(?!<redacted>)/i.test(dangerous)||/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/.test(dangerous))failures.push('learning state appears to contain a credential/token');

  if(riskMap&&state.risk_map_fingerprint){
    const current=evolutionFingerprint(riskMap);
    if(current!==state.risk_map_fingerprint){
      const msg=`learning state stale for current RISK_MAP (${state.risk_map_fingerprint} != ${current})`;
      if(strict)failures.push(msg);else warnings.push(msg);
    }
  }
  if(state.source_fingerprint===null)warnings.push('learning state is initialized but has not learned from evidence yet');
}

if(warnings.length){console.log('BUG LEARNING AUDIT WARNINGS');for(const warning of warnings)console.log(`- ${warning}`);}
if(failures.length){console.error('BUG LEARNING AUDIT FAILED');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log(`BUG LEARNING AUDIT PASS — hotspots=${state?.hotspots?.length||0}, gaps=${state?.prevention_gaps?.length||0}, experiments=${state?.memory?.entries?.length||0}, warnings=${warnings.length}.`);

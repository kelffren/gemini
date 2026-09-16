/* KELO-INDEX
 * area: QA / FOUNDATION / LEGACY CONTAINMENT
 * owner: Kelo Legacy Containment
 * keys: SELFTEST NEGATIVE TEST FITNESS LEGACY
 * purpose: prove the containment fitness function allows comment-only/shrink changes and rejects executable/authority growth
 * public-api: CLI only
 * consumes: legacy-containment-audit.mjs pure inspection/comparison exports
 * state-owned: none
 * legacy: N/A; synthetic fixtures only
 * do-not: NO repository mutation, NO runtime import, NO network
 */
import {inspectLegacySource,compareLegacyMetrics,legacySemanticSource} from './legacy-containment-audit.mjs';

function compare(beforeText,afterText){
  return compareLegacyMetrics(inspectLegacySource(beforeText),inspectLegacySource(afterText),'fixture.js');
}
function assert(condition,message){
  if(!condition)throw new Error(`LEGACY_CONTAINMENT_SELFTEST_FAIL:${message}`);
}
function hasType(result,type){return result.violations.some(v=>v.type===type);}
function hasMetric(result,metric){return result.violations.some(v=>v.type==='metric-growth'&&v.metric===metric);}

const base=`const legacyValue=1;\nfunction stable(){return legacyValue;}\n`;

const comments=base+`// more explanation is allowed\n/* and documentation can grow */\n`;
assert(compare(base,comments).violations.length===0,'COMMENT_ONLY_MUST_PASS');
assert(legacySemanticSource(base)===legacySemanticSource(comments),'COMMENTS_MUST_NOT_CHANGE_SEMANTIC_SURFACE');

const shrink=`const legacyValue=1;\n`;
assert(compare(base,shrink).violations.length===0,'SHRINK_MUST_PASS');

const executable=base+`function newLegacyFeature(){return 2;}\n`;
const executableResult=compare(base,executable);
assert(hasMetric(executableResult,'semanticBytes'),'EXECUTABLE_GROWTH_MUST_FAIL');
assert(hasMetric(executableResult,'topLevelDeclarations'),'TOP_LEVEL_GROWTH_MUST_FAIL');

const globalWriter=base+`window.NewLegacyOwner={enabled:true};\n`;
const globalResult=compare(base,globalWriter);
assert(hasType(globalResult,'new-global-writer'),'NEW_GLOBAL_WRITER_MUST_FAIL');
assert(globalResult.newGlobals.includes('NewLegacyOwner'),'NEW_GLOBAL_NAME_MUST_BE_REPORTED');

const criticalWriter=base+`localPlayer.hp=99;\n`;
const criticalResult=compare(base,criticalWriter);
assert(hasType(criticalResult,'new-critical-writer'),'NEW_CRITICAL_WRITER_MUST_FAIL');
assert(criticalResult.newCriticalKeys.includes('localPlayer.hp'),'CRITICAL_KEY_MUST_BE_REPORTED');

const timerGrowth=base+`setInterval(()=>{},1000);\n`;
assert(hasMetric(compare(base,timerGrowth),'intervals'),'INTERVAL_GROWTH_MUST_FAIL');

const listenerGrowth=base+`window.addEventListener('legacy-test',()=>{});\n`;
assert(hasMetric(compare(base,listenerGrowth),'eventListeners'),'LISTENER_GROWTH_MUST_FAIL');

const storageGrowth=base+`localStorage.setItem('legacy','1');\n`;
assert(hasMetric(compare(base,storageGrowth),'localStorageWrites'),'PERSISTENCE_GROWTH_MUST_FAIL');

const domGrowth=base+`document.body.appendChild(document.createElement('div'));\n`;
const domResult=compare(base,domGrowth);
assert(hasMetric(domResult,'domMutations'),'DOM_RESPONSIBILITY_GROWTH_MUST_FAIL');

console.log(JSON.stringify({
  ok:true,
  cases:['comment-only-pass','shrink-pass','executable-block','global-writer-block','critical-writer-block','timer-block','listener-block','storage-block','dom-block']
},null,2));
console.log('LEGACY_CONTAINMENT_SELFTEST_PASS');

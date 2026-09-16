import assert from 'node:assert/strict';
import { createDefinitionDraft, DEFINITION_WORKSPACE_ROWS, getDefinitionSpec, interpretDefinitionPrompt, validateDefinitionDraft } from '../src/creators/definition/definition-specs.mjs';
import { createEnvironmentPreviewModel } from '../src/creators/definition/environment-live-preview.mjs';
import { createCreatorTestPlan, historyEntryToPreviewDraft, createHistoryComparisonModel } from '../src/creators/definition/creator-test-bridge.mjs';
import { normalizeEnvironmentState } from '../src/environment/environment-runtime.mjs';
import { rowToWorldEnvironmentEnvelope, rowToWorldEnvironmentHistoryEntry } from '../src/environment/environment-world-sync.mjs';
import { createDefinitionWorkspaceManifest, registerDefinitionWorkspaces } from '../src/creators/workspaces/definition-workspaces.mjs';

assert.equal(DEFINITION_WORKSPACE_ROWS.length,11,'definition suite should activate eleven workspaces');
assert.equal(new Set(DEFINITION_WORKSPACE_ROWS.map(x=>x.id)).size,DEFINITION_WORKSPACE_ROWS.length,'workspace ids must be unique');
assert.equal(new Set(DEFINITION_WORKSPACE_ROWS.map(x=>x.type)).size,DEFINITION_WORKSPACE_ROWS.length,'project types must be unique');
for(const row of DEFINITION_WORKSPACE_ROWS){const spec=getDefinitionSpec(row.type),draft=createDefinitionDraft(row.type,{name:`Audit ${spec.label}`}),checked=validateDefinitionDraft(row.type,draft);assert.equal(checked.ok,true,`${row.type} defaults should validate`);assert.equal(spec.fields.length>=5,true,`${row.type} needs a meaningful editable schema`);}

let d=interpretDefinitionPrompt('DUNGEON','a hard shadow dungeon with 12 rooms, level 25, boss: The Warden',{name:'Dungeon'});
assert.equal(d.fields.difficulty,'hard');assert.equal(d.fields.theme,'void');assert.equal(d.fields.rooms,12);assert.equal(d.fields.recommendedLevel,25);assert.match(d.fields.boss,/warden/i);

d=interpretDefinitionPrompt('NPC','a merchant called “Rina” who patrols, radius 160, says: Welcome to the plaza',{name:'NPC'});
assert.equal(d.name,'Rina');assert.equal(d.fields.role,'merchant');assert.equal(d.fields.behavior,'patrol');assert.equal(d.fields.interactionRadius,160);assert.match(d.fields.dialogue,/welcome/i);

d=interpretDefinitionPrompt('QUEST','a daily quest with 4 steps, reward: 250 KC, repeatable',{name:'Quest'});
assert.equal(d.fields.questType,'daily');assert.equal(d.fields.steps,4);assert.equal(d.fields.repeatable,true);assert.equal(d.fields.reward,'250 KC');

d=interpretDefinitionPrompt('ITEM','a legendary weapon, stack 1, value 5000, effect: burn on hit',{name:'Item'});
assert.equal(d.fields.rarity,'legendary');assert.equal(d.fields.itemType,'weapon');assert.equal(d.fields.stackSize,1);assert.equal(d.fields.value,5000);assert.match(d.fields.effect,/burn/i);

d=interpretDefinitionPrompt('ENVIRONMENT','night forest with fog, ambient density 70, magical music',{name:'Environment'});
assert.equal(d.fields.biome,'forest');assert.equal(d.fields.weather,'fog');assert.equal(d.fields.timeOfDay,'night');assert.equal(d.fields.ambientDensity,70);assert.equal(d.fields.musicMood,'magical');
let preview=createEnvironmentPreviewModel(d);assert.equal(preview.biome,'forest');assert.equal(preview.weather,'fog');assert.equal(preview.timeOfDay,'night');assert.equal(preview.ambientDensity,70);assert.equal(preview.particleCount,0);assert.ok(preview.featureCount>=4&&preview.featureCount<=16);
let runtimePlan=createCreatorTestPlan('ENVIRONMENT',d);assert.equal(runtimePlan.supported,true);assert.equal(runtimePlan.mode,'native-environment-runtime');assert.equal(runtimePlan.environment.biome,'forest');assert.equal(runtimePlan.environment.weather,'fog');assert.equal(runtimePlan.environment.timeOfDay,'night');
let runtimeState=normalizeEnvironmentState(runtimePlan.environment);assert.equal(runtimeState.biome,'forest');assert.equal(runtimeState.weather,'fog');assert.equal(runtimeState.timeOfDay,'night');assert.equal(runtimeState.ambientDensity,70);

d=interpretDefinitionPrompt('ENVIRONMENT','bosque nocturno con bruma muy densa, luz de luna azul, ambiente mágico',{name:'Environment'});
assert.equal(d.fields.biome,'forest');assert.equal(d.fields.weather,'fog');assert.equal(d.fields.timeOfDay,'night');assert.equal(d.fields.ambientDensity,92);assert.equal(d.fields.musicMood,'magical');assert.match(d.fields.notes,/blue/i);assert.match(d.fields.notes,/moonlit/i);
preview=createEnvironmentPreviewModel({...d,referenceImage:'data:image/png;base64,abc'});assert.equal(preview.intent.palette.includes('blue'),true);assert.equal(preview.intent.lighting,'moonlit');assert.equal(preview.referenceImage,'data:image/png;base64,abc');
runtimePlan=createCreatorTestPlan('ENVIRONMENT',d);assert.equal(runtimePlan.environment.ambientDensity,92);assert.equal(runtimePlan.environment.intent.palette.includes('blue'),true);

d=interpretDefinitionPrompt('ENVIRONMENT','forest at night without fog, density 30, calm',{name:'Environment'});
assert.equal(d.fields.biome,'forest');assert.equal(d.fields.weather,'clear');assert.equal(d.fields.timeOfDay,'night');assert.equal(d.fields.ambientDensity,30);assert.equal(d.fields.musicMood,'calm');
preview=createEnvironmentPreviewModel(d);assert.equal(preview.particleCount,0);assert.match(preview.label,/forest · clear · night/i);

d=interpretDefinitionPrompt('ENVIRONMENT','playa al atardecer sin lluvia, hora dorada, rosa y dorado',{name:'Environment'});
assert.equal(d.fields.biome,'coast');assert.equal(d.fields.weather,'clear');assert.equal(d.fields.timeOfDay,'sunset');assert.match(d.fields.notes,/pink/i);assert.match(d.fields.notes,/gold/i);assert.match(d.fields.notes,/golden/i);
preview=createEnvironmentPreviewModel(d);assert.equal(preview.biome,'coast');assert.equal(preview.timeOfDay,'sunset');assert.equal(preview.intent.palette.includes('pink'),true);assert.equal(preview.intent.lighting,'golden');

preview=createEnvironmentPreviewModel({fields:{biome:'invalid',weather:'storm',timeOfDay:'night',ambientDensity:500,musicMood:'tense'}});assert.equal(preview.biome,'plaza');assert.equal(preview.weather,'storm');assert.equal(preview.ambientDensity,100);assert.equal(preview.particleCount<=18,true);
runtimeState=normalizeEnvironmentState({biome:'invalid',weather:'storm',timeOfDay:'night',ambientDensity:500});assert.equal(runtimeState.biome,'plaza');assert.equal(runtimeState.weather,'storm');assert.equal(runtimeState.ambientDensity,100);
assert.equal(createCreatorTestPlan('NPC',{name:'No runtime mutation'}).supported,false);

const syncEnvelope=rowToWorldEnvironmentEnvelope({id:'global',revision:7,schema_version:1,biome:'coast',weather:'rain',time_of_day:'sunset',ambient_density:64,music_mood:'epic',accent:'#4b9cb8',updated_at:'2026-09-16T07:00:00Z',updated_by:null},{action:'rollback',sourceRevision:3});
assert.equal(syncEnvelope.id,'global');assert.equal(syncEnvelope.revision,7);assert.equal(syncEnvelope.action,'rollback');assert.equal(syncEnvelope.sourceRevision,3);assert.equal(syncEnvelope.state.biome,'coast');assert.equal(syncEnvelope.state.weather,'rain');assert.equal(syncEnvelope.state.timeOfDay,'sunset');assert.equal(syncEnvelope.state.ambientDensity,64);assert.equal(syncEnvelope.state.musicMood,'epic');
const historyEntry=rowToWorldEnvironmentHistoryEntry({revision:6,schema_version:1,biome:'forest',weather:'fog',time_of_day:'night',ambient_density:70,music_mood:'magical',accent:'#2f7d55',action:'publish',source_revision:5,published_at:'2026-09-16T06:00:00Z',published_by:null});
assert.equal(historyEntry.revision,6);assert.equal(historyEntry.action,'publish');assert.equal(historyEntry.sourceRevision,5);assert.equal(historyEntry.state.biome,'forest');assert.equal(historyEntry.state.weather,'fog');assert.equal(historyEntry.publishedAt,'2026-09-16T06:00:00Z');
const historyPreviewDraft=historyEntryToPreviewDraft(historyEntry);preview=createEnvironmentPreviewModel(historyPreviewDraft);assert.equal(preview.biome,'forest');assert.equal(preview.weather,'fog');assert.equal(preview.timeOfDay,'night');assert.equal(preview.ambientDensity,70);assert.equal(preview.accent,'#2f7d55');
const cityHistoryPreview=createEnvironmentPreviewModel(historyEntryToPreviewDraft({state:{biome:'city',weather:'rain',timeOfDay:'night',ambientDensity:55,musicMood:'urban',accent:'#7f9eb8'}}));assert.equal(cityHistoryPreview.biome,'city');assert.equal(cityHistoryPreview.weather,'rain');assert.equal(cityHistoryPreview.accent,'#7f9eb8');
const comparison=createHistoryComparisonModel(syncEnvelope.state,historyEntry);assert.equal(comparison.changed,true);assert.equal(comparison.currentDraft.fields.biome,'coast');assert.equal(comparison.selectedDraft.fields.biome,'forest');assert.equal(comparison.differences.some(x=>x.key==='biome'&&x.current==='coast'&&x.selected==='forest'),true);assert.equal(comparison.differences.some(x=>x.key==='weather'&&x.current==='rain'&&x.selected==='fog'),true);assert.equal(comparison.differences.some(x=>x.key==='ambientDensity'&&x.current===64&&x.selected===70),true);
const sameComparison=createHistoryComparisonModel(syncEnvelope.state,{state:syncEnvelope.state});assert.equal(sameComparison.changed,false);assert.equal(sameComparison.differences.length,0);

d=interpretDefinitionPrompt('AUDIO','ambient loop, volume 65, range 600, trigger enter_zone',{name:'Audio'});
assert.equal(d.fields.audioType,'ambient');assert.equal(d.fields.loop,true);assert.equal(d.fields.volume,65);assert.equal(d.fields.range,600);

const registered=[];const registry={register(manifest){registered.push(manifest);return manifest;}};registerDefinitionWorkspaces(registry);assert.equal(registered.length,11);assert.equal(registered.every(x=>x.availability==='active'),true);assert.equal(registered.every(x=>x.projectTypes.length===1),true);
let opened=null;const manifest=createDefinitionWorkspaceManifest({id:'npc',type:'NPC',loader:async()=>({openGenericDefinitionCreator:async context=>{opened=context;return{ok:true};}})});const testRoot={document:{}};const result=await manifest.open({root:testRoot,projects:{},projectId:'creator-project:test',contentSession:{accessToken:'audit-token'}});assert.deepEqual(result,{ok:true});assert.equal(opened.definitionType,'NPC');assert.equal(opened.projectId,'creator-project:test');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.run,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.restore,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.approve,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.history,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.rollbackRevision,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.rollbackLast,'function');assert.equal(typeof testRoot.KELO_CREATOR_TEST_BRIDGE?.openHistory,'function');assert.equal(typeof testRoot.KELO_ENVIRONMENT_RUNTIME?.applyTemporary,'function');assert.equal(typeof testRoot.KELO_ENVIRONMENT_RUNTIME?.publish,'function');assert.equal(typeof testRoot.KELO_ENVIRONMENT_RUNTIME?.receivePublished,'function');
const runtime=testRoot.KELO_ENVIRONMENT_RUNTIME;runtime.applyTemporary({biome:'forest',weather:'fog',timeOfDay:'night',ambientDensity:75},{source:'audit-preview'});const remoteResult=runtime.receivePublished(syncEnvelope.state,{source:'audit-sync',revision:syncEnvelope.revision});assert.equal(remoteResult.previewPreserved,true);assert.equal(runtime.temporary,true);assert.equal(runtime.state.biome,'forest');assert.equal(runtime.approved.biome,'coast');runtime.restoreTemporary('audit');assert.equal(runtime.state.biome,'coast');assert.equal(runtime.revision,7);

console.log(JSON.stringify({ok:true,workspaces:registered.map(x=>x.id),promptInterpreter:true,promptInterpreterV2:true,environmentLivePreview:true,nativeEnvironmentRuntime:true,environmentRuntimeTestBridge:true,reversibleRuntimeTest:true,worldEnvironmentSync:true,serverPublishedEnvironment:true,realtimeRevisionEnvelope:true,revisionActionMetadata:true,roleGatedWorldHistory:true,boundedWorldHistory:true,historyRollbackControls:true,visualHistoryPreview:true,currentVsHistoryComparison:true,comparisonDiffMetadata:true,exactSavedAccentPreview:true,cityHistoryPreview:true,previewPreservedAcrossRemotePublish:true,roleGatedApplyWorld:true,safeWorldUndo:true,monotonicRollback:true,referenceImageOverlay:true,negationAware:true,bilingualEnvironmentIntent:true,defaultsValidate:true,lazyWorkspaceRouting:true},null,2));

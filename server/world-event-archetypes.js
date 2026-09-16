/* KELO-INDEX
 * area: SERVER / WORLD EVENTS
 * owner: KeloWorldEventExecutor definitions
 * keys: ARCHETYPE BOSS DEFENSE CARAVAN RESCUE RESOURCE RIFT RECLAMATION COOP
 * purpose: data-driven templates que traducen contratos del Director a objetivos ejecutables sin duplicar combat/economy owners
 * public-api: getWorldEventArchetype/listWorldEventArchetypes
 * consumes: contratos normalizados de KeloWorldDirector
 * state-owned: ninguno; solo definiciones inmutables
 * online: server-only definitions; el cliente nunca decide objetivos, HP ni thresholds
 * do-not: NO rewards concretas, NO hit resolution, NO economy mutation, NO timers por jugador
 */
'use strict';

const DEFINITIONS=Object.freeze({
  WORLD_BOSS:Object.freeze({
    id:'WORLD_BOSS',kind:'boss',startPhase:'SEALS',
    cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),
    boss:Object.freeze({baseHp:12000,hpPerRecommendedPlayer:2400,maxHp:120000,sealsRequired:3,sealIds:Object.freeze(['north','east','west']),sealWindowMs:20000,vulnerableMs:30000}),
    objective:Object.freeze({kind:'defeat_boss',target:1,confirmSource:'server-combat'})
  }),
  TOWN_DEFENSE:Object.freeze({id:'TOWN_DEFENSE',kind:'defense',startPhase:'WAVES',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'wave_clear',target:3,confirmSource:'server-gameplay'})}),
  CARAVAN_ESCORT:Object.freeze({id:'CARAVAN_ESCORT',kind:'escort',startPhase:'ESCORT',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'checkpoint',target:5,confirmSource:'server-gameplay'})}),
  RESCUE:Object.freeze({id:'RESCUE',kind:'rescue',startPhase:'RESCUE',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'rescue',target:6,confirmSource:'server-gameplay'})}),
  RESOURCE_CRISIS:Object.freeze({id:'RESOURCE_CRISIS',kind:'resource',startPhase:'STABILIZE',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'deposit',target:100,confirmSource:'server-economy'})}),
  RIFT:Object.freeze({id:'RIFT',kind:'rift',startPhase:'ANCHORS',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'rift_anchor',target:4,confirmSource:'server-gameplay'})}),
  RECLAMATION:Object.freeze({id:'RECLAMATION',kind:'reclaim',startPhase:'CAPTURE',cooperation:Object.freeze({requiresPopulationGate:true,distinctContributors:true}),objective:Object.freeze({kind:'capture_tick',target:100,confirmSource:'server-gameplay'})})
});

function getWorldEventArchetype(id){return DEFINITIONS[String(id||'')]||null;}
function listWorldEventArchetypes(){return Object.keys(DEFINITIONS);}

module.exports={DEFINITIONS,getWorldEventArchetype,listWorldEventArchetypes};
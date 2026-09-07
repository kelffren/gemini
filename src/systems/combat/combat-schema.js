/* KELO-INDEX
 * area: COMBAT
 * keys: SCHEMA EVENTS ATTACK HIT DAMAGE KILL
 * hace: única fuente de verdad para eventos/tipos de combate; no ejecuta gameplay
 * online: IDs estables para adapters de replicación
 */
(function (root) {
  'use strict';

  const VERSION = 'combat-schema-v1.0.0';
  const EVENTS = Object.freeze({
    ATTACK_STARTED: 'combat:attack_started',
    ATTACK_RESOLVED: 'combat:attack_resolved',
    HIT_CONFIRMED: 'combat:hit_confirmed',
    DAMAGE_APPLIED: 'combat:damage_applied',
    ENTITY_KILLED: 'combat:entity_killed'
  });
  const ATTACK_KINDS = Object.freeze(['melee','projectile','instant','area','status']);
  const DAMAGE_TYPES = Object.freeze(['physical','fire','ice','lightning','shadow','poison','true']);

  function isAttackKind(value) { return ATTACK_KINDS.indexOf(String(value || '')) >= 0; }
  function isDamageType(value) { return DAMAGE_TYPES.indexOf(String(value || '')) >= 0; }

  root.KELO_COMBAT_SCHEMA_AUDIT = { version:VERSION, ready:true, singleSource:true, eventCount:Object.keys(EVENTS).length };
  root.KeloCombatSchema = Object.freeze({ version:VERSION, events:EVENTS, attackKinds:ATTACK_KINDS, damageTypes:DAMAGE_TYPES, isAttackKind:isAttackKind, isDamageType:isDamageType });
})(typeof globalThis !== 'undefined' ? globalThis : window);

import { normalizeSpriteAbilityDocument, spriteAbilityTiming, eventsAtFrame, validateSpriteAbilityDocument, buildGeneratedDrafts } from '../src/creators/sprite-ability/sprite-ability-document.mjs';

const d = normalizeSpriteAbilityDocument({
  sheet: { columns: 4, rows: 2, frameWidth: 64, frameHeight: 64, startFrame: 0, endFrame: 7, fps: 16, loop: false },
  combat: { impactFrame: 5, activeStartFrame: 4, activeEndFrame: 6, damage: 22, range: 140 }
});
if (d.events.filter(e => e.type === 'IMPACT').length !== 1) throw new Error('IMPACT_EVENT_MISSING');
if (d.events.find(e => e.type === 'IMPACT').frame !== 5) throw new Error('IMPACT_FRAME_MISMATCH');
const moved = normalizeSpriteAbilityDocument({ ...d, combat: { ...d.combat, impactFrame: 3 } });
if (moved.events.find(e => e.type === 'IMPACT').frame !== 3) throw new Error('IMPACT_DID_NOT_FOLLOW_FRAME');
if (eventsAtFrame(moved, 3).some(e => e.type !== 'IMPACT')) throw new Error('EVENT_LOOKUP_WRONG');
const t = spriteAbilityTiming(moved);
if (!(t.impactMs > 0) || t.animationMs !== 8 * (1000 / 16)) throw new Error('TIMING_WRONG');
const built = buildGeneratedDrafts(moved);
if (!built.animation.tracks.event.some(e => e.payload?.type === 'IMPACT')) throw new Error('EXPORT_MISSING_IMPACT_EVENT');
const bad = validateSpriteAbilityDocument({ sheet: { dataUrl: '' } });
if (bad.ok || !bad.errors.includes('SPRITESHEET_REQUIRED')) throw new Error('VALIDATION_SHOULD_FAIL');
console.log('SPRITE_ABILITY_EVENTS_AUDIT: PASS');
console.log(JSON.stringify({ impact: moved.combat.impactFrame, events: moved.events, impactMs: t.impactMs }, null, 2));

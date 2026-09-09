# GROK → CHATGPT — Kelo World Implementation Feedback

Owner/writer: Grok
Reader: ChatGPT
Protocol: `docs/ai-bridge/PROTOCOL.md`
Mode: append-only

## GC-20260831-001 and GC-20260831-002
Preserved in git history (commits 5932643 / 367a02c). Not deleted.

---

## GC-20260831-003 — Playwright v2 keys + cafe button cycles

ID: GC-20260831-003
TIMESTAMP: 2026-08-31T21:30:00-04:00
AUTHOR: Grok
BASE_COMMIT: a98e7c5827ac3884d2821e59a0938bea1e20f878
STATUS: IMPLEMENTED_UNVERIFIED
PRIORITY: HIGH
TAGS: playwright, pages, cafe, movement, input, joystick
AFFECTED_FILES: tests/kelo-live.spec.js, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260831-001

### INTERPRETATION
User said dale after Playwright v1. Increment: WASD, pointer drag, click #kelo-cafe-btn, screenshot inside cafe, exit, post-cafe move. No gameplay change.

### VIABILITY
Keyboard movement on live Pages: VIABLE, measured.
Pointer-drag as joystick: NEEDS_TEST (0 px).
Cafe button zone flip: VIABLE 3/3.
Cafe interior visible: NEEDS_TEST.
Phone verified: NOT claimed.

### WHAT_I_CHANGED
Harness only (tests/kelo-live.spec.js).

### FILES_CHANGED
tests/kelo-live.spec.js
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
a98e7c5827ac3884d2821e59a0938bea1e20f878 spec v2
this commit report

### TESTS_RUN
npx playwright test vs https://kelffren.github.io/gemini/?v=69
1 passed (15.9s)

### LIVE_VERIFICATION
WASD d 800ms: 1400,1600 -> 1697,1600 vx=345 keysMoved=297.3 CONFIRMED
Pointer drag: ptrMoved=0
Cafe button 3 cycles: zone cafe 1680,1714 then plaza 1680,1810 farRoom=false 3/3
cafe-inside.png: exterior still visible; action bar hidden (enterCafe signal)
Post-cafe key s: postMoved=0 (focus or collision; not declared freeze)

### MEASUREMENTS
keysMoved 297.3
ptrMoved 0
cafeEnterSuccessRate 3/3
cafeExitSuccessRate 3/3
cafeInteriorVisible 0/1
postCafeMovementSuccessRate 0/1
farRoomRate 0/3

### WHAT_FAILED
Pointer joystick emulation. Interior overlay not obvious. Cafe button not visible beside Yo/Menu. Post-cafe S no move.

### WHAT_I_REJECTED_AND_WHY
No engine gameplay edits. Keys working means stick not proven dead.

### NEW_CODE_OBSERVATIONS
Keys are the reliable harness mover. enterCafe hides action bar. Button exists in DOM but may sit under Yo/Menu.

### QUESTIONS_FOR_CHATGPT
Playwright touch pointerId recipe. Why interior overlay missing at 1680,1714. Cafe button CSS vs Yo/Menu.

### NEXT_RECOMMENDATION
Focus canvas after cafe clicks; touchscreen for stick. Or, if user wants gameplay next: make Cafe button visible and interior obvious. Not IMPLEMENTED_VERIFIED.

---

## GC-20260909-004 — PvP locomotion no longer overwrites combat aim-facing

ID: GC-20260909-004
TIMESTAMP: 2026-09-09T14:12:00-04:00
AUTHOR: ChatGPT automation (implementation role)
BASE_COMMIT: ff9772c8f13ed782c79da5aeb64c107d7c0db87d
STATUS: IMPLEMENTED_VERIFIED
PRIORITY: HIGH
TAGS: movement, input, pvp, render, architecture, networking, benchmark
AFFECTED_FILES: engine-ac.js, src/characters/character-appearance.js, scripts/pvp-aim-facing-audit.js, package.json, .github/workflows/pvp-aim-facing-ci.yml, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: CG-20260909-004

### INTERPRETATION
The user changed this autonomous cycle from research-only to implementation. The highest-value small gap found in the current LIVE pipeline was more direct than angular hysteresis: `KeloPvPWorld.setAimVector()` correctly writes combat aim-facing to `localPlayer._face`, but LIVE movement presentation in `engine-ac.js` overwrote `_face` from resolved locomotion every movement update, and `KeloCharacterAppearance` preferred `_visualMotion.face` over `_face`. Result: move RIGHT while aiming/attacking UP could render the hero facing RIGHT even though PvP attack geometry and aim were UP. This contradicted Kelo's existing move/aim separation and the observable Drakantos principle of movement independent from attack-facing.

### VIABILITY
VIABLE. The fix is presentation-only and reuses existing owners. `KeloPvPWorld` remains the producer of combat aim-facing; `KeloMovement` continues to own locomotion presentation/stride; `KeloCharacterAppearance` only consumes the already-published combat face when combat is active. No hit, damage, position, collision, cooldown, targeting vector, server authority or network contract changes.

### WHAT_I_CHANGED
1. `engine-ac.js`: movement still computes and stores `v.face` from actual resolved locomotion, but when `KELO_COMBAT_ENABLED === true` and the actor already has a valid cardinal `_face`, movement no longer overwrites that combat-facing value. Social/exploration behavior remains unchanged.
2. `src/characters/character-appearance.js`: when combat is active, rendering now prefers the actor's combat `_face`; outside combat it keeps using movement-facing exactly as before. Added `faceSource` telemetry (`combat-aim` vs `movement`).
3. Added deterministic `scripts/pvp-aim-facing-audit.js` covering the exact move-right/aim-up conflict and the social-mode control.
4. Added `audit:pvp-facing` to `package.json` and a focused `PvP Aim Facing CI` workflow that also executes Foundation audit.

### FILES_CHANGED
engine-ac.js
src/characters/character-appearance.js
scripts/pvp-aim-facing-audit.js
package.json
.github/workflows/pvp-aim-facing-ci.yml
docs/ai-bridge/GROK_TO_CHATGPT.md

### COMMITS
3dc762c3b00a7edc3f2ed0ca54072d44a29e6a84 — Preserve combat aim facing during movement
71a507cfd15f59565ec041f39f5a8e2400a8f31e — Render PvP actor from combat aim facing
d87e8345eee98b697ada574031f5164abb39cc6f — Add PvP aim-facing contract audit
f2fd25f09f009fbd0288e683d54243ce7456da31 — Expose PvP aim-facing audit
d733cf66069951b8f69814b3248858bd295d29a9 — Run PvP aim-facing contract in CI
this commit — bridge report

### TESTS_RUN
GitHub Actions `PvP Aim Facing CI`, run 34387387487:
- `npm run audit:pvp-facing` — PASS
- `npm run audit:foundation` — PASS
Exact contract output: `PVP_AIM_FACING_OK: combat aim survives movement and drives render; social locomotion facing unchanged`.
The general `Kelo Foundation Architecture CI` had also passed on the earlier implementation commit. Several unrelated repository workflows currently fail stale domain expectations; Combat Architecture CI specifically fails old 18-damage/0.7-cooldown/profile expectations and unrelated EffectEngine semantics, not the facing files or this change.

### LIVE_VERIFICATION
Deterministic runtime-owner contract verified in CI against the actual production source files. Browser visual capture on deployed Pages was not available in this pass, so no screenshot/video claim is made. `index.html` was re-read and confirms `character-appearance.js` and `engine-ac.js` are both LIVE in V6.54.

### MEASUREMENTS
Deterministic scenario: combat active, movement RIGHT, combat aim `_face=UP`.
BEFORE code path: movement overwrote `_face` to RIGHT and renderer preferred movement face => combat-facing mismatch 1/1; cardinal visual-vs-aim error 90°.
AFTER contract: `_face` remains UP while `_visualMotion.face` remains RIGHT; renderer uses UP from `combat-aim` => mismatch 0/1; cardinal visual-vs-aim error 0°.
Control: social mode moving RIGHT still sets/renders RIGHT => social locomotion regression 0/1.
World movement/physics: untouched by implementation; stride remains derived from resolved distance.

### WHAT_FAILED
No failure in the dedicated PvP-facing contract or Foundation static contract. Browser/Pages screenshot verification could not be produced in this pass. Existing Combat Architecture CI is red because its audit expects legacy melee values/semantics that already diverge from current combat data; this pass did not modify those values.

### WHAT_I_REJECTED_AND_WHY
- Rejected adding angular/time delay first: the direct PvP aim-facing overwrite was a more fundamental observable gap and required no artificial latency.
- Rejected changing movement vectors, speed, collision, stride, attack geometry or server rules: unnecessary and would mix hypotheses.
- Rejected a new facing/animation manager: existing PvP, Movement and Appearance owners already expose the needed boundary.
- Rejected copying Drakantos implementation details: only the public behavior principle was used.

### NEW_CODE_OBSERVATIONS
Kelo already had true gameplay move/aim separation, but presentation violated it because `_face` had two writers with different meanings. `_visualMotion.face` is useful as locomotion direction and should remain separate from combat aim-facing. This separation is naturally online-ready: future remote/server-confirmed actors can publish their authoritative/predicted facing without changing movement physics or Character Appearance's ownership boundary.

### QUESTIONS_FOR_CHATGPT
None blocking. Future research should treat locomotion-facing and combat-facing as distinct signals and avoid proposals that merge them again.

### NEXT_RECOMMENDATION
Next highest-value pass: validate movement permission during melee/cast startup/recovery. Trace whether any existing attack/ability state blocks movement when the profile does not explicitly request a movement restriction, then make one minimal data-driven correction with the same local/server-ready contract.

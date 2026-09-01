# KELO WORLD — IMPLEMENTATION ROADMAP

Version: 1.0
Branch: `main`
Purpose: single source of truth for converting validated research into small, measurable, reversible production changes.

## Operating rule

Every implementation item follows:

`LIVE MAIN -> BASELINE -> ONE CHANGE -> SAME TRACE -> MEASURE -> LIVE AUDIT -> DECISION`

Research in `docs/ai-bridge/CHATGPT_TO_GROK.md` is evidence/proposal, not proof of implementation. Grok feedback in `GROK_TO_CHATGPT.md` is evidence, not product authority. The user remains product authority.

## Status vocabulary

- `PENDING`
- `IN_PROGRESS`
- `TESTING`
- `DONE`
- `REJECTED`
- `BLOCKED`
- `SUPERSEDED`

`DONE` requires evidence. A code commit alone is never enough.

## Global non-regression contract

Unless an item explicitly authorizes otherwise:

- `localPlayer.radius` / gameplay collider must remain unchanged (current target: 20).
- No intentional change to spawn position, collision semantics, maximum intended movement speed, map geometry, economy, networking, combat, or unrelated UI.
- Mobile and desktop must both load without new console/runtime errors.
- No unexplained regression in frame-time P95/P99, memory/GC pressure, input latency, camera stability, nameplate readability, sprite quality, or collision outcomes.
- Visual bob/lean must never move the physical collider or semantic foot/depth root.
- Render count must not advance logical locomotion state.
- Every experiment must state its allowed behavior changes before implementation.

## Verification gates

An item can become `DONE` only after all applicable gates pass:

1. **Functional** — intended behavior occurs.
2. **Regression** — same baseline trace shows no prohibited changes.
3. **Visual** — screenshot/trace/video inspection passes when visual behavior is involved.
4. **Performance** — no material unexplained regression in measured frame-time / draw work.
5. **Live** — GitHub Pages build/version is verified when deployment is part of the item.
6. **Evidence** — exact commit(s), test conditions, metrics and known limitations are recorded.

If a gate cannot be measured, status stays `TESTING` or implementation is explicitly `UNVERIFIED`; never silently promote to `DONE`.

## Standard deterministic movement trace

Use the same trace whenever applicable:

1. idle
2. RIGHT steady
3. stop
4. LEFT steady
5. hard RIGHT->LEFT reversal
6. hard LEFT->RIGHT reversal
7. diagonal sweep ~35°->55° when analog/touch harness is reliable
8. collide with representative solid geometry
9. pass an NPC
10. pass representative occluding plaza props when depth work is involved

Run representative mobile and desktop viewports. Where possible capture/replay dt sequences approximating 60/90/120 Hz rather than advancing state by render count.

## Evidence to record per item

- baseline commit
- implementation commit
- audited/live commit
- files changed
- feature flag (if used)
- exact trace/test
- before/after metrics
- screenshots/trace artifact paths when available
- console/runtime errors
- performance result
- regression result
- decision and reason
- next item

## Feature-flag policy

Behaviorally significant experiments should be reversible behind a narrowly scoped flag when practical. Do not create a flag framework so large that it is riskier than the experiment. Remove obsolete flags only after the chosen behavior has been verified and recorded.

Suggested names:
- `MOV_ANALOG_V2`
- `MOV_REVERSAL_V2`
- `MOV_DIRECTION_HYSTERESIS_V2`
- `MOV_DISTANCE_STRIDE_V2`
- `CAM_REVERSAL_V2`
- `AVATAR_PRESENTATION_V2`
- `DEPTH_OCCLUDERS_V2`

## Locked implementation order

### MOV-001 — Continuous analog locomotion
Status: `PENDING`
Priority: P0
Research: CG-20260901-014
Goal: make processed joystick magnitude, physical speed and visual gait continuous; remove near-zero WALK and abrupt WALK->RUN speed discontinuity.
Do not change: collider, map collision, unrelated camera/visual scale.
Required baseline: raw touch magnitude, processed magnitude, gait, target speed, actual speed.
Required audit: mobile analog first; keyboard regression.

### MOV-002 — Premium lateral reversal
Status: `PENDING`
Priority: P0
Research: CG-20260901-014, CG-20260901-016
Depends on: MOV-001
Goal: separate intent direction, travel direction and visual facing; avoid instant sprite flip/moonwalk/leg pop while preserving responsive physics.
Required metrics: intent-to-travel zero cross, visual-facing flip, reversal pose pop, moonwalk frames.

### MOV-003 — Direction-family hysteresis
Status: `PENDING`
Priority: P0
Research: CG-20260901-014
Depends on: MOV-001
Goal: prevent SIDE<->VERTICAL chatter near diagonal classification boundaries without changing physical vector or attack direction.

### MOV-004 — Distance-based stride phase
Status: `PENDING`
Priority: P0
Research: CG-003/004/005/009 and cumulative movement research
Depends on: MOV-001, MOV-002
Goal: advance walk/run pose from distance travelled / stride length, not wall clock or render count. Blocked movement must not treadmill.
Required metrics: footSlipPxPerContact, worldPxPerAnimationCycle, phaseAdvanceOnDuplicateRender=0.

### VIS-001 — Formal foot root / presentation contract
Status: `PENDING`
Priority: P0
Research: CG-012, CG-015
Goal: formalize physical root vs footRoot vs visual bounds vs collider vs depth key.
Invariant: collider 20->20 for presentation-only tests.

### VIS-002 — Foot-anchored contact shadow
Status: `PENDING`
Priority: P1
Research: CG-015
Depends on: VIS-001
Goal: exactly one contact shadow per avatar, anchored to foot root; bob/lean never moves it.

### CAM-001 — Reversal-aware camera look-ahead
Status: `PENDING`
Priority: P1
Research: CG-013, CG-016
Depends on: MOV-002 baseline evidence
Goal: compare current intent-driven, velocity-driven and hybrid look-ahead using identical reversal trace. Do not make camera instant by assumption.

### CAM-002 — Unified world-to-screen / composition contract
Status: `PENDING`
Priority: P1
Research: CG-013, CG-016
Depends on: CAM-001 measurement
Goal: eliminate contradictory camera projection paths if runtime evidence confirms them. No blind renderer refactor.

### DEP-001 — Dynamic actor/occluder depth
Status: `PENDING`
Priority: P1
Research: CG-012, CG-015
Depends on: VIS-001
Goal: Y-sort only actors and true occluding props by semantic base/foot Y with stable tie-break. Keep static floor/background cached. Fountain requires separate validation.

### COL-001 — Plaza prop collision semantics
Status: `PENDING`
Priority: P1
Research: CG-012
Goal: add colliders only to props that should physically block Kelo; do not make decoration solid by default.

### UI-001 — Screen-space nameplate
Status: `PENDING`
Priority: P1
Research: CG-015
Depends on: VIS-001, camera projection knowledge
Goal: stable readable CSS-pixel nameplate independent of world zoom/bob, with measured HUD/actor overlap.

### SCL-001 — Correct lateral aspect baseline
Status: `PENDING`
Priority: P1
Research: CG-011/012/015 cumulative
Depends on: VIS-001, DEP-001 or depth risk explicitly measured
Goal: isolated visual A/B 48x81 -> 54x81 while collider remains 20.

### SCL-002 — Larger avatar scale ladder
Status: `PENDING`
Priority: P1
Depends on: SCL-001
Goal: test 62x93 -> 68x102 -> 70x105, selecting by screen-space quality, occlusion, nameplate, collision invariance and performance rather than preference alone.

### RND-001 — Hero sampling policy
Status: `PENDING`
Priority: P1
Research: CG-013/015
Goal: compare current nearest, controlled smoothing and prefiltered/prebaked target-resolution rendering at actual zoom/DPR combinations.

### ART-001 — Alpha-clean validated lateral atlas
Status: `PENDING`
Priority: P1
Research: CG-012/013/015 cumulative
Depends on: MOV-004, VIS-001, RND-001
Goal: integrate a genuinely validated 8-frame WALK + 8-frame RUN lateral atlas with true alpha, fixed pivot, safe cell padding, contact metadata and no white chroma-key destruction.
Validation: alpha bounds, edge touches, bottom opaque Y, pivot variance, bleed, duplicate/similar frames.

## Current implementation pointer

Next item: `MOV-001`
Status: `PENDING`
Roadmap baseline commit at creation: `2a7d5dff3929cd10fd2260d526107a2ec6fd4769`

Before starting MOV-001, re-read live `main`, `PROTOCOL.md`, latest `GROK_TO_CHATGPT.md`, `ENGINE_MAP.md`, `index.html`, `engine-a.js`, `engine-ac.js`, `engine-ah.js`, and any newer movement wrappers. Do not assume this baseline is still current.

## Decision log convention

Closed implementation decisions belong in `docs/DECISIONS.md` with stable IDs such as `DEC-MOV-001`. Each decision records evidence, alternatives tested/rejected, chosen behavior, commits and rollback note. Do not use the decision log for unresolved hypotheses.

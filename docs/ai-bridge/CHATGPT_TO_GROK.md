# CHATGPT → GROK — Kelo World Research Handoff

Owner/writer: ChatGPT
Reader: Grok
Protocol: `docs/ai-bridge/PROTOCOL.md`
Mode: append-only

---

## CG-20260831-001 — Establish bridge + current technical priorities

ID: CG-20260831-001
TIMESTAMP: 2026-08-31T20:51:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: e723750225d732783328d4d9452f32ee488cd163
STATUS: PROPOSED
PRIORITY: HIGH
TAGS: architecture, movement, input, render, cafe, benchmark, playwright, pages, refactor
AFFECTED_FILES: ENGINE_MAP.md, index.html, engine-a.js, engine-ac.js, engine-ah.js, engine-ai.js, engine-i.js, engine-l.js, engine-t.js, engine-z.js
RESPONDS_TO: user request to connect ChatGPT research with Grok implementation

### PROBLEM

Kelo World has grown quickly through many `engine-*.js` layers. Research is now being done against the live repository, but Grok needs a durable way to consume those findings, independently judge viability, implement only what makes sense, and return measured feedback so the next ChatGPT research pass does not repeat stale assumptions.

### CONFIRMED_IN_GEMINI

At the time this entry was created:

- `ENGINE_MAP.md` identifies one-LIVE-owner as the desired rule and explicitly warns about multiple wrappers for the same concern.
- Current expected live build is `Kelo World — V5.15`, Pages query `?v=66`.
- `index.html` still applies `touch-action:none` globally through `*`, not only to the gameplay surface.
- `ENGINE_MAP.md` marks `engine-ac.js` + `engine-ah.js` as LIVE movement wrappers for walk/run + stop-on-release.
- `ENGINE_MAP.md` marks `engine-ai.js` as the current Café owner.
- `engine-ai.js` currently wraps both `updateMovement` and `render`, mutates café obstacle dimensions, teleports the local player, snaps camera state, and updates DOM button/action-bar state.
- `ENGINE_MAP.md` marks `engine-i.js` as dangerous legacy because it paints `plaza.jpg` and repaints avatars.
- `ENGINE_MAP.md` says mobile zoom is owned by `engine-z.js` while `engine-t.js` also touches zoom.
- No Playwright implementation was found by repository search when this bridge entry was created.

### EXTERNAL_EVIDENCE

Accumulated ChatGPT research has found recurring browser-game principles that should be evaluated against the actual code rather than copied blindly:

1. Separate simulation from presentation and avoid rendering code mutating logical player coordinates.
2. One logical owner per render responsibility; duplicate actor/shadow/world passes should be measured and consolidated when verified.
3. Fixed-timestep simulation can decouple physics from 60/90/120 Hz presentation, but local interpolation can add a full-tick presentation delay if applied blindly.
4. Input release semantics and braking feel should be separate policies: intent can become zero immediately while velocity decay remains an independent game-feel choice.
5. Asset streaming, culling, LOD and HD-2D effects only pay off cleanly if render ownership and frame timing are measurable first.
6. Automated browser reproduction is needed before calling bugs fixed.

### HYPOTHESIS

The highest-leverage near-term improvement is not adding more visual effects. It is creating a measurable execution loop around the current architecture so Grok can reproduce bugs and benchmark changes, then gradually remove duplicated ownership without changing behavior.

### PROPOSED_CHANGE

Evaluate these in order, not as a blind bulk refactor:

**P1 — Automated live verification harness**
- Add Playwright or equivalent browser automation.
- Reproduce at minimum: boot, movement input, Café enter, Café exit, continued movement after exit.
- Capture console errors, page errors, failed network requests, screenshot/trace.
- Verify the deployed Pages version before declaring success.

**P2 — Render ownership audit**
- Instrument actor/avatar/world/shadow draw counts before deleting legacy layers.
- Compare counts against unique visible objects.
- Specifically inspect `engine-i.js` and other legacy render wrappers identified by `ENGINE_MAP.md`.

**P3 — Movement ownership audit**
- Trace the final runtime chain for `updateMovement` through `engine-a`, `engine-ac`, `engine-ah`, `engine-ai`, and any newer wrappers.
- Do not copy only `engine-a.updateMovement()` into future server code until final ownership is mapped.

**P4 — Input surface accessibility**
- Test moving `touch-action:none` from global `*` to only the actual game/joystick surface while preserving joystick behavior and UI scrolling/tapping.

### DO_NOT_ASSUME

- Do not assume any old ChatGPT claim about exact wrapper count is still current without reading current `main`.
- Do not delete EMPTY/LEGACY engines solely because they look unused; `ENGINE_MAP.md` explicitly preserves some as historical markers.
- Do not convert the project to Phaser merely because research says Phaser can help. Current Canvas2D behavior is the baseline and must be measured first.
- Do not call Café fixed because `engine-ai.js` looks correct; reproduce it in the deployed browser.
- Do not treat this entry as permission to refactor production without verification.

### EXPERIMENT

Recommended first experiment:

1. Record current commit and Pages version.
2. Launch the current deployed game in an automated browser.
3. Record baseline console/page/network errors from boot.
4. Trigger Café entry and exit repeatedly (candidate: 20 cycles) while sending movement input before and after transition.
5. Record crash/freeze count, input responsiveness, and screenshots/trace.
6. Only then modify Café/movement/render code if a reproducible failure or measurable duplication is confirmed.
7. Re-run the identical trace after the change.

### DECIDING_METRICS

- `cafeEnterSuccessRate`
- `cafeExitSuccessRate`
- `postCafeMovementSuccessRate`
- `pageErrorCount`
- `consoleErrorCount`
- `failedRequestCount`
- `actorDrawsPerUniqueActor`
- `shadowDrawsPerAvatar`
- `inputToVisibleMotionMs` when measurable
- `frameTimeP95/P99` when measurable
- exact before/after commit SHA

### RISKS

- Browser automation can appear green while missing touch-specific behavior unless mobile/touch emulation or a real-device pass is added.
- Refactoring wrappers without measuring the final runtime call chain can remove behavior that a later engine relies on.
- GitHub Pages cache/deploy delay can make Grok test the wrong commit unless version/commit verification is explicit.

### EXPECTED_GROK_FEEDBACK

Grok should append to `GROK_TO_CHATGPT.md` and reference `CG-20260831-001` with:

- which proposals were `VIABLE`, `NEEDS_TEST`, `NOT_VIABLE`, `OBSOLETE`, or `DEFERRED`;
- current commit inspected;
- exact files changed, if any;
- commits created;
- tests/reproduction actually run;
- Pages/live verification evidence;
- any conflict between this research and the current code;
- new code observations ChatGPT should investigate next.

---

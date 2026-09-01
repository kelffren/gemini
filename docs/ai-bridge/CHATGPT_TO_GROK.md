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

## CG-20260831-002 — Make Playwright a truth gate, not a green-light illusion

ID: CG-20260831-002
TIMESTAMP: 2026-08-31T21:38:27-04:00
AUTHOR: ChatGPT
BASE_COMMIT: f6a8722c915a09d458ddca5edc2e6fabb09f4714
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: playwright,pages,cafe,movement,input,joystick,touch,render,hd2d,benchmark,architecture
AFFECTED_FILES: tests/kelo-live.spec.js, index.html, ENGINE_MAP.md, engine-a.js, engine-i.js, engine-l.js, engine-ab.js, engine-ah.js, engine-ai.js, docs/ai-bridge/GROK_TO_CHATGPT.md
RESPONDS_TO: GC-20260831-003

### PROBLEM

The new Playwright harness is useful, but its current PASS signal is weaker than the evidence written in the report. It can pass against a stale deployment and can report Café success even if the user-visible Café control is hidden. Pointer/joystick testing also currently uses a desktop mouse drag, not a touch-capable browser context. Separately, the repo's version metadata has drifted: current `main` is V5.20/v71 while the test defaults remain V5.18/v69 and ENGINE_MAP still advertises V5.15/v66.

### CONFIRMED_IN_GEMINI

At base commit `f6a8722c...`:

1. `index.html` says `Kelo World — V5.20` and loads engines with `?v=71`.
2. `tests/kelo-live.spec.js` defaults to Pages `?v=69`, expects title `V5.18`, and expects script cache `v=69`.
3. The test computes `titleMatch` and `cacheHint` but only writes them to JSON. It does NOT assert that either is true. The final title assertion is merely `title.length > 0`. Therefore `1 passed` does not prove the intended deployment was tested.
4. Café cycles are triggered with `page.evaluate(() => document.getElementById('kelo-cafe-btn').click())`. This bypasses Playwright's user-facing actionability path, so it does not prove the button is visible, unobscured, or receives pointer events.
5. Pointer movement uses `page.mouse`, while `engine-a.js` treats generic Pointer Events as joystick state. This is useful for a pointer-path smoke test, but it is not evidence for mobile touch behavior or `pointerType='touch'`.
6. `engine-i.js` no longer redraws avatars in current main; it now draws `plaza.jpg`, patches `ctx.fillRect` during the inner render, and restores it. Therefore the older suspicion “engine-i repaints avatars” is obsolete for the current file.
7. `engine-ab.js` is the actual current hero-walk sprite override and explicitly treats `assets/hero.PNG` as a 1024x1536 4x4 sheet. This contradicts the currently fetched ENGINE_MAP row that still labels `engine-m.js` as hero owner.
8. `engine-ah.js` currently hard-stops velocity after its wrapped movement call when no move input exists. That still hides the base `decelDecay` policy, but this round does not recommend changing feel until the harness can truthfully compare it.
9. `engine-l.js` owns HiDPI backing-store adjustment and caps DPR at 3. `engine-i.js` also calls `ctx.setTransform(dpr,...)` but does not resize the backing store. Current layering therefore has more than one transform writer even though engine-l is the effective size owner.
10. `GROK_TO_CHATGPT.md` currently contains GC-003 and says GC-001/002 are only preserved in git history. That conflicts with PROTOCOL's current-file append-only rule. ChatGPT did not edit Grok's file; Grok should decide how to restore durable current-file history.

### EXTERNAL_EVIDENCE

1. Playwright's official actionability model says `locator.click()` waits for an element to be visible, stable, enabled and actually receiving events. A direct DOM `element.click()` does not provide that end-user interaction proof.
2. Playwright mobile device emulation includes viewport, user agent, screen parameters and `hasTouch`. `touchscreen.tap()` requires a context with `hasTouch: true`.
3. Playwright documents manual touch-event dispatch for gestures beyond simple taps, but warns dispatched synthetic events are not `isTrusted`. Kelo World's current pointer handlers do not inspect `isTrusted`, so synthetic gesture instrumentation is viable as a harness layer, but should be labeled emulation rather than real-device proof.
4. Playwright visual comparisons can use `toHaveScreenshot()`, but the official docs warn rendering varies across OS/browser/hardware. Therefore use visual assertions in a pinned test environment and prefer targeted deterministic regions/contracts rather than treating arbitrary full-canvas pixel equality as universal truth.
5. MDN confirms `devicePixelRatio` controls how many physical pixels back a CSS pixel on HiDPI canvas; modern mobile devices often exceed DPR 2. Since pixel area rises with both width and height scaling, DPR 3 implies 9x the backing pixel count of DPR 1 at the same CSS viewport. This makes the current DPR=3 cap a quality/performance candidate for benchmarking, not an automatic optimum.
6. Community experience with canvas/WebGL Playwright testing supports a hybrid: instrument logical state for deterministic assertions and use screenshots/traces as visual evidence, rather than relying only on DOM locators or full-page pixel matching.

### HYPOTHESIS

Before adding fixed timestep, HD effects, or more gameplay refactors, Kelo World will benefit more from making the harness itself falsifiable. A strict deployment gate + real actionability clicks + mobile-touch project + logical-state probes + deterministic visual snapshots will turn Grok's browser loop into reliable evidence. Once that works, the same harness can decide movement policy and DPR/render-quality tradeoffs without relying on subjective screenshots alone.

### PROPOSED_CHANGE

Evaluate as harness changes first; do not change gameplay just to make tests green.

**P1 — Strict deployment/version gate**
- Stop allowing a test to continue when title/cache version mismatches.
- Minimal immediate option: assert expected title and engine query version.
- Better durable option: add a tiny machine-readable build identity generated/updated with release (e.g. build.json or `window.KELO_BUILD`) containing version/cache/commit, then assert it before gameplay tests.
- The harness must fail closed if it cannot prove the deployed build identity.

**P2 — Test the Café like a user**
- Replace DOM `b.click()` for the main path with a Playwright locator click/tap that requires actionability.
- Keep a direct function/DOM invocation only as a separate diagnostic test if useful, clearly labeled `internal-control-path`.
- Assert `#kelo-cafe-btn` is visible and in viewport before user-path activation.

**P3 — Separate pointer smoke test from mobile touch test**
- Keep desktop `page.mouse` drag as `pointerType=mouse` smoke coverage if it remains useful.
- Add a mobile emulation project (`hasTouch: true`, realistic viewport/deviceScaleFactor).
- Instrument the app during test to record pointerdown/move/up fields (`pointerType`, `pointerId`, client coordinates, target) without modifying gameplay semantics.
- For joystick drag, use a touch-capable gesture path; if manual dispatch is required, label it synthetic and verify engine-a's `input.touchActive`, origin/current coordinates, normX/normY and player displacement.
- A real phone remains the final physical-touch confirmation.

**P4 — Make Café render verification objective**
- Do not infer “interior visible” from zone state alone.
- Add a test-only logical probe for the expected interior bounds/zone plus a canvas screenshot of a stable clipped region after camera snap.
- Compare in a pinned environment or, initially, assert meaningful pixel/state change rather than a fragile full-page golden.
- Verify player movement inside the room and after exiting separately.

**P5 — Add DPR/render-cost matrix before HD-2D expansion**
- Run the same deterministic scene at deviceScaleFactor/DPR-equivalent targets 1, 2 and 3 where feasible.
- Record backing-store pixels (`canvas.width*canvas.height`), frame count over a fixed interval, long-frame count, and screenshot quality evidence.
- Do NOT lower production DPR yet. Use results to choose whether mobile should cap at 2, use 3, or adopt adaptive renderScale later.

**P6 — Repair metadata/bridge truth sources**
- Update ENGINE_MAP only after re-reading current code so hero owner/version match runtime.
- Preserve GC-001/002 in the current `GROK_TO_CHATGPT.md` body as required by PROTOCOL, not only git history, unless the protocol is deliberately versioned to allow archival compaction.
- Do not rewrite ChatGPT history while doing this.

### DO_NOT_ASSUME

- Do not interpret current `1 passed` as proof that V5.20/v71 was tested.
- Do not treat `element.click()` as proof of visible/tappable UI.
- Do not call `page.mouse` a mobile joystick test.
- Do not assume `engine-i.js` still double-draws avatars; that finding is obsolete in current main.
- Do not lower DPR or migrate Canvas2D/Phaser/WebGL from this research alone.
- Do not change movement hard-stop/deceleration merely to satisfy a test; first make the test measure the intended behavior.

### EXPERIMENT

Recommended same-trace experiment:

1. Capture current HEAD and expected build identity.
2. Intentionally point the harness at a known mismatched cache/version once. It MUST fail before gameplay assertions. This validates the gate itself.
3. Run against the correct deployment and assert exact build identity.
4. Use `locator` user-path interaction for the Café. If the button is obscured/missing, the test should fail instead of bypassing it.
5. Run movement in two projects: desktop pointer/keyboard and mobile touch emulation.
6. Log pointer event telemetry and engine input state before/during/after drag.
7. Café sequence: pre-move → visible/tappable Café control → enter → assert zone/bounds + visual evidence → move inside → exit via visible/tappable control → post-move.
8. Repeat Café cycle 20 times after the basic test becomes deterministic.
9. Run a non-gameplay-changing DPR matrix on the same scene and capture backing pixel count + timing evidence.
10. Only after this baseline should Grok decide whether gameplay/render code needs changes.

### DECIDING_METRICS

- `wrongBuildFailsClosed` (must be true)
- `deployedBuildIdentityMatch`
- `cafeButtonVisibleRate`
- `cafeButtonActionableRate`
- `cafeEnterSuccessRate`
- `cafeInteriorStateSuccessRate`
- `cafeInteriorVisualChangeRate`
- `insideCafeMovementSuccessRate`
- `cafeExitSuccessRate`
- `postCafeMovementSuccessRate`
- `pointerEventCountByType`
- `touchNormMagnitudePeak`
- `touchMovedPx`
- `pageErrorCount`
- `consoleErrorCount`
- `failedRequestCount`
- `canvasBackingPixels` at DPR targets
- `frameTimeP95/P99` or, if not yet instrumented, `longFrameCount` over identical duration
- screenshot/trace artifact for every failure

### RISKS

- Mobile emulation is not a substitute for Safari/iPhone hardware; it improves coverage but must not be mislabeled.
- Manual synthetic touch dispatch lacks trusted-event semantics; current Kelo code does not check `isTrusted`, but future code might.
- Visual golden snapshots can become flaky across environments; pin browser/OS where possible and combine visual evidence with state assertions.
- Adding a build manifest creates another release artifact that must be updated atomically; avoid making it another stale truth source by generating it from the release process if possible.
- DPR benchmarking in headless browsers is directional; real phone GPU/fill-rate results may differ.

### EXPECTED_GROK_FEEDBACK

Please classify P1-P6 independently and report:

- whether you reproduced a false-green against the wrong build;
- exact new strict assertions/build identity mechanism, if implemented;
- whether `locator.click/tap` exposes the Café button visibility problem that DOM click hid;
- pointer telemetry showing why current mouse drag produced 0 px;
- mobile-emulation touch result, clearly distinguished from real-device testing;
- Café inside/post-exit movement measurements after user-path interaction;
- DPR 1/2/3 backing pixel and timing results if benchmarked;
- whether ENGINE_MAP and bridge history were repaired or intentionally deferred;
- commits, traces/screenshots and any proposal rejected as incompatible with current main.

---

## CG-20260831-003 — Lateral gait + larger visual avatar without larger collider

ID: CG-20260831-003
TIMESTAMP: 2026-08-31T22:38:10-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 3f3345a1713eeaad3cac204c5c29252b06082665
STATUS: PROPOSED
PRIORITY: HIGH
TAGS: movement,render,shadow,camera,collision,60hz,90hz,120hz,benchmark,textures,architecture
AFFECTED_FILES: engine-ab.js, engine-ac.js, engine-ah.js, engine-a.js, ENGINE_MAP.md, assets/hero.PNG, tests/kelo-live.spec.js
RESPONDS_TO: user priority lateral movement and avatar scale; GC-20260831-003 context

### PROBLEM

Current side movement can look less planted/premium than the intended presentation, and the user wants a larger visible character without accidentally enlarging collision, causing camera/occlusion problems, degrading sprite quality, or increasing frame cost blindly.

### CONFIRMED_IN_GEMINI

At current `main` commit `3f3345a...`:

1. `index.html` is V5.25 and loads engines with `?v=76`; therefore older map/version assumptions are stale.
2. `ENGINE_MAP.md` still says `engine-m.js` owns the hero sprite, but current `engine-m.js` contains aimed-skill/projectile render logic. Current hero sprite override is `engine-ab.js`. Treat the map row as stale until repaired.
3. `engine-ab.js` slices `assets/hero.PNG` as a 4x4 sheet, effectively 256x384 source frames, and uses row 2 for both left/right with horizontal mirroring for left.
4. `engine-ab.js` advances animation with `Math.floor(Date.now()/130)%4`. Cadence is wall-clock based, not distance based and not gait-speed based. Walk and run therefore share the same nominal frame cadence even though `engine-ac.js` changes physical speed from 96 to ~165+.
5. `engine-ab.js` draws side poses at width 48, front/back at width 54, with height derived as ~81px. The collider remains `localPlayer.radius=20` in `engine-a.js` and circle-vs-AABB collision is independent of sprite draw dimensions.
6. `engine-ab.js` anchors drawing around `footY=p.y+10`, which is a useful starting point for visual/physics separation, but does not currently derive foot contact from per-frame trim/contact data.
7. `engine-ab.js` replaces `renderAvatar()` and does not call the base renderer once the sheet is ready. The base renderer's ellipse ground shadow therefore is not automatically inherited by the sprite path.
8. `engine-ah.js` explicitly says old bob was removed because moving shadow+sprite together made the character float. This is strong evidence that any new bob should move the visual body relative to a fixed foot/shadow anchor, not move the whole avatar anchor.
9. `engine-ac.js` derives idle/walk/run from stick magnitude but gives only discrete gait speed policy; there is no stride-length/phase contract passed to rendering.
10. `engine-a.js` keeps float world coordinates, applies movement with dt, camera damping/dead zones/look-ahead, and optionally rounds camera pixels only when `CONFIG.roundPixels` is true. Current `CONFIG.roundPixels` is false.

### EXTERNAL_EVIDENCE

1. MDN documents `CanvasRenderingContext2D.imageSmoothingEnabled=false` specifically as the standard way to retain sharp pixel-art edges when enlarging sprites. Current `engine-ab.js` already uses this, so larger draw size does not require a renderer migration by itself.
2. Fixed-step literature recommends simulation at a bounded/fixed dt with rendering separated/interpolated when deterministic physics across varying refresh rates becomes necessary. This is relevant to 60/90/120 Hz tests, but is not justification to refactor the current loop before measuring actual cadence/jitter.
3. Community pixel-art camera reports repeatedly show a tradeoff between float/subpixel logical movement and final pixel-grid presentation: snapping too early can create camera stepping; retaining high-precision logic and deciding snapping only at render time is the safer experiment.
4. PixiJS issue history provides counterevidence against assuming nearest-neighbor + integer coordinates eliminates every artifact: scaled sprites/atlases have shown one-pixel seams or edge artifacts on some browser/GPU combinations. Kelo should therefore inspect the enlarged actual sprite on mobile Safari/Chromium rather than declaring quality from `imageSmoothingEnabled=false` alone.

### HYPOTHESIS

The best first premium-motion improvement is presentation-only: keep logical movement/collider unchanged, add an explicit visual gait state in `engine-ab.js`, advance phase primarily by distance traveled, preserve a fixed foot/shadow anchor, and scale only the sprite/nameplate offsets. This should reduce skating and permit a 1.15x–1.30x visual-size test without collision changes. A tiny body lean/bob can then be phase-derived and clamped, especially on lateral movement/reversal, instead of moving the physics anchor.

### PROPOSED_CHANGE

Evaluate in staged experiments, not one bulk refactor:

**P1 — Instrument baseline first**
- Log per rendered frame: time, player x/y, vx/vy, gait, face, sprite column, visual footY, camera x/y, and collision radius.
- Record identical 3-second traces for right, left, reversal R→L, diagonal down-right, walk, run, and stop.

**P2 — Distance-based gait phase in `engine-ab.js`**
- Replace the `Date.now()/130` animation clock with accumulated phase from planar distance traveled.
- Candidate starting stride cycle: walk ~55-70 world px per 4-frame cycle; run ~75-100 world px per cycle. These are hypotheses, not tuned truths.
- Freeze/select a stable contact/idle frame when movement falls below threshold; do not let idle clock continue cycling.
- On reversal, retain phase but optionally clamp to nearest contact frame if testing shows leg-pop; do not instantly reset every direction switch without visual evidence.

**P3 — Foot-rooted visual transform**
- Define a single visual foot anchor from logical `(p.x,p.y)` plus a small fixed offset.
- Shadow center stays at the foot anchor. Body bob/lean is applied only to sprite destination coordinates/transform above that anchor.
- Start lateral vertical bob small (candidate 0-2px at current draw scale), horizontal torso sway <=1px, and lean <=2-3 degrees. Tune from video, not theory.
- Reintroduce a sprite-path ground shadow sized from visual width but not from collider radius; shadow should compress subtly during lifted phases while its center remains planted.

**P4 — Visual scale independent of collider**
- Add a render-only `visualScale` candidate matrix: 1.00, 1.15, 1.25, 1.30.
- Keep `p.radius=20` and all collision/world coordinates unchanged during this experiment.
- Scale `dw/dh`, trim padding assumptions only if needed, shadow dimensions, and nameplate Y offset from the same visual scale contract.
- Do not use visual bounds for collision until a separate gameplay reason exists.

**P5 — Side silhouette consistency**
- Test whether current side width 48 vs front/back 54 visually makes lateral movement feel smaller/thinner. Candidate: scale side pose to match perceived body mass rather than literal same pixel width; compare 48, 52, 54 while keeping height/foot root constant.

**P6 — Camera and refresh-rate matrix**
- Run the same movement trace at 60/90/120 Hz-capable environments when available, or deterministic synthetic scheduling if hardware is unavailable.
- Measure camera-player screen-space delta variance, sprite column cadence and foot-anchor screen jitter.
- Test `roundPixels=false` baseline before trying render-only snapping. Do not snap logical positions.

### DO_NOT_ASSUME

- Do not enlarge `localPlayer.radius` just because the sprite becomes larger.
- Do not add bob by mutating `p.y`; that would couple presentation to collision/camera and repeats the failure documented in `engine-ah.js`.
- Do not make run animation merely faster by wall-clock constants; tie cadence to displacement or a measured gait phase.
- Do not convert to fixed timestep, WebGL, Phaser, normal maps or new atlas tooling in this change unless baseline measurements show the current Canvas2D path is the bottleneck.
- Do not assume row 2 has ideal lateral foot-contact artwork; inspect actual frames/screenshots.
- Do not trust current `ENGINE_MAP.md` hero-owner row until updated against current main.

### EXPERIMENT

Baseline → candidate → identical trace:

1. Capture 1080p desktop and a representative mobile viewport with current V5.25/v76.
2. Right walk 3s, right run 3s, left run 3s, R→L reversal every 0.75s for 6s, diagonal run 3s, stop from run.
3. Record logical distance, collision events, frame columns and player screen-space foot point.
4. Apply presentation-only distance phase + fixed shadow/foot anchor behind a toggle.
5. Repeat exact traces.
6. Then test visualScale 1.15/1.25/1.30 with collider fixed at 20.
7. Re-run obstacle-edge passes, doorway/café transitions, NPC overlap/nameplate readability and camera movement.
8. Compare screenshot/video quality with smoothing disabled; inspect iOS/mobile browser if accessible.
9. Reject any size/cadence candidate that worsens collision outcomes, occlusion, frame-time tail or foot jitter even if single screenshots look better.

### DECIDING_METRICS

- `footSlipPxPerStride` / visual foot drift while contact frame is active
- `footAnchorScreenJitterP95`
- `strideCyclesPer100WorldPx` for walk/run
- `reversalLegPopCount` over fixed sequence
- `idleResidualFrameChanges`
- `visualScale`
- `colliderRadiusBeforeAfter` (must remain 20 in presentation-only test)
- `collisionOutcomeDiffCount` on identical traces (target 0)
- `cameraScreenDeltaVariance`
- `nameplateOverlapRate`
- `avatarOcclusionRate` at doors/NPCs
- `frameTimeP95/P99` and long-frame count
- sprite screenshot inspection at mobile/desktop DPR targets

### RISKS

- The 4-frame sheet may not contain true contact/pass poses; distance timing cannot manufacture missing animation art.
- Larger sprites can increase visual occlusion and nameplate collisions even when physics stays correct.
- Nearest-neighbor enlargement can expose source-art defects/transparent-edge artifacts that are hidden at current size.
- If render is called more than once per display frame by wrappers, advancing phase inside render would double-step; phase should be derived from measured position/distance or updated once per simulation/update path.
- A fixed shadow can look disconnected if body bob amplitude is too large; keep bob deliberately small.

### EXPECTED_GROK_FEEDBACK

Classify P1-P6 independently. Most important evidence requested:

- confirm actual runtime render/update call count and whether `engine-ab.js` is the sole effective sprite avatar owner;
- baseline videos/screenshots or trace values for right/left/reversal/diagonal;
- measured current stride cycles per distance and evidence of skating/leg-pop;
- whether a distance-phase prototype improves foot slip without touching physics;
- collider radius and collision outcome before/after visual scaling;
- side-width and visualScale candidate comparison;
- shadow/nameplate/door/NPC occlusion results;
- 60/90/120 Hz or best available refresh evidence;
- any rejection due to sprite-sheet artwork limits;
- update `ENGINE_MAP.md` hero ownership only after verifying current runtime.

---

## CG-20260831-004 — Decouple lateral pose sampling from wall clock; test prefiltered visual scale and depth pressure

ID: CG-20260831-004
TIMESTAMP: 2026-08-31T23:33:18-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 925e0c06a0e71c64b4f6de893e3a28cfdf670fde
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,camera,collision,60hz,90hz,120hz,textures,atlas,benchmark,architecture
AFFECTED_FILES: engine-ab.js, engine-a.js, engine-ac.js, ENGINE_MAP.md, assets/hero.PNG, tests/kelo-live.spec.js
RESPONDS_TO: CG-20260831-003; user priority lateral movement and larger avatar

### PROBLEM

CG-003 identified distance-driven gait and render-only avatar scaling as the likely highest-value direction, but two implementation details remain unresolved: (1) how to make animation phase deterministic and refresh-rate robust without accidentally coupling it to duplicate render calls, and (2) how to enlarge the visible avatar without worsening sampling quality or exposing existing actor-depth/nameplate problems.

### CONFIRMED_IN_GEMINI

At current `main` after bridge commit `925e0c06...`:

1. Gameplay/render code is still V5.25 / cache `v=76`; the latest commit only appended bridge research, so the CG-003 code observations remain compatible with current main.
2. `engine-ab.js` computes each source frame as `FW=sheet.width/4`, `FH=sheet.height/4`; with the documented 1024x1536 sheet this is ~256x384 source pixels per frame.
3. The current side destination is only 48px wide and ~81px tall. Therefore the current sprite path is strongly downscaling the source frame, not enlarging it. A 1.25x visual candidate (~60x101) still remains far below source resolution.
4. `engine-ab.js` forces `ctx.imageSmoothingEnabled=false` for this downscale. That is a style choice, not proof of optimal quality for a high-resolution source being reduced to ~19-21% of its source dimensions.
5. `engine-ab.js` uses `Date.now()/130` for pose columns. The animation clock is independent of physical displacement and independent of the requestAnimationFrame timestamp. It nominally changes pose about every 130ms (~7.7 frame changes/s) for both walk and run.
6. `engine-ab.js` already stores previous rendered logical position (`_lx/_ly`) and derives displacement in `movingOf()`. That means a distance accumulator can be derived from observed logical displacement rather than blindly incrementing once per render call.
7. Base `render()` in `engine-a.js` draws all simulated players first and `localPlayer` last. This is not Y-depth sorting; a larger local sprite can therefore exaggerate overlap errors when crossing above/below another actor.
8. Base collision is still `radius=20` circle-vs-AABB and is independent of sprite dimensions, so quality/depth experiments can remain presentation-only.
9. `ENGINE_MAP.md` remains stale: it advertises V5.15/v66 and lists `engine-m.js` as hero-sprite owner while current runtime sprite override is in `engine-ab.js`.

### EXTERNAL_EVIDENCE

1. MDN states `requestAnimationFrame()` frequency generally follows display refresh rate and explicitly warns animation progress should use the callback timestamp (or another time source) rather than frame-count assumptions so animation does not run faster on high-refresh displays. This supports testing 60/90/120Hz with time/distance-normalized logic rather than frame-count increments.
2. MDN documents `imageSmoothingEnabled=false` as useful when enlarging pixel art to retain hard pixel edges. Kelo's current operation is the opposite direction: a large source frame is reduced drastically. Therefore the MDN pixel-art recommendation does not by itself establish that nearest-neighbor downscaling is the best-looking option here.
3. MDN's pixel-art scaling guidance notes non-integer source-to-canvas mappings can create undesirable sampling/blurriness. Kelo's current 256→48 and 384→~81 mappings are non-integer reductions, so the actual source art must be compared visually under multiple sampling strategies rather than assumed.
4. Community reports on pixel-art cameras show that integer snapping can remove some subpixel shimmer but can also create stepping/judder, especially with moving cameras/parallax. Counterevidence therefore argues against globally enabling `roundPixels` as the first fix.
5. Recent community reports also show diagonal/subpixel jitter can persist even with nearest filtering and integer-scale attempts. This is evidence that sampling, camera, and logical motion must be measured together instead of treating any single pixel-perfect switch as universal.

### HYPOTHESIS

The next premium improvement should split into two independent presentation experiments. First, gait phase should be accumulated from world displacement once per unique logical position change, while wall-clock/rAF time is used only for idle transitions or bounded fallback behavior. Second, avatar scale should be tested with a small prefiltered runtime sprite cache/mini-atlas (or equivalent offline derivative) so the browser does not repeatedly perform a harsh high-resolution nearest-neighbor downscale every draw. These can be tested without touching collider or movement speed. Scaling should not be promoted until actor-depth and nameplate overlap pressure are measured, because the current local-last draw order can become visibly wrong with a larger avatar.

### PROPOSED_CHANGE

**P1 — Unique-displacement gait accumulator, not render-count accumulator**
- Keep the CG-003 distance-phase direction but explicitly guard it from duplicate render calls.
- Compute `dist = hypot(p.x-lastPhaseX, p.y-lastPhaseY)` and only advance gait phase when the logical position changed beyond an epsilon.
- Update `lastPhaseX/Y` after consuming that displacement. A second render of the same logical state must add zero phase.
- Store phase per actor, not globally.
- Use gait-specific stride length only after baseline measurement; do not hard-code the candidate stride ranges as truth.

**P2 — rAF timestamp telemetry before fixed-timestep work**
- Instrument actual render intervals and pose-change times using the animation-frame timestamp where available.
- Compare pose cadence, physical distance and foot-anchor screen jitter at 60/90/120Hz-capable runs.
- Do not convert simulation to fixed timestep in this round unless the same trace shows a refresh-dependent physics defect.

**P3 — Sampling A/B/C for the larger avatar**
- A: current direct draw from full sheet with smoothing off.
- B: direct draw with smoothing on (and `imageSmoothingQuality='high'` only where supported), measured as a quality experiment, not a production assumption.
- C: build a small prefiltered runtime atlas once after source cleanup at the exact candidate visual scale(s), then draw that cached result 1:1 or near-1:1 during gameplay.
- Candidate scales remain 1.15/1.25/1.30, collider fixed at 20.
- Compare edges, facial/clothing readability, shimmer during lateral movement, memory and frame-time tails.

**P4 — Treat depth as a scale gate**
- Add crossing traces where local and simulated actors pass above/below each other.
- Record whether local-last drawing produces visually impossible overlap at each visualScale.
- Do not immediately implement global Y-sort; first identify which render layers/actors/buildings participate and whether wrappers add extra passes.

**P5 — Nameplate and foot-root contract**
- Keep nameplate derived from the visual top (`footY - visualHeight - gap`) but measure overlap with nearby avatars/buildings.
- Keep physical foot root and collider unchanged.
- If torso bob/lean is introduced, nameplate should follow the stable visual envelope or a damped head anchor, not jitter every 1px body bob unless tests show that looks better.

**P6 — Architecture correction after runtime proof**
- If Grok confirms `engine-ab.js` is the sole effective current hero-sprite override in the deployed build, update `ENGINE_MAP.md` hero ownership/version in the same verified change set. Do not edit the map first and then assume runtime matches it.

### DO_NOT_ASSUME

- Do not advance phase by `phase += speed * frameCountFactor`; that is refresh-rate sensitive.
- Do not advance phase unconditionally inside `renderAvatar`; duplicate renders can double-step unless displacement consumption is guarded.
- Do not assume nearest-neighbor is superior for this source simply because the final visual style is pixel-art-like; the source is currently being heavily downscaled.
- Do not turn on `roundPixels` globally as a jitter fix.
- Do not Y-sort actors/buildings blindly before tracing the actual layered render chain.
- Do not change collider radius, camera target, movement speed or world coordinates during the visual-scale experiment.

### EXPERIMENT

1. Baseline current V5.25/v76 with visualScale 1.00 and existing Date.now cadence.
2. Record right walk, right run, left run, diagonal run and R↔L reversal with: rAF timestamp, logical x/y, displacement delta, pose column, camera x/y, screen foot point.
3. Add a diagnostic duplicate `renderAvatar` invocation in a test-only harness or count existing invocations. Verify the proposed displacement accumulator advances once for one logical movement state, not once per draw call.
4. Compare baseline clock cadence vs displacement cadence using identical movement traces.
5. For scale 1.00/1.15/1.25/1.30, capture sampling A/B/C screenshots/video on desktop and representative mobile DPR.
6. Run actor crossing in both Y directions and doorway/building edge traces at each scale.
7. Keep collision radius exactly 20 and compare collision event/outcome trace hashes.
8. Reject any candidate that improves still-image size but worsens movement shimmer, depth correctness, nameplate collisions or frame-time tail.

### DECIDING_METRICS

- `phaseAdvancePerUniqueDisplacement`
- `phaseAdvanceOnDuplicateRender` (target 0)
- `poseChangesPer100WorldPx` walk/run
- `poseChangeIntervalMs` distribution by refresh rate
- `footSlipPxPerStride`
- `footAnchorScreenJitterP95`
- `samplingMode` A/B/C
- `visualScale`
- `spriteEdgeShimmerCount` from fixed clip/review
- `nameplateOverlapRate`
- `actorDepthOrderErrorCount`
- `collisionOutcomeDiffCount` (target 0)
- `colliderRadiusBeforeAfter` (20→20)
- `frameTimeP95/P99`
- one-time atlas build time and cached atlas memory if P3-C is tested

### RISKS

- Prefiltering can soften intended pixel-art edges; it is an A/B test, not a recommendation to blur the art.
- Runtime mini-atlas caching adds memory and startup work; if visual gains are negligible, keep current direct draw.
- `imageSmoothingQuality` has limited cross-browser support; do not rely on it as the only production path.
- Larger avatars may make existing local-last render ordering look much worse even when movement itself improves.
- Without video or trace-based foot-contact labeling, `footSlipPxPerStride` remains partly heuristic because the 4-frame source may not contain exact contact metadata.

### EXPECTED_GROK_FEEDBACK

Please classify P1-P6 independently and return:

- current deployed commit/build identity actually tested;
- actual `renderAvatar` invocation count per actor per displayed frame;
- whether a unique-displacement accumulator remains stable under duplicate draws;
- 60/90/120Hz or best-available pose timing evidence;
- A/B/C sampling comparison at 1.00/1.15/1.25/1.30;
- whether prefiltered cache materially improves moving quality or only still screenshots;
- actor crossing/depth failures after scaling;
- nameplate overlap and doorway/occlusion evidence;
- collider and collision-trace equality;
- any proposal rejected due to sprite art, memory, startup cost or current architecture;
- ENGINE_MAP correction only if runtime ownership is independently verified.

---

## CG-20260901-005 — Make lateral animation state render-pure before integrating the larger 8-frame asset

ID: CG-20260901-005
TIMESTAMP: 2026-09-01T02:37:32-04:00
AUTHOR: ChatGPT
BASE_COMMIT: acb8fa001170f2bd82ab7aef49cb97ff7f385b56
STATUS: PROPOSED
PRIORITY: HIGH
TAGS: movement,render,shadow,atlas,textures,collision,camera,60hz,90hz,120hz,benchmark,architecture
AFFECTED_FILES: engine-i.js, engine-ab.js, engine-a.js, engine-ac.js, engine-ah.js, engine-v.js, assets/hero.PNG, ENGINE_MAP.md, index.html
RESPONDS_TO: CG-20260831-003; CG-20260831-004; current user priority lateral movement + larger avatar

### PROBLEM

The next visual step is still a better lateral asset, but current `main` has changed again and now exposes a stronger architectural constraint: actor rendering is duplicated by the plaza wrapper. If gait phase, reversal state, bob, contact events, or other visual locomotion state is mutated every time `renderAvatar()` executes, a single logical simulation state can advance visually more than once. That would make an 8-frame premium asset look inconsistent across render layers and refresh rates even if the artwork itself is good.

### CONFIRMED_IN_GEMINI

At `main` commit `acb8fa001170f2bd82ab7aef49cb97ff7f385b56`:

1. `index.html` is now `Kelo World — V5.35` and loads engines with cache `v=86`; prior V5.25/v76 assumptions are stale.
2. `ENGINE_MAP.md` is still stale at V5.15/v66 and still names `engine-m.js` as hero-sprite owner. Current `engine-ab.js` remains the effective sprite override.
3. `engine-i.js` Plaza Ground V3 now calls the previous `render()` and then explicitly redraws all `simulatedPlayers` plus `localPlayer` above the baked floor. Therefore actors are currently rendered in at least two passes in the normal plaza path.
4. This specifically invalidates CG-002's then-current observation that `engine-i.js` no longer redrew avatars; the code changed again and avatar redraw is back.
5. `engine-ab.js` is not a pure draw function: `movingOf()` mutates `_lx`, `_ly`, `_walkHold`, `_mdx`, `_mdy`; `faceOf()` mutates `_face`. Its current `stepCol()` uses wall clock and therefore is not yet double-stepped, but a future distance accumulator placed naively inside `renderAvatar()` would be vulnerable to duplicate draw calls.
6. Current side animation remains 4 columns with `Math.floor(Date.now()/130)%4`; walk and run still share that pose clock even though `engine-ac.js` differentiates gait speeds.
7. Current player collider remains `radius:20`; sprite draw dimensions are independent, so a larger visual avatar can still be tested without touching collision.
8. `engine-ah.js` still documents that moving shadow+sprite together produced floating; visual bob therefore must remain above a stable foot/shadow root.
9. `engine-v.js` is intentionally empty except for the note that scale is absorbed into `engine-ab` draw size so feet stay planted.
10. The `assets` directory still contains only the existing `hero.PNG`, plaza asset and tileset; no production `hero-side-v2`/manifest is present in `main` yet.
11. `engine-ab.js` still removes every near-white source pixel by editing alpha after `getImageData()`. A new alpha-clean asset should not rely on this white-key cleanup because it can erase intentional bright whites/highlights.

### EXTERNAL_EVIDENCE

1. MDN documents that `requestAnimationFrame()` normally tracks the display refresh rate, including 60/75/120/144Hz, and warns that animation progress must be based on timestamps/time rather than assuming a fixed number of display frames. This supports keeping locomotion state independent of render call count.
2. PixiJS scene-object documentation distinguishes stable sprite anchors/pivots from visual scale. Although Kelo is Canvas2D and should not migrate merely for this, the scene-graph principle supports a fixed foot-origin contract while changing sprite dimensions.
3. MDN confirms `imageSmoothingEnabled=false` preserves hard pixel edges during scaling, but it does not guarantee artifact-free non-integer scaling on every platform.
4. PixiJS GitHub issues document one-pixel gaps/edge artifacts with nearest filtering and atlases, including reports specific to iOS browsers; padding/extrusion and actual-device inspection remain necessary counterevidence against assuming nearest-neighbor alone is sufficient.
5. Community foot-sliding guidance repeatedly converges on matching animation cadence to the distance a planted foot represents, not merely playing the same cycle at a fixed clock. Pixel-art feedback also emphasizes that a foot bearing weight should remain visually stable instead of shifting several pixels between contact frames.

### HYPOTHESIS

The premium 8-frame side asset will produce the biggest visible improvement only if locomotion state is sampled once per logical update and rendering becomes read-only with respect to gait phase/contact/reversal. The safest integration is therefore: keep the current physics, create/update a per-actor visual locomotion state outside the draw pass, then let every render layer consume the same immutable visual sample. This makes duplicated rendering ugly/expensive but not semantically wrong, and it gives Grok a measurable path to remove the extra actor pass later without changing animation behavior.

### PROPOSED_CHANGE

**P1 — Baseline the duplicate render before changing it**
- Instrument `renderAvatar` call count per actor per animation frame and distinguish base pass vs `engine-i` redraw if possible.
- Do not remove the redraw first. Record the baseline visual result, actor ordering, nameplate duplicates/overdraw and frame-time tails.

**P2 — Move visual locomotion state out of draw-side effects**
- Introduce a small per-actor `visualMotion` state updated once per simulation/update cycle or by an explicitly idempotent sampler keyed to unique logical displacement.
- Candidate fields: `face`, `gait`, `phase`, `strideDistance`, `lastX`, `lastY`, `reversalState`, `contactFoot`, `visualScale`.
- `renderAvatar()` should read this state and draw it; repeated rendering of the same simulation state must not change phase, contact, reversal or bob.
- If the current wrapper chain makes a once-per-update hook risky, use a `simulationSerial`/logical-position guard rather than render count.

**P3 — Integrate the new lateral asset behind a fallback, not as a blind replacement**
- Proposed production contract for the first real asset: transparent PNG, 128x192 cells, 8 columns, two rows (`walk_right`, `run_right`), fixed foot pivot `(64,176)`, contact frames `[0,4]`, safe transparent padding, no baked shadow, no labels/text.
- Mirror to left only if the character design is intentionally symmetric.
- Add a small JSON/JS manifest for frame size, rows, pivot and contact frames instead of inferring everything from magic numbers.
- Keep old `assets/hero.PNG` as fallback until same-trace tests pass.

**P4 — Separate foot/shadow/nameplate transforms**
- Logical foot root remains tied to `p.x/p.y` and collider 20.
- Shadow center remains on that root and is drawn once per actor presentation pass; body can apply a very small phase-derived bob/lean above it.
- Nameplate should derive from the stable visual envelope, not oscillate with every 1px body bob.

**P5 — Scale only after pure-state integration**
- Test visualScale 1.15, 1.25 and 1.30 with collider fixed 20.
- For the proposed 128x192 source cells, choose final draw size from visual quality rather than assuming one scale factor; preserve foot pivot and compare side silhouette against front/back.
- Run doorway, building-edge, NPC crossing and nameplate-overlap traces at each candidate size.

**P6 — Only then evaluate removing `engine-i` actor redraw**
- If instrumentation confirms two complete actor passes and the second is only compensating for floor layering, redesign layering so floor is drawn before actors or otherwise compose actors once.
- Baseline → layer change → same trace → re-measure. Do not delete the redraw until actor visibility/depth is proven equivalent or better.

### DO_NOT_ASSUME

- Do not put stride accumulation, reversal timers or contact-event mutation directly inside a draw that can execute twice.
- Do not treat the conceptual infographic generated outside the repo as a production spritesheet; production requires clean alpha-only cells and deterministic metadata.
- Do not change collider radius from 20 during visual-scale testing.
- Do not bake the shadow into the sprite sheet.
- Do not use the current white-key cleanup for the new asset unless an A/B proves it is still needed; alpha transparency should be authored directly.
- Do not remove the `engine-i` redraw merely because it is redundant; it currently exists to restore actors above the plaza floor, so layer ordering must be reproduced first.
- Do not migrate to Pixi/WebGL solely to gain anchors/pivots; Canvas2D can implement the same contract.

### EXPERIMENT

1. Baseline V5.35/v86, current 4-frame sprite, current duplicate actor pass.
2. Instrument `renderAvatarCallsPerActorPerRAF`, frame time, face/gait/column, logical x/y, camera x/y and collider radius.
3. Run identical traces: right walk, right run, left run, diagonal, R↔L reversal, run→idle, actor crossing and doorway pass.
4. Add render-pure visual state without changing the visual result; repeated draw of the same actor state must produce zero phase delta.
5. Repeat the baseline trace. Reject the change if physics/collision or visible timing changes unexpectedly.
6. Integrate `hero-side-v2` + manifest behind a feature flag/fallback and repeat the same trace.
7. Tune stride cadence from measured foot-contact travel; compare foot slip and reversal pop against the 4-frame baseline.
8. Test visualScale 1.15/1.25/1.30 with collider fixed 20 and inspect desktop + representative mobile DPR.
9. Only after those results, prototype floor-before-actors/single actor pass and repeat the exact trace again.

### DECIDING_METRICS

- `renderAvatarCallsPerActorPerRAF`
- `visualMotionUpdatesPerLogicalStep`
- `phaseDeltaOnSecondDraw` (target 0)
- `contactStateDeltaOnSecondDraw` (target 0)
- `footSlipPxPerStride`
- `reversalPosePopCount`
- `directionFamilySwitchesPerSecond`
- `footAnchorScreenJitterP95`
- `colliderRadiusBeforeAfter` (must remain 20→20)
- `collisionOutcomeDiffCount` (target 0 for presentation-only stages)
- `nameplateDuplicateOrOverlapRate`
- `actorDepthOrderErrorCount`
- `frameTimeP95/P99`
- `spriteEdgeShimmerCount`
- alpha/highlight-loss inspection for the new asset

### RISKS

- Moving state out of render can subtly change bot animation if bot positions are updated in a different wrapper/order than the local player; verify every actor type.
- Removing the extra actor pass too early can hide actors under the plaza floor because V3 currently redraws them intentionally.
- An 8-frame asset with poor contact poses can still slide; more frames are not automatically better.
- Non-integer scaling can still produce shimmer/edge artifacts, particularly on mobile browsers; padding and real-device inspection matter.
- Bigger avatars increase occlusion/depth/nameplate pressure even when collision remains identical.

### EXPECTED_GROK_FEEDBACK

Please classify P1-P6 independently and report:

- exact `main`/Pages build tested;
- measured renderAvatar calls per actor per displayed frame before any change;
- whether visual locomotion state can be made once-per-logical-step without breaking wrappers;
- whether duplicate rendering changes phase/contact after the prototype (target: no);
- whether a clean 8-frame side asset + manifest is available/usable and any required contract changes;
- foot-slip/reversal results versus current 4-frame baseline;
- scale 1.15/1.25/1.30 collision/depth/nameplate/frame-time results;
- whether `engine-i` actor redraw can be replaced by correct layer ordering, and proof if changed;
- any incompatibility that makes this hypothesis obsolete.

---

## CG-20260901-007 — Make foot phase a logical visual state, not a render side effect

ID: CG-20260901-007
TIMESTAMP: 2026-09-01T04:33:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: d16d5b454cc59ba589be92cf8304dec7aeb812f3
STATUS: PROPOSED
PRIORITY: HIGH
TAGS: movement,render,shadow,canvas2d,60hz,90hz,120hz,architecture,benchmark,atlas,textures
AFFECTED_FILES: engine-ab.js, engine-ac.js, engine-ah.js, engine-i.js, engine-l.js, ENGINE_MAP.md, assets/hero.PNG, assets/README.md
RESPONDS_TO: user priority lateral locomotion + larger avatar; extends CG-20260901-005 and pending CG-20260901-006

### PROBLEM
Current side locomotion is still selected/rendered from mutable state inside renderAvatar(). movingOf() updates _lx/_ly/_walkHold/_mdx/_mdy; faceOf() updates _face; stepCol() uses wall-clock Date.now()/130. engine-i.js performs a second actor draw pass above plaza ground. The current time-based frame selection is duplicate-draw tolerant, but a naive future phase += distance inside renderAvatar() would make animation logic depend on how many render passes execute. The proposed larger 8-frame asset therefore needs its locomotion state advanced outside render calls before integration.

### CONFIRMED_IN_GEMINI
- main HEAD inspected: d16d5b454cc59ba589be92cf8304dec7aeb812f3; gameplay remains index V5.35 / cache v86.
- engine-ab.js is the effective hero sheet renderer despite ENGINE_MAP.md still naming engine-m.js as Hero sprite owner.
- engine-ab.js assumes 4 columns and 4 rows; side row is row 2, left mirrors right, and frame column is Math.floor(Date.now()/130)%4.
- movingOf() mutates per-player historical state on every renderAvatar() call.
- faceOf() mutates p._face on every moving render.
- engine-i.js currently calls the wrapped render and then redraws simulatedPlayers and localPlayer above plaza ground, so renderAvatar() can execute more than once per visual frame for the same logical actor state.
- engine-ac.js computes gait idle/walk/run with thresholds 0.14 and 0.74 and physical walk/run speeds 96 and ~165-172 px/s, but engine-ab does not select distinct walk/run animations.
- engine-ah.js hard-stops velocity when movement input is absent; its prior visual bob was explicitly removed because moving shadow+sprite looked like floating.
- engine-l.js owns HiDPI backing-store sizing, caps DPR at 3 and resets imageSmoothingEnabled=true before downstream render code; engine-ab locally disables smoothing only while drawing the hero.
- assets/README.md still describes the old simple hero.png contract; no production 8-frame side asset/manifest contract is documented there.

### EXTERNAL_EVIDENCE
- MDN states requestAnimationFrame normally tracks display refresh, including 60/75/120/144 Hz, and warns animation progress must use time rather than assuming one fixed amount per callback. This supports state advancement from logical distance/time rather than render-call count.
- MDN documents imageSmoothingEnabled=false as the standard Canvas2D control for retaining hard pixel edges when scaled, but imageSmoothingQuality is not Baseline across major browsers; it should not be a required quality dependency.
- Community foot-sliding guidance consistently matches movement speed/animation speed to the distance traveled between planted-foot events; one practical method measures world distance between contact and lift frames and derives animation cadence from it.
- Community Y-sort evidence supports using a bottom/pivot/foot contact reference rather than animated sprite center. Counterevidence: complex structures such as stairs/bridges cannot always be solved by one global Y sort and may need explicit layer/trigger rules.

### HYPOTHESIS
A small per-actor visual locomotion state updated once per logical movement step will unlock the premium side asset more safely than putting stride logic into renderAvatar(). It can preserve immediate physical response while stabilizing contact frames, reversal, diagonals and 60/90/120-Hz presentation. A fixed foot root can simultaneously serve sprite pivot, shadow anchor and future actor sortY without allowing bob/lean to alter collisions or depth.

### PROPOSED_CHANGE
Do not refactor blindly. Prototype behind a flag:
1. Add/update one visual locomotion state per actor outside renderAvatar(), ideally after movement state for that logical step is known: {faceFamily, face, gait, phase01, distanceAccumulator, plantedFoot, reversalState, footRootX, footRootY}.
2. Advance phase from actual world distance traveled. Renderer only samples phase -> frame; duplicate render calls must not change phase.
3. Keep walk and run as different asset rows/cycles. Calibrate strideWorldPx from the final art rather than inventing values.
4. Add diagonal family hysteresis around the current side-vs-vertical threshold so small joystick noise cannot flip rows every update.
5. On left-right reversal, preserve/resolve to a contact-compatible pose visually while allowing physics direction to reverse immediately.
6. Define footRootY from the existing p.y + 10 convention for the first experiment. Bob/lean affect sprite-local offsets only; shadow anchor, collider and future sortY stay tied to footRoot.
7. New side asset contract remains 8 WALK RIGHT + 8 RUN RIGHT, 128x192 cells, alpha transparency, fixed pivot, contact frames 0/4, no baked shadow. LEFT may be mirrored only while the design is symmetric.
8. Scale tests should alter destination sprite bounds only (1.15/1.25/1.30 candidates). Collider must remain radius 20.
9. Do not remove engine-i's second actor pass until layer behavior is reproduced and measured; first make rendering idempotent.
10. Update ENGINE_MAP/assets docs only after Grok independently verifies actual owner/contract.

### DO_NOT_ASSUME
- Do not assume 8 frames alone fixes foot sliding.
- Do not use phase += distance inside renderAvatar().
- Do not tie phase to requestAnimationFrame callback count.
- Do not move p.x/p.y for visual bob/lean.
- Do not enlarge collider with sprite scale.
- Do not make imageSmoothingQuality a required browser feature.
- Do not globally Y-sort roofs/stairs/bridges without object-specific depth semantics.
- Do not delete the engine-i actor redraw merely because it is duplicate work; it currently establishes layering above the plaza floor.

### EXPERIMENT
Baseline -> flagged visual state -> same trace -> 8-frame asset -> same trace -> scale buckets -> same trace.
Trace: idle -> walk right -> run right -> right/left reversals -> diagonal joystick near threshold -> stop -> repeat left -> NPC crossing -> building edge. Execute equivalent logical trace at 60/90/120-Hz-capable environments where possible.
Instrument once per logical update and per render: x,y,vx,vy,gait,input magnitude,visual phase,frame,row,faceFamily,plantedFoot,footRoot,renderAvatarCallIndex,camera x/y,destination sprite bounds.
Then compare current wall-clock 4-frame path against the new state-driven path without changing physical speed/collider.

### DECIDING_METRICS
- visualMotionUpdatesPerLogicalStep == 1
- phaseDeltaOnDuplicateRender == 0
- renderAvatarCallsPerActorPerRAF
- worldPxPerWalkCycle / worldPxPerRunCycle
- footSlipPxPerContact
- footAnchorScreenJitterP95
- falseDiagonalPoseSwitchCount
- reversalPosePopCount
- contactFrameContinuityRate
- actorDepthOrderErrorCount
- nameplateOverlapRate after scale
- collisionOutcomeDiffCount == 0
- colliderRadiusBeforeAfter == 20->20
- frameTimeP95/P99 at 60/90/120-Hz targets
- spriteEdgeShimmerCount at DPR 1/2/3 and scale candidates

### RISKS
- Updating visual state in another wrapper can worsen architecture if it becomes a second movement owner; prefer one clearly named presentation-state updater and benchmark call count.
- Poor stride calibration can make an 8-frame asset look worse than the current 4-frame loop.
- Mirroring LEFT will mirror asymmetric clothing/accessories.
- Increasing visual height can raise occlusion/nameplate conflicts even with unchanged collider.
- Pixel-hard sampling can shimmer under fractional camera/zoom/DPR combinations; test real mobile Safari/Chrome rather than assuming nearest-neighbor is sufficient.
- Full actor Y-sort will not solve multi-level structures by itself.

### EXPECTED_GROK_FEEDBACK
Grok should classify each proposal VIABLE/NEEDS_TEST/NOT_VIABLE/DEFERRED and report:
- exact current HEAD and whether code changed since this base;
- actual final runtime count/order of renderAvatar calls per RAF;
- best location for once-per-logical-step visual locomotion update without creating another movement owner;
- baseline vs flagged-state traces showing duplicate renders do not advance phase;
- measured stride/contact distance once production art is available;
- 60/90/120-Hz and DPR/scale evidence where feasible;
- whether the existing footY=p.y+10 is a stable enough root or needs an explicit asset manifest offset;
- any architecture conflict with engine-i/l/ab wrappers;
- whether ENGINE_MAP/assets README correction is independently verified.

## CG-20260901-008 — Test device-pixel foot-root snapping before adding runtime squash/lean

ID: CG-20260901-008
TIMESTAMP: 2026-09-01T05:37:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: ecd41dfa959a6035cb5382b66ceeb01e54809fa1
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,canvas2d,60hz,90hz,120hz,camera,textures,benchmark,architecture
AFFECTED_FILES: engine-ab.js, engine-a.js, engine-ac.js, engine-l.js, engine-i.js, engine-v.js, assets/hero.PNG, ENGINE_MAP.md
RESPONDS_TO: CG-20260901-005; current user priority lateral movement + larger premium avatar

### PROBLEM

Current lateral research has focused on stride phase, foot anchoring, duplicate render purity and a better 8-frame asset. A separate presentation issue is now confirmed in current main: `engine-ab.js` rounds sprite destination X/Y to integer WORLD coordinates before the already-active camera/zoom/HiDPI transforms. At high refresh rates, WALK displacement per display frame can be below one world pixel, so world-integer snapping can create repeated-position/uneven-step patterns even when physics and camera state remain smooth. In parallel, `engine-a.js` already computes speed-responsive `squashX/squashY`, but the current PNG sprite override does not consume those values. Applying them naively to pixel art could disturb the fixed foot root and introduce resampling shimmer.

### CONFIRMED_IN_GEMINI

At `main` commit `ecd41dfa959a6035cb5382b66ceeb01e54809fa1`:

1. `index.html` remains Kelo World V5.35 and loads engines with cache `v=86`.
2. `ENGINE_MAP.md` remains stale at V5.15/v66 and still claims `engine-m.js` owns hero sprite rendering; current effective PNG override is `engine-ab.js`.
3. `engine-ab.js` calculates the visible sprite destination with `Math.round(p.x - dw/2)` and `Math.round(footY - dh)`. This quantizes BODY placement to integer world coordinates before world-to-screen transforms.
4. `engine-ab.js` also rounds nameplate X/Y separately. Its logical foot reference is `footY=p.y+10`.
5. Current side visual width is 48 and height about 81; collider remains independent (`localPlayer.radius=20` in engine-a).
6. `engine-ac.js` defines WALK speed 96 px/s and RUN speed `165 + (mag-0.74)*28`, giving ~172.28 px/s at full analog/key magnitude.
7. Therefore ideal logical displacement per display refresh is approximately: WALK 1.60 px @60Hz, 1.07 @90Hz, 0.80 @120Hz; full RUN 2.87 @60Hz, 1.91 @90Hz, 1.44 @120Hz. Integer-world sprite rounding can therefore repeat the same sprite X on some high-refresh WALK frames even though player X changed.
8. `engine-l.js` uses a HiDPI backing canvas and caps DPR at 3, so the renderer may have finer-than-1-CSS-pixel device resolution available even though `engine-ab.js` currently discards subpixel world placement before final transform.
9. `engine-a.js` computes `squashX` toward `1 + speedRatio*0.08` and `squashY` toward `1 - speedRatio*0.06` with exponential smoothing. The sprite override in `engine-ab.js` does not use these values, so existing speed-responsive deformation is effectively absent from the PNG avatar path.
10. `engine-v.js` intentionally performs no scale transform and notes that scale is absorbed in engine-ab draw size to keep feet planted.
11. `engine-i.js` still redraws actors after the plaza ground pass; any new presentation state or snap calculation must remain idempotent across duplicate draws.

### EXTERNAL_EVIDENCE

1. MDN states `requestAnimationFrame()` normally follows display refresh rate, including 60, 75, 120 and 144 Hz, and warns animation progress must be time-normalized rather than frame-count based. High-refresh therefore materially changes per-frame displacement even when speed in px/s is unchanged.
2. MDN's pixel-art guidance explicitly warns that mappings between image, canvas, CSS pixels and device pixels can become uneven when scale/DPR is non-integer. It also notes arbitrary `drawImage()` scaling may map source pixels to fractional canvas pixels and produce artifacts.
3. MDN documents `imageSmoothingEnabled=false` as a hard-edge scaling control, not a guarantee that arbitrary non-integer scale/position mappings are artifact-free.
4. PixiJS issue reports provide counterevidence that nearest filtering plus integer positions eliminates every artifact: one-pixel seams/offsets can still appear at particular scaled positions, including iOS browser reports. This reinforces the need for mobile A/B clips rather than assuming a universal snap rule.
5. Community pixel-art experience with squash/stretch reports that runtime sprite scaling can disturb outlines/pixel alignment. This is not proof Kelo will fail, but it is enough counterevidence to avoid applying the already-computed 8%/6% squash blindly to the premium bitmap.

### HYPOTHESIS

For the premium larger avatar, the best lateral presentation may be: preserve float logical motion and the stable foot root, then compare current WORLD-integer body snapping against a DEVICE-pixel-aware presentation snap (or no pre-rounding) at the final camera/zoom/DPR mapping. Separately, encode most body lean/bob/squash into the new 8-frame artwork rather than anisotropically scaling the full bitmap at runtime. If runtime deformation is still useful, apply only a tiny bounded transform around the FOOT pivot, never around the frame center, and benchmark shimmer/foot drift.

### PROPOSED_CHANGE

**P1 — Instrument current quantization before changing it**
- Record logical `p.x/p.y`, rounded destination X/Y, camera X/Y, zoom, DPR and resulting screen-space foot X/Y for the same lateral traces at best-available 60/90/120Hz.
- Count consecutive displayed frames where logical X changes but rounded sprite destination X does not.

**P2 — A/B/C presentation-position strategies behind a flag**
- A: current `Math.round()` world-space destination.
- B: remove pre-rounding and draw at float world coordinates; preserve `imageSmoothingEnabled=false` initially.
- C: snap the final FOOT ROOT to the nearest physical device pixel after camera+zoom mapping, then derive body destination from that root. Do not snap logical `p.x/p.y` or collider/camera state.
- Keep animation phase and gait unchanged for this experiment so only presentation quantization differs.

**P3 — Keep foot root authoritative**
- Any B/C body destination must be derived from the same `footY=p.y+10` logical root.
- Nameplate may use a separate stable visual-top anchor; do not let body bob/squash change depth/collision.
- Shadow, when reintroduced, should use the same snapped/unsnapped presentation root as the feet so it cannot visibly detach.

**P4 — Do not blindly wire current `squashX/squashY` into the PNG renderer**
- First test the clean new 8-frame asset with NO runtime anisotropic squash.
- Prefer authored walk/run lean, compression and vertical change in the frames themselves.
- If runtime deformation is tested, start much smaller than the existing theoretical 8% X / 6% Y extremes and transform around the foot pivot so contact remains fixed.
- Compare outline stability, shimmer, perceived impact and foot-root error.

**P5 — Scale experiment must include snap strategy**
- Test visualScale 1.15/1.25/1.30 under A/B/C because a scale that looks best with world snapping may not be best with device-pixel snapping.
- Keep collider 20 throughout.

**P6 — Preserve render purity**
- Snap calculation may occur during draw because it is a pure projection, but it must not mutate gait phase/contact/reversal/logical coordinates.
- Duplicate `renderAvatar()` calls for one actor state must return the same projected root and pose.

### DO_NOT_ASSUME

- Do not enable `CONFIG.roundPixels` globally as a shortcut; that can change camera/world presentation broadly and mixes multiple variables.
- Do not round `localPlayer.x/y` or collider coordinates.
- Do not assume float drawing automatically looks better; nearest-filtered pixel art can shimmer at fractional mappings.
- Do not assume integer-world rounding is correct merely because pixel art is desired; at DPR 2/3 the backing canvas has finer device-pixel resolution than 1 CSS/world pixel.
- Do not apply current `squashX/squashY` to the full sprite before an A/B test around the foot pivot.
- Do not rotate the whole premium pixel sprite for lean unless the actual moving clip beats authored-frame lean; arbitrary rotation can create resampling/edge instability.

### EXPERIMENT

1. Baseline current V5.35/v86, current 4-frame asset, current world rounding.
2. Trace right WALK 4s, right RUN 4s, diagonal 4s, R↔L reversals, run→idle at desktop and representative mobile DPR.
3. Capture logical displacement and `spriteDestinationRepeatCount` at available refresh rates.
4. Implement only a feature-flagged projection strategy B; rerun identical trace.
5. Implement pure device-pixel foot-root projection C; rerun identical trace.
6. Compare screen-space foot velocity variance and subjective moving-video jitter/shimmer, not just still screenshots.
7. Once the clean 8-frame asset exists, repeat A/B/C at 1.15/1.25/1.30.
8. Test authored lean/bob only first. Then, if needed, tiny runtime foot-pivot deformation as a separate variable.
9. Collision trace/collider must remain identical during every presentation-only stage.

### DECIDING_METRICS

- `logicalMoveButSameSpriteDestFrameCount`
- `spriteDestinationRepeatRate`
- `screenFootDeltaVariance`
- `footAnchorScreenJitterP95`
- `spriteEdgeShimmerCount`
- `worldRoundVsFloatVsDeviceSnapPreference`
- `visualScale`
- `runtimeSquashEnabled`
- `runtimeSquashFootRootErrorPx` (target 0 if tested)
- `outlineArtifactCount`
- `phaseDeltaOnDuplicateRender` (target 0)
- `collisionOutcomeDiffCount` (target 0)
- `colliderRadiusBeforeAfter` (20→20)
- `frameTimeP95/P99`

### RISKS

- Float/no-rounding may improve temporal smoothness but worsen pixel shimmer.
- Device-pixel snapping depends on correct transform/DPR accounting; snapping in the wrong coordinate space can be worse than the baseline.
- Runtime anisotropic scaling can destabilize outlines and make a premium sprite look cheaper even if the motion technically feels springier.
- High-DPR headless/browser emulation is not a substitute for a real iPhone/Android GPU/browser clip.
- The existing 4-frame art may hide or exaggerate quantization problems differently than the planned 8-frame asset; final decision must be repeated with production art.

### EXPECTED_GROK_FEEDBACK

Please classify P1-P6 independently and return:

- exact build/commit tested;
- measured current `logicalMoveButSameSpriteDestFrameCount` for WALK/RUN at available refresh rates;
- A/B/C moving-video comparison, not only screenshots;
- whether device-pixel foot-root snapping is implementable cleanly with current transform chain;
- any DPR/zoom combination where float/device snap is visibly worse;
- whether the current engine-a squash values are used anywhere else before modifying them;
- clean-asset authored lean/bob result before runtime deformation;
- collider/collision trace equality;
- duplicate-render idempotence;
- any proposal rejected as incompatible with current Canvas2D layering.

---

## CG-20260901-009 — Make stop/start/reversal visual transitions time- and distance-based, not render-count-based

ID: CG-20260901-009
TIMESTAMP: 2026-09-01T06:38:51-04:00
AUTHOR: ChatGPT
BASE_COMMIT: cf135370898963c294e55c5108c819a5ff7fbf71
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,60hz,90hz,120hz,benchmark,architecture,canvas2d
AFFECTED_FILES: engine-ab.js, engine-ac.js, engine-ah.js, engine-i.js, engine-a.js, assets/hero.PNG, ENGINE_MAP.md
RESPONDS_TO: CG-20260901-005, CG-20260901-007, CG-20260901-008; current user priority lateral movement + premium larger avatar

### PROBLEM

Current main mixes a hard physical stop with a render-count-based visual hold. `engine-ah.js` forces `localPlayer.vx/vy=0` immediately when movement input is absent. `engine-ab.js::movingOf()` sets `_walkHold=10` while movement is detected and decrements `_walkHold` by 1 each time `renderAvatar()` calls it while stopped. `engine-i.js` currently redraws actors after the inner render, so `_walkHold` can be consumed more than once per displayed frame. The resulting idle transition duration depends on render-call count and display refresh rate instead of elapsed time/distance. This can make stop/start/reversal cadence visibly inconsistent across 60/90/120 Hz and can become more obvious with a larger 8-frame avatar.

### CONFIRMED_IN_GEMINI

At `main` commit `cf135370898963c294e55c5108c819a5ff7fbf71`:

1. `index.html` remains Kelo World V5.35 and loads engines with cache `v=86`.
2. `engine-ah.js` wraps `updateMovement(dt)` and after the wrapped call sets localPlayer `vx=0`, `vy=0`, `input.normX=0`, `input.normY=0` whenever `hasMoveInput()` is false.
3. `engine-ab.js::movingOf()` assigns `_walkHold=10` if distance >0.12, speed >16, or target distance >14; otherwise it decrements `_walkHold` by one per call.
4. `engine-ab.js::stepCol()` uses `Date.now()/130` while `_walkHold>0`, so once physics stops, the legs can continue cycling until `_walkHold` expires.
5. `engine-i.js` calls the previous renderer and then redraws `simulatedPlayers` plus `localPlayer` over the plaza ground. Therefore `movingOf()` can execute multiple times for the same logical actor state during one RAF.
6. With two avatar draws per RAF, a nominal `_walkHold=10` is roughly five displayed frames. That is about 83 ms at 60 Hz, 56 ms at 90 Hz and 42 ms at 120 Hz, before considering any additional wrappers/draws. The exact runtime count still needs instrumentation.
7. The hold is therefore neither a stable 10-frame display transition nor a stable time transition.
8. `engine-ac.js` already exposes logical gait (`idle`, `walk`, `run`) before the base movement call, so a dedicated visual locomotion state can use gait/input/velocity without relying on render-count mutation.
9. `engine-ab.js` is still the effective PNG sprite override despite stale `ENGINE_MAP.md` ownership metadata.
10. `engine-v.js` remains intentionally empty to preserve planted feet; collider is still independent from visual sprite size.

### EXTERNAL_EVIDENCE

1. MDN documents that `requestAnimationFrame()` normally follows display refresh rate (commonly 60 Hz, with 75/120/144 Hz also widespread) and warns animation progress must use elapsed time rather than assuming a fixed amount per callback. This directly argues against render-count-based transition timers.
2. PixiJS documentation distinguishes sprite anchor/pivot from scale and positioning; a foot-root pivot is therefore a standard way to keep a visual contact point stable while poses/scale change above it. This supports keeping start/stop/reversal presentation around a fixed foot root rather than moving the logical body.
3. Community game-animation guidance on foot sliding consistently favors matching animation phase/contact to actual displacement and preserving contact events rather than blindly advancing a looping clip by render frames.
4. Counterevidence: a tiny authored follow-through after input release can improve perceived weight. Therefore the recommendation is not “snap immediately to idle”; it is “make any follow-through explicit and elapsed-time/contact-based.”

### HYPOTHESIS

Kelo will feel more planted if physical input response remains immediate while visual locomotion transitions are represented by a render-pure state machine updated once per logical step. On release, the state should finish or resolve toward a nearby contact pose over a short bounded elapsed-time/contact window, then enter idle. On start and reversal, phase should be initialized/preserved from foot-contact semantics rather than reset to frame zero. This should remove refresh-rate-dependent stop cadence without adding input latency.

### PROPOSED_CHANGE

**P1 — Instrument before changing behavior**
- Count `renderAvatar()` calls per actor per RAF and `_walkHold` decrements per RAF.
- Record release timestamp, physical velocity-zero timestamp, last locomotion frame timestamp and idle-enter timestamp.
- Measure at best-available 60/90/120 Hz.

**P2 — Remove render-count ownership from `movingOf()`**
- Do not decrement a transition counter inside `renderAvatar()`.
- Keep `renderAvatar()` projection-only: same logical state in -> same pose/root out.
- Move visual locomotion state update to one logical update path.

**P3 — Explicit stop transition**
- When move intent becomes zero, keep physics policy unchanged for the first experiment (current hard stop) so only presentation changes.
- Resolve visual phase toward the nearest valid contact/idle-compatible pose using elapsed time or contact distance, not number of renders.
- Candidate test window: ~50–100 ms maximum, but do not ship a number until A/B clips and metrics choose it.
- If already on a contact frame, allow immediate idle transition.

**P4 — Start transition**
- From idle to walk/run, choose a deterministic first-contact/anticipation phase rather than letting global `Date.now()` select an arbitrary leg pose.
- Preserve foot root and shadow anchor.

**P5 — Walk↔run transition**
- With the future 8-frame asset, map walk phase to the nearest homologous run phase (contact/down/passing/up) instead of resetting animation.
- Keep physical gait threshold unchanged during this test.

**P6 — Reversal**
- Preserve or resolve stride phase around a contact event when right↔left flips.
- Do not delay physical direction change; only smooth presentation.
- Add diagonal hysteresis as a separate flag so reversal and diagonal-family switching can be measured independently.

**P7 — Larger avatar compatibility**
- Run transitions at visualScale 1.15/1.25/1.30 once the clean asset exists.
- Collider must remain 20.
- Nameplate/shadow/depth anchors derive from foot root/visual bounds, not bob frame.

### DO_NOT_ASSUME

- Do not remove the hard physical stop in the same experiment; that would mix movement feel with animation transition policy.
- Do not replace `_walkHold=10` with “10 RAF frames”; that remains refresh-rate dependent.
- Do not use global `Date.now()` modulo as the final walk/run phase source for the new asset.
- Do not reset walk/run/reversal to frame zero unless A/B evidence shows it is visually superior.
- Do not mutate `p.x/y`, collider, camera or gait inside the renderer.
- Do not interpret a still screenshot as evidence for transition quality; use moving clips and timing traces.

### EXPERIMENT

1. Baseline V5.35/v86 current 4-frame asset.
2. Trace: idle 1s -> WALK/keyboard right 2s -> release 1s -> start right -> reversal left -> release; repeat with touch analog walk/run where available.
3. Instrument current `_walkHold` decrements, avatar draw count and stop duration at 60/90/120 Hz.
4. Implement only render-pure visual state with elapsed-time stop resolution; keep physics hard stop unchanged.
5. Rerun exact trace and compare stop visual duration across refresh rates.
6. Add deterministic idle->walk start phase and rerun.
7. Add walk↔run phase mapping and reversal preservation separately, rerunning the same trace after each flag.
8. Repeat with future 8-frame lateral asset and 1.15/1.25/1.30 visual scale.

### DECIDING_METRICS

- `renderAvatarCallsPerActorPerRAF`
- `walkHoldDecrementsPerRAF`
- `releaseToPhysicalStopMs`
- `releaseToVisualIdleMs`
- `releaseToVisualIdleVarianceAcrossHz`
- `startPosePopCount`
- `walkRunTransitionPosePopCount`
- `reversalPosePopCount`
- `phaseDeltaOnDuplicateRender` target 0
- `footSlipPxPerContact`
- `footAnchorScreenJitterP95`
- `collisionOutcomeDiffCount` target 0
- `colliderRadiusBeforeAfter` target 20->20
- moving-video preference at 60/90/120 Hz

### RISKS

- A visual follow-through that lasts too long will feel like input lag even if physics already stopped.
- Immediate idle can look robotic if the current frame is far from a contact/neutral pose.
- Mapping phases between walk and run requires semantically authored frames; the current 4-frame sheet may not support a strong final solution.
- Duplicate actor rendering remains an architectural cost; this proposal only makes locomotion safe under it, not a reason to keep duplicate passes forever.
- Keyboard currently resolves to full input magnitude, while touch supports analog magnitudes; transition tests must distinguish those input modes.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1-P7, then report:
- exact current renderAvatar call count per actor/RAF;
- measured current `_walkHold` lifetime at available refresh rates;
- whether an update-side visual state is viable without adding another wrapper owner;
- A/B timings and clips for current vs elapsed-time/contact stop transition;
- start/walk-run/reversal pop counts when implemented;
- any code ownership conflict with engine-a/ac/ah/ab/i;
- whether the future 8-frame asset needs additional semantic metadata for transition mapping;
- exact commits/tests/live verification and any proposal rejected or deferred.

## CG-20260901-010 — Distance-matched WALK/RUN phase + contact-bounded stop for V5.36

ID: CG-20260901-010
TIMESTAMP: 2026-09-01T07:33:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: b2e13483946acbb603d58fef4ae57273b9c25fa1
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,60hz,90hz,120hz,benchmark,architecture,canvas2d,shadow,atlas
AFFECTED_FILES: engine-ac.js, engine-ab.js, engine-ah.js, engine-i.js, engine-a.js, assets/hero.PNG, assets/README.md, ENGINE_MAP.md
RESPONDS_TO: CG-20260901-005, CG-20260901-009; V5.36 visual locomotion implementation; current user priority lateral movement + larger premium avatar

### PROBLEM

V5.36 correctly moved the local player's visual locomotion state out of `renderAvatar()`, so duplicate actor draws no longer consume local gait state. However, pose phase is still advanced by a fixed `VISUAL_FRAME_SEC=0.130` for both WALK and RUN. That means the physical distance represented by one full 4-frame cycle changes dramatically with gait speed. The new `VISUAL_STOP_HOLD_SEC=0.075` is also shorter than one 130 ms pose interval, so a release can either cross a frame boundary or not depending on sub-frame timing, then resets to frame 0. This is not yet true contact-aware foot planting.

### CONFIRMED_IN_GEMINI

At `main` commit `b2e13483946acbb603d58fef4ae57273b9c25fa1`:

1. `index.html` is `Kelo World — V5.36` and loads engines with cache `v=87`.
2. `engine-ac.js` now owns `_visualMotion` for the local player and updates it once after wrapped movement. This is a substantial improvement over render-count mutation.
3. `engine-ab.js` consumes `_visualMotion` when present and does not mutate the local player's phase/contact state during draw. Legacy actors still use render-side fallback state.
4. `engine-i.js` still redraws actors above the plaza floor, so making local state render-pure was necessary; duplicate draw architecture itself remains.
5. `engine-ac.js` still advances `v.frame` via `frameElapsed += dt` and one frame every `0.130s`, independent of actual distance traveled and independent of gait.
6. Current 4-frame cycle duration is 4 × 0.130 = 0.520 s.
7. WALK physical speed is 96 px/s, therefore a nominal cycle covers ~49.92 world px.
8. RUN speed is 165 + `(mag-WALK_MAX)*28`; at full keyboard magnitude 1.0 this is ~172.28 px/s, therefore the same 0.520 s visual cycle covers ~89.59 world px.
9. RUN therefore represents ~1.795× the world distance per visual cycle as WALK while using the same poses/cadence.
10. `VISUAL_STOP_HOLD_SEC=0.075` is only ~57.7% of one pose interval. If frame elapsed at release is modeled as uniformly distributed, roughly 57.7% of releases can cross one frame boundary during hold and ~42.3% cannot; actual runtime distribution must be measured. Crossing a boundary is not equivalent to reaching a valid foot-contact frame.
11. On visual stop, V5.36 resets `v.frame=0`; the code comment calls frame 0 a contact frame, but neither `assets/README.md` nor current repo metadata documents semantic contact frames for `hero.PNG`. Therefore “frame 0 = contact” is an unverified assumption for the current 4×4 art.
12. `engine-ac.js` preserves the same `frame` across a gait change, which is better than resetting, but WALK/RUN still share one row/timing in `engine-ab.js`; no gait-specific stride contract exists yet.
13. Keyboard still resolves to full normalized magnitude, so keyboard locomotion is effectively RUN whenever movement keys are held; touch can produce analog WALK.
14. Collider remains independent at radius 20 in `engine-a.js`; no reason exists to enlarge it for the visual work.
15. `ENGINE_MAP.md` remains stale: V5.15/v66 and hero owner `engine-m.js`, despite current effective sprite renderer being `engine-ab.js`.
16. `assets/README.md` only lists filenames and contains no frame dimensions, pivots, rows, contact metadata or stride metadata.

### EXTERNAL_EVIDENCE

1. MDN documents that `requestAnimationFrame()` generally tracks display refresh rate, including 60/75/120/144 Hz, and warns animation progress must be based on elapsed time rather than callback count. V5.36 now satisfies the render-count part for local locomotion, but elapsed time alone does not solve foot sliding when movement speed changes.
2. Community animation practice consistently identifies foot slide as a mismatch between the displacement implied by an animation and the character's actual world speed. A common remedy is to measure foot-contact travel and scale animation playback to movement speed, or author separate walk/run cycles for their intended speeds.
3. Recent community feedback on 2D/2.5D run cycles continues to identify visible sliding specifically when animation cannot keep up with actual distance traveled. This supports treating distance matching as the next measurable problem rather than adding cosmetic bob first.
4. Counterevidence: pure distance matching can look mechanical during acceleration, stop and very small analog input if every tiny displacement drives pose progression. Therefore phase should be distance-driven while locomoting, with explicit bounded start/stop/contact transition policy rather than no temporal policy at all.

### HYPOTHESIS

Kelo's lateral motion will look more planted if the local visual locomotion state changes from discrete time-frame ownership to a normalized continuous stride phase `phase01`, advanced primarily by actual planar world displacement divided by gait-specific measured `strideWorldPx`. WALK and RUN preserve homologous phase when crossing gait thresholds, but use distinct stride lengths/assets. Stop should resolve to a declared contact phase from the asset manifest within a short bounded time/distance window, rather than merely waiting 75 ms and resetting to frame 0. Reversal should preserve phase/contact-foot semantics while physical direction changes immediately.

### PROPOSED_CHANGE

**P1 — Keep the V5.36 render-pure architecture**
- Do not move phase state back into `renderAvatar()`.
- Repeated draws of one simulation state must keep `phaseDeltaOnDuplicateRender=0`.

**P2 — Replace local `frame/frameElapsed` ownership with continuous `phase01`**
- During locomotion, accumulate actual planar displacement after physics: `dist = hypot(p.x-lastX,p.y-lastY)`.
- Advance `phase01 = (phase01 + dist/strideWorldPx[gait]) % 1`.
- Derive frame index from phase only at render/sample time: current 4-frame fallback `floor(phase01*4)`; future lateral V2 `floor(phase01*8)`.
- Do not invent final stride values before measuring the artwork.

**P3 — Separate WALK and RUN stride contracts**
- The future `hero-side-v2` manifest should declare at least `walk.strideWorldPx`, `run.strideWorldPx`, and semantic contact phases/frames.
- Preserve normalized `phase01` when WALK↔RUN changes so homologous CONTACT/DOWN/PASSING/UP states remain aligned.
- Do not simply run the same 8-frame art faster if WALK and RUN silhouettes are materially different.

**P4 — Contact-bounded stop instead of fixed 75 ms reset**
- On input release, physical hard-stop policy stays unchanged for this experiment.
- Visual state determines nearest valid contact phase (for proposed 8-frame rows contacts at phase 0.0 and 0.5, corresponding to frames 0 and 4 only after asset verification).
- Resolve toward that contact with a short max duration guard; candidate guard remains 50–100 ms for A/B only.
- If already sufficiently near contact, enter idle immediately.
- Never call current `hero.PNG` frame 0 a contact frame without inspecting/annotating it.

**P5 — Reversal with phase preservation**
- R↔L changes physical direction immediately.
- Mirror/change face family without resetting `phase01`.
- A/B an optional contact clamp only if `reversalPosePopCount` remains high.

**P6 — Diagonal hysteresis after phase migration**
- Keep the current side-vs-vertical threshold as baseline.
- Add hysteresis separately; do not combine it with stride calibration in the first measurement.

**P7 — Asset contract before scale-up**
- Production lateral V2: true alpha, 128×192 cells, 8 WALK RIGHT + 8 RUN RIGHT, fixed foot pivot `(64,176)`, safe padding, no baked shadow, no labels.
- Contact frames `[0,4]` are a desired authored contract, not a claim about the current generated draft or current `hero.PNG`.
- Add manifest metadata before integrating.
- Only after phase/contact test passes, evaluate render-only visualScale 1.15/1.25/1.30; collider stays 20.

**P8 — Keep legacy NPC fallback isolated**
- Current `engine-ab.js` still mutates `_walkHold/_lx/_ly` for actors without `_visualMotion`.
- Do not refactor bots in the same first local-player experiment. Measure bot render duplication separately, then migrate them to the same visual-state model if safe.

### DO_NOT_ASSUME

- Do not assume V5.36 is visually verified; it was code-reviewed but no moving Pages clip/trace has yet proved stop quality.
- Do not treat 75 ms as a contact transition merely because it is time-based.
- Do not declare current frame 0 a planted-foot frame without asset evidence.
- Do not hard-code 49.92 or 89.59 as desired stride lengths; they are measurements of the current time-based mismatch, not target art values.
- Do not alter physical speed, hard stop, collider, camera or collision in the same stride-phase experiment.
- Do not add bob/lean before foot-slip baseline; cosmetic motion can conceal rather than solve cadence mismatch.
- Do not delete `engine-i` redraw until layer equivalence is proven.
- Do not migrate Canvas2D/WebGL/Pixi merely to implement phase/pivots.

### EXPERIMENT

1. Baseline V5.36/v87 on current 4-frame art.
2. Trace keyboard RIGHT RUN 3s and analog RIGHT WALK 3s; record dt, world displacement, gait, phase/frame, release moment, idle-enter moment and camera position.
3. Measure actual `worldPxPerCycle` and `poseChangesPer100WorldPx` for both gaits.
4. Instrument release phase and whether the 75 ms hold crosses a pose boundary; correlate with visible stop pop from video.
5. Add `phase01` distance accumulation behind a flag while preserving all physics.
6. Use provisional stride values only to establish the mechanism, then calibrate from annotated foot-contact artwork/video; rerun exact trace.
7. Verify WALK↔RUN threshold crossing preserves phase and does not pop.
8. Run RIGHT 1s → immediate LEFT 1s reversals repeatedly; compare preserve-phase vs optional contact-clamp.
9. Integrate the clean 8+8 lateral asset/manifest only after the mechanism is stable.
10. Re-run at 60/90/120 Hz or best available display/emulation; distance-based phase should produce equivalent cycles per world distance.
11. Finally test 1.15/1.25/1.30 visual scale with collider fixed 20, actor crossing, doorway, nameplate and shimmer inspection.

### DECIDING_METRICS

- `worldPxPerCycleWalk`
- `worldPxPerCycleRun`
- `worldPxPerCycleRatio`
- `poseChangesPer100WorldPx`
- `phaseDeltaOnDuplicateRender` target 0
- `releasePhase01`
- `releaseCrossedPoseBoundaryDuringHold`
- `releaseToVisualIdleMs`
- `stopPosePopCount`
- `walkRunTransitionPosePopCount`
- `reversalPosePopCount`
- `footSlipPxPerContact`
- `footAnchorScreenJitterP95`
- `cyclesPer100WorldPxVarianceAcrossHz`
- `collisionOutcomeDiffCount` target 0
- `colliderRadiusBeforeAfter` target 20→20
- `nameplateOverlapRate`
- `actorDepthOrderErrorCount`
- `spriteEdgeShimmerCount`
- `frameTimeP95/P99`

### RISKS

- Distance-based phase can stall while pushing against a wall; that may be correct for planted feet or may require a bounded intent fallback depending on desired animation style.
- Very small analog movement can produce excessively slow pose changes; use gait/intent rules rather than forcing a minimum animation speed blindly.
- Teleports/dash can create huge displacement deltas; visual stride accumulation must ignore or classify discontinuities so a 140 px dash does not spin walk frames unexpectedly.
- The current 4-frame art may not contain reliable contact semantics; mechanism testing can proceed, but final foot-slip decisions require the clean 8-frame asset.
- Phase preservation across mirrored LEFT/RIGHT assumes symmetric contact semantics; asymmetric clothing/accessories may later require authored left frames.
- Larger sprites will magnify any residual pose pop, depth bug or sampling shimmer.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1-P8 and report:
- exact commit/Pages build tested;
- whether V5.36 local phase is indeed stable under duplicate renders at runtime;
- measured `worldPxPerCycle` WALK/RUN and current stop-boundary behavior;
- whether `phase01 += dist/strideWorldPx` is viable in the existing `engine-ac` wrapper without creating another owner;
- how dash/teleport/wall-push discontinuities should be gated;
- A/B traces for time-based vs distance-based local phase;
- stop pop counts with current 75 ms reset vs contact-bounded stop;
- WALK↔RUN and reversal phase continuity results;
- whether a clean 8+8 asset with trustworthy pivot/contact metadata is available;
- exact collider equality and collision trace evidence;
- any proposal rejected/deferred and why;
- commits/tests/video/trace evidence if implementation occurs.

---

## CG-20260901-011 — Aspect-correct lateral scale, foot-pivot contract, and depth gate on current V5.39/V5.40 render stack

ID: CG-20260901-011
TIMESTAMP: 2026-09-01T08:38:37-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 81d08dd46536375134f92830a1fdc430d519e6b6
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,camera,collision,60hz,90hz,120hz,benchmark,canvas2d,atlas,textures,architecture,hd2d
AFFECTED_FILES: engine-l.js, engine-i.js, engine-ab.js, engine-ac.js, engine-ah.js, engine-a.js, assets/hero.PNG, assets/README.md, ENGINE_MAP.md, scripts/live-audit.mjs, index.html
RESPONDS_TO: CG-20260901-005, CG-20260901-010; current user priority lateral movement + larger premium avatar; code changes after V5.36

### PROBLEM

The repo has changed materially since the V5.36 locomotion-state implementation and CG-010. The next useful step is not merely to connect an 8+8 lateral atlas. Current V5.39/V5.40 rendering creates three coupled risks for a larger hero: (1) the lateral sprite is currently drawn with a distorted aspect ratio, making the side silhouette artificially thin; (2) the effective PNG path has no grounded shadow; and (3) plaza props are flattened into one layer drawn entirely before actors, so every avatar is always visually in front of trees/columns/benches/fountain regardless of foot Y. Increasing visual size will magnify these issues even if collision remains correct.

### CONFIRMED_IN_GEMINI

At current `main` base commit `81d08dd46536375134f92830a1fdc430d519e6b6`:

1. `index.html` is `Kelo World — V5.39` and loads engines with cache `v=90`.
2. `engine-l.js` advertises `KELO_PLAZA_AUDIT.version='V5.40'` and loads `assets/tileset.png?v=91`. Build metadata is therefore already split across V5.39/v90 and V5.40/v91 internal plaza audit state; measurements must record exact source/asset identity rather than assume one version string is the whole build.
3. `engine-i.js` is now intentionally empty. Any previous recommendation specifically targeting an `engine-i` actor redraw is obsolete.
4. The duplicate/second actor pass now lives in `engine-l.js`: it calls the previous `render()`, then draws `floorLayer`, then `propLayer`, then redraws all simulated players and the local player through `renderAvatar()`.
5. The local player's `_visualMotion` remains update-side in `engine-ac.js`, so repeated local draws do not consume local frame state. That V5.36 architecture remains valuable.
6. NPCs without `_visualMotion` still go through `engine-ab.js::legacyMovingOf()`, which mutates `_lx/_ly/_walkHold` during rendering. Therefore duplicate actor draws can still alter NPC visual-state lifetime even though the local player is protected.
7. `engine-ac.js` still advances local animation with fixed `VISUAL_FRAME_SEC=0.130` and fixed 4-frame phase timing; CG-010's proposed distance-matched `phase01` is not implemented in current main.
8. `engine-ab.js` still uses the existing 4x4 `assets/hero.PNG`, with lateral destination width `48` and destination height approximately `81` for the documented 2:3 source-frame aspect.
9. A 2:3 frame drawn at 48x81 has destination aspect 48/81=0.59259 while the authored source aspect is 2/3=0.66667. Relative width is therefore compressed to 88.89% of an aspect-correct draw: an ~11.11% horizontal squeeze. This can directly make lateral poses look thinner and less planted even before changing animation timing.
10. An aspect-correct baseline at the same 81px height is 54x81. Therefore simply testing 54x81 versus current 48x81 is a clean silhouette experiment with no height, collider, physics, camera or stride change.
11. `engine-ab.js` overrides `renderAvatar()` and, once its sheet is ready, does not call the base renderer. The base `engine-a.js` ellipse ground shadow is therefore absent from the effective PNG avatar path.
12. `engine-ah.js` still documents that the previous bob implementation was removed because it moved shadow+sprite together and caused floating. Any restored shadow/bob contract must keep the shadow/root fixed and move only the body artwork above it.
13. `engine-l.js` bakes trees, columns, benches, fountain, bushes, lamps and other decorative props into one `propLayer`, draws that complete layer before avatars, then draws every avatar above it. There is no per-prop Y-depth relationship with actor foot position in this plaza path.
14. Base `engine-a.js` also renders simulated players before the local player rather than globally Y-sorting all actors, so actor-vs-actor depth can be wrong when the local player crosses above another character.
15. Collider remains `localPlayer.radius=20` and circle-vs-AABB collision uses this logical radius, independent of PNG destination size. Visual scaling still does not require a collider change.
16. `engine-ab.js` uses `footY=p.y+10` as an approximate root and computes the sprite destination from whole destination width/height, not from an authored per-frame pivot.
17. `engine-ab.js` still performs near-white color-key alpha cleanup (`RGB >232 => alpha 0`) on the current sheet. A new true-alpha asset should bypass this cleanup or white/gold highlights can be damaged.
18. `assets/` in current main contains `hero.PNG`, `plaza.PNG`, `tileset.png` and a minimal README. There is no committed `hero-side-v2.png` or manifest in current main.
19. `assets/README.md` does not document frame size, rows, pivot, contact frames, stride metadata, alpha rules or sampling rules.
20. `scripts/live-audit.mjs` now provides a useful mobile Chromium/DPR2 production-tileset gate, but it does not move the hero, inspect avatar frame/pivot/shadow/depth, test LEFT/RIGHT reversals or measure 60/90/120Hz locomotion. It is not yet a movement-quality benchmark.
21. `ENGINE_MAP.md` remains materially stale: it still says V5.15/v66, identifies `engine-i` as the plaza redraw danger and names `engine-m.js` as hero sprite owner. Current `engine-i` is empty, current second actor pass is in `engine-l`, current `engine-m` is skill/projectile logic, and current PNG hero override is `engine-ab`.

### EXTERNAL_EVIDENCE

1. MDN `CanvasRenderingContext2D.imageSmoothingEnabled` documents that disabling smoothing is useful to keep pixel-art edges sharp when scaled. It does not promise ideal quality for arbitrary non-integer downscales, so Kelo should still A/B the actual atlas at its final destination sizes: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
2. MDN `requestAnimationFrame()` explicitly warns to use elapsed time/timestamps because display refresh commonly includes 60/75/120/144Hz. This continues to support update-side/time-or-distance-normalized locomotion instead of render-count stepping: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
3. PixiJS documentation distinguishes an authored sprite anchor/pivot from scale and position. Kelo does not need Pixi, but the same geometry applies directly in Canvas2D: map an authored foot pivot to one stable world foot root, then scale the artwork around that mapping: https://pixijs.com/7.x/guides/components/sprites
4. PixiJS issue #6676 and Godot proposal #6995 provide counterevidence to the idea that nearest filtering automatically solves pixel-art presentation. Subpixel positioning/non-integer scale can still produce seams, distortion or jitter, so final scaling must be tested while moving and zooming, not only in a still frame: https://github.com/pixijs/pixijs/issues/6676 and https://github.com/godotengine/godot-proposals/issues/6995
5. W3C CSSWG issue #5837 specifically discusses distortion from nearest-neighbor-like pixelated rendering at non-integer scaling factors. This supports using aspect-correct integer destination dimensions as one A/B candidate rather than arbitrary fractional destination sizes: https://github.com/w3c/csswg-drafts/issues/5837
6. Gamedev community foot-slide guidance consistently recommends matching animation cadence to the distance implied by foot contacts; one highly upvoted answer describes choosing a target character speed and authoring/synchronizing the run to that speed. This supports CG-010's distance-phase direction after the asset is semantically validated: https://www.reddit.com/r/gamedev/comments/wofi7p
7. 2D game-development community practice commonly keeps a blob/contact shadow as a separate object anchored at the character base/feet. This aligns with engine-ah's historical failure: shadow root stays fixed while body animation can move above it: https://www.reddit.com/r/godot/comments/pnef19

### HYPOTHESIS

Before increasing Kelo to an arbitrary 1.25x, the first lateral presentation win may come from removing the current 11.11% side-width distortion. Use an authored foot-pivot contract for the future 128x192 lateral atlas, then test aspect-correct integer destination sizes while collider remains 20. The scale experiment should be gated by depth/occlusion evidence because the current flattened plaza prop layer guarantees all avatars render above all props. A larger sprite without correcting/partitioning depth will look more wrong even if the sprite itself is better.

For a proposed 128x192 cell with desired pivot `(64,176)`, define one uniform display scale and map the pivot to the world foot root rather than assuming bottom-center:

`scaleX = drawW / 128`
`scaleY = drawH / 192`
`drawX = footX - 64 * scaleX`
`drawY = footY - 176 * scaleY`

For aspect-preserving output require `drawH = 1.5 * drawW` and preferably integer destination dimensions. Starting candidates around the current 54x81 aspect-correct baseline are:

- 54x81 = 1.000 canonical aspect-correct baseline;
- 62x93 = 1.148x canonical;
- 68x102 = 1.259x canonical (closest integer 2:3 pair to nominal 1.25x);
- 70x105 = 1.296x canonical.

These are geometric test candidates, not shipped values. Note that relative to today's 48px side width, even 54x81 already increases lateral body width by 12.5% while keeping height unchanged.

### PROPOSED_CHANGE

**P1 — Extend the current live audit before visual promotion**
- Reuse `scripts/live-audit.mjs` but add a movement-quality mode rather than creating another unrelated harness.
- Trace RIGHT keyboard/run, LEFT, analog/touch walk, R↔L reversal, diagonal and stop.
- Capture logical x/y, gait, `_visualMotion.frame/phase`, face, camera x/y, collider radius, draw destination bounds and actor draw count.
- Add desktop and mobile viewports; record available refresh/timing rather than pretending a headless DPR2 mobile context proves 120Hz hardware.

**P2 — Validate the 8+8 asset as data before integration**
- The desired production contract remains 1024x384 overall, 8x2 cells, 128x192 each, true alpha, WALK RIGHT row 0, RUN RIGHT row 1, no baked shadow/text/grid.
- Do NOT trust dimensions/transparency alone. Validate per-cell alpha bounds, edge touching/cross-cell bleed, frame uniqueness, consistent authored foot pivot and actual contact-frame semantics.
- Desired pivot `(64,176)` and contacts `[0,4]` must be visually/semantically verified; a post-resize generated PNG is not automatically correct just because its pixel dimensions match.
- Store the verified contract in a small manifest rather than hard-coded magic numbers.

**P3 — Remove lateral aspect distortion before global enlargement**
- Baseline A: current 48x81.
- Candidate B: 54x81 with all other behavior identical.
- Compare perceived body mass, edge quality, foot placement and actor/door occlusion.
- If 54x81 is clearly better without regressions, use it as the canonical visualScale=1 baseline for the new lateral asset.

**P4 — Pivot-rooted scale matrix**
- After P2/P3, test 54x81, 62x93, 68x102 and 70x105 using the authored pivot mapping equations above.
- Collider radius remains exactly 20.
- The logical/world foot root remains `p.x` plus the chosen fixed foot-Y contract; do not resize or move physics to match artwork.
- Body bob/lean, if later added, is an offset/rotation around the body relative to the foot root, never a mutation of logical `p.y`.

**P5 — Restore a separate contact shadow**
- Add a presentation-only ellipse/blob shadow under the effective PNG path, centered on the stable foot root.
- Start static during the scale experiment. Do not phase-pulse it until foot planting is stable.
- Measure draw count so the current second actor pass does not accidentally make visible shadow opacity darker through duplicate compositing.

**P6 — Treat plaza depth as a hard scale gate**
- Current monolithic `propLayer` means every avatar is always in front of every prop. Instrument crossings around tree/column/fountain/bench before promoting larger size.
- Do not blindly global-Y-sort the entire game.
- Minimal prototype should split truly depthable props from floor decoration and assign each depthable prop a `sortY`/footline. Compose actors and those props by Y only inside the relevant plaza layer.
- Baseline → depth prototype → identical crossing traces → compare screenshots/frame time.
- If a simpler back/front split matches the art, compare it against full Y-sort; choose the least complex layer model that fixes observed occlusion.

**P7 — Actor-vs-actor depth check**
- Base render draws simulated players then local player. Run two crossing directions and count impossible overlaps.
- If scaling magnifies errors, test sorting actor presentation by stable footY. Do not change simulation order or collision.

**P8 — Apply CG-010 distance phase only after asset semantics are trustworthy**
- Keep the V5.36 update-side state.
- Migrate fixed 130ms frame stepping to `phase01 += distance/strideWorldPx[gait]` only after contact frames/stride are annotated.
- Preserve phase through WALK↔RUN and R↔L; keep hard physical stop unchanged for the first experiment.
- Gate dash/teleport discontinuities so large jumps do not spin locomotion phase.

**P9 — Migrate NPC presentation separately**
- If all characters are enlarged, NPCs must eventually leave `legacyMovingOf()` because it is render-mutable under the `engine-l` second pass.
- Do not combine NPC state migration with the first local hero asset integration. Measure local path first, then reproduce the same state model for bots using their own movement intent/target data rather than global player input.

**P10 — Sampling A/B while moving**
- For the verified 128x192 source cells at each destination pair, compare smoothing off versus a prefiltered/offline derivative where useful.
- Do not rely on `imageSmoothingQuality` as a universal production contract because browser support remains incomplete.
- Inspect edge shimmer and facial/clothing readability on mobile Chromium and, when accessible, iOS Safari.

### DO_NOT_ASSUME

- Do not assume removing `engine-i` solved duplicate actor drawing; the second pass moved to `engine-l`.
- Do not assume the future/generated `hero-side-v2.png` is production-valid until pivot/contact/bleed are audited frame by frame.
- Do not assume `64,176` and contact frames `[0,4]` are facts about any generated file; they are the desired contract until verified.
- Do not enlarge collider radius from 20.
- Do not keep current 48x81 lateral proportions by inertia; they distort a 2:3 source frame horizontally.
- Do not add dynamic bob before foot cadence/pivot are stable.
- Do not bake the shadow into the atlas.
- Do not use current near-white alpha deletion on a true-alpha asset without explicit need.
- Do not globally Y-sort buildings/UI/effects as a blind fix; first isolate observed depthable objects.
- Do not claim 60/90/120Hz equivalence from a single headless mobile run.
- Do not migrate Canvas2D to WebGL/Pixi merely for pivots or this scale experiment.

### EXPERIMENT

1. Baseline current V5.39/v90 at commit `81d08dd...`; record engine-l audit/tileset identity as well.
2. Same trace: idle 1s → RIGHT run 3s → stop → LEFT run 3s → R↔L reversals → diagonal → tree/column/fountain/bench crossing → NPC crossing → doorway/building edge.
3. Record collision radius/outcomes, avatar draw count, destination bounds, screen foot root, camera delta, gait/frame and prop/actor depth errors.
4. A/B current 48x81 vs aspect-correct 54x81 only. No other behavioral change.
5. Validate the proposed 8+8 atlas and manifest independently. Reject/repair asset if pivot/contact/bleed checks fail.
6. Integrate the verified atlas behind fallback with the same 54x81 footprint first; rerun the exact trace.
7. Apply the CG-010 distance-phase mechanism and calibrate stride from authored contact travel; rerun.
8. Test 62x93, 68x102 and 70x105, collider fixed 20.
9. For each size, repeat plaza prop and NPC crossing. If depth errors increase, prototype depthable-prop sorting/back-front partition and rerun the same trace before choosing scale.
10. Add a fixed foot-root shadow and rerun to compare groundedness without dynamic bob.
11. Compare smoothing/prefilter candidates while moving, including mobile DPR2 audit and available desktop/iOS evidence.
12. Only promote a scale after collision equality, depth, nameplate, sampling and frame-time gates pass.

### DECIDING_METRICS

- `sideAspectRatioBeforeAfter` (0.59259 → target 0.66667 for aspect-correct cells)
- `sideHorizontalCompressionPct` baseline ~11.11%
- `drawW/drawH`
- `pivotScreenErrorPx`
- `opaquePixelsBelowDeclaredPivot`
- `cellEdgeTouchCount`
- `crossCellBleedCount`
- `duplicateFrameHashCount`
- `contactFrameVerified`
- `renderAvatarCallsPerActorPerRAF`
- `shadowVisibleCompositeCountPerActor`
- `footSlipPxPerContact`
- `footAnchorScreenJitterP95`
- `worldPxPerCycleWalk/Run`
- `reversalPosePopCount`
- `walkRunTransitionPosePopCount`
- `propDepthOrderErrorCount`
- `actorDepthOrderErrorCount`
- `nameplateOverlapRate`
- `avatarOcclusionRate`
- `collisionOutcomeDiffCount` target 0 for presentation-only stages
- `colliderRadiusBeforeAfter` target 20→20
- `spriteEdgeShimmerCount`
- `frameTimeP95/P99`
- decoded lateral-atlas memory: a 1024x384 RGBA atlas is ~1.5 MiB before browser/GPU overhead; record actual resource/memory evidence when available

### RISKS

- Correcting aspect ratio can make the hero feel wider before the new artwork is present; that is why 48x81→54x81 is an isolated A/B, not an automatic ship.
- A generated/postprocessed 8+8 sheet can satisfy dimensions yet have drifting feet, inconsistent margins, duplicate poses or cropped limbs; mechanical PNG validation cannot prove contact semantics alone.
- A larger avatar will expose the current monolithic prop-layer depth model much more strongly.
- A contact shadow may double-darken if future layer changes make both actor passes visible; measure visible compositing, not just function calls.
- Integer destination dimensions do not guarantee artifact-free sampling when source-to-destination scale is fractional.
- Full Y-sort of large static layers can add complexity and CPU work unnecessarily; a small depthable-prop list or front/back partition may be superior.
- Local and NPC presentation ownership currently differ; changing both at once would make regression attribution difficult.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1-P10 and report:
- exact current main/Pages/build/audit identity tested;
- whether the second actor pass is confirmed in `engine-l` at runtime and whether both passes are visibly composited;
- measured 48x81 vs 54x81 result with no physics change;
- verified actual dimensions/pivot/contact/alpha/bleed status of any candidate 8+8 lateral asset committed for testing;
- whether aspect-correct integer destination pairs improve lateral silhouette/sampling;
- shadow grounding A/B and duplicate-composite evidence;
- tree/column/fountain/bench and NPC crossing depth errors at each tested scale;
- whether a back/front split or per-prop Y-sort is the smaller viable depth fix;
- distance-phase results after asset semantics are verified;
- collider equality and collision-trace equality;
- frame-time/sampling/nameplate results on desktop/mobile and any iOS evidence;
- any proposal rejected or deferred and why;
- exact commits/tests/screenshots/traces for any implementation.

---

## CG-20260901-012 — Foot-root depth sorting, prop collision separation, and production atlas validation before avatar scale-up

ID: CG-20260901-012
TIMESTAMP: 2026-09-01T09:36:33-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 2706ed1c7c3183f8990b56e4a6e5f052724a915c
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,collision,shadow,canvas2d,atlas,textures,benchmark,architecture,culling,memory,60hz,90hz,120hz
AFFECTED_FILES: engine-l.js, engine-ab.js, engine-ac.js, engine-a.js, engine-h.js, engine-v.js, engine-z.js, ENGINE_MAP.md, scripts/live-audit.mjs, assets/hero.PNG, future assets/hero-side-v2.png
RESPONDS_TO: CG-20260901-008, CG-20260901-009, CG-20260901-010, CG-20260901-011; current user priority lateral premium motion + larger visual avatar without collision/camera/occlusion/FPS regressions

### PROBLEM

The next scale-up cannot be treated as a sprite-size-only change. Current main has three coupled presentation problems that become more visible as the avatar gets larger: (1) plaza props are baked into one `propLayer` and always drawn before actors, so a character is always visually in front of trees/columns/fountain/benches regardless of foot Y; (2) `engine-l.js` removes every obstacle overlapping the plaza and does not add equivalent collision geometry for its new props, so the rendered fountain/trees/columns are currently visual-only; (3) the current lateral production candidate generated outside the repo is dimensionally 1024x384/8x2, but a cell-level alpha audit shows clipping/bleed, so dimensions alone are not sufficient proof that an atlas is usable.

There is also still renderer duplication: `engine-l` calls the previous `render()`, whose base path already draws NPCs and localPlayer, then draws floor/props and redraws all actors. Local player locomotion is render-pure after CG-009 implementation, but NPC fallback state in `engine-ab` still mutates during render. This is a measured code redundancy/risk, not a reason for a blind refactor.

### CONFIRMED_IN_GEMINI

At current `main` base `2706ed1c7c3183f8990b56e4a6e5f052724a915c`:

1. `index.html` is Kelo World V5.39 and loads engine scripts with `?v=90`.
2. `engine-l.js` advertises `KELO_PLAZA_AUDIT.version='V5.40'` and loads `assets/tileset.png?v=91`; build/cache labels are therefore temporarily out of sync.
3. `engine-l.js` removes all entries in global `obstacles` that overlap PLAZA `{x:1040,y:1240,w:800,h:560}` through `inPlaza()` + splice loop.
4. `engine-l.js` does not subsequently add collision rectangles/circles for its fountain, trees, columns, benches, lamps, bushes, planters or flowerbeds. Those new atlas props are visual-only in current main.
5. Atlas prop placements are baked into one `propLayer`: 1 fountain, 4 columns, 4 trees, 6 bush/planter placements, 2 benches, 2 flowerbeds and 2 lamps = 21 placed prop sprites/groups before tiling.
6. Final plaza render order is `_r()` -> `floorLayer` -> `propLayer` -> simulatedPlayers -> localPlayer. Since base `_r()` already renders NPCs/local player, actors are drawn at least twice in the final renderer stack.
7. Because the complete `propLayer` is before the final actor pass, actor-vs-prop depth is not Y-sorted. A player at a smaller screen/world Y than a tree base is still drawn on top of that tree in the final pass.
8. `engine-ab.js` still uses `footY = p.y + 10`; that is the best current semantic depth/root key for the PNG character, and it is independent of collider radius.
9. `engine-ab.js` draws the current side sprite at 48x81 while front/back use 54x81; with the current source frame ratio near 2:3, the side image is visibly compressed horizontally relative to a 54x81 aspect-correct baseline.
10. `engine-ab.js` PNG override does not draw the base renderer's contact shadow. The base `engine-a.js::renderAvatar()` does have an ellipse at approximately `(p.x,p.y+14)` with radii derived from `p.radius`, but that path is bypassed when `engine-ab` successfully draws the PNG.
11. Collider remains `localPlayer.radius=20` in `engine-a.js`; visual scaling does not require changing it.
12. `engine-v.js` is intentionally identity/empty because scale has been absorbed into `engine-ab` draw size to keep feet planted.
13. `engine-ac.js` now owns local visual locomotion state and uses elapsed `dt`, but frame cadence is still a fixed 0.130 s and 4-frame cycle; it is not yet distance/stride driven and does not yet implement 8-frame walk/run semantic contact mapping.
14. `engine-z.js` computes zoom from visible tile count and clamps to 1.05–1.45; it also reduces lookAheadDist. `engine-t.js` executes earlier and clamps zoom to <=1.05, but `engine-z` later recalculates it, so current final zoom ownership is effectively engine-z despite stale ENGINE_MAP ambiguity.
15. `engine-h.js` and `engine-l.js` both manipulate HiDPI/context smoothing state. `engine-ab` explicitly disables smoothing around hero draw, which protects current sprite sharpness, but this layered ownership should be included in visual regression tests.
16. `ENGINE_MAP.md` is stale: it still lists `engine-m.js` as Hero sprite owner and describes old `engine-i.js` plaza repaint behavior, while `engine-i.js` is now intentionally empty and active PNG hero override is `engine-ab.js`.
17. `scripts/live-audit.mjs` currently validates live V5.39 mobile load/tileset/HiDPI flags and screenshot, but does not trace lateral locomotion, depth order, prop collision, sprite pivots, atlas cell bleed, 60/90/120 Hz cadence or avatar scale variants.
18. `assets/` in main contains `hero.PNG`, `tileset.png`, `plaza.PNG`, README; no `hero-side-v2.png` is present in Gemini yet.

### EXTERNAL_EVIDENCE

1. MDN states `requestAnimationFrame()` generally follows display refresh rate (commonly 60 Hz, with 75/120/144 Hz also widespread) and explicitly warns to calculate animation progress from elapsed time rather than frame count. This continues to support dt/distance-driven phase rather than refresh-driven cadence.
2. MDN documents `CanvasRenderingContext2D.imageSmoothingEnabled=false` as the standard way to preserve hard pixel-art edges during scaling, but MDN's pixel-art guidance also notes that CSS/device-pixel misalignment and non-integer DPR/zoom can produce uneven pixel sizes. Crisp nearest-neighbor is therefore necessary but not sufficient for stable motion.
3. W3C CSSWG issue #5837 documents distortion risk for pixel-art nearest-neighbor scaling at non-integer scale factors; PixiJS issue #6676 reports visible gaps/artifacts at certain positions even with nearest scaling. This is counterevidence to assuming arbitrary 1.25x scaling will look clean merely because smoothing is disabled.
4. PixiJS official docs separate anchor/pivot from scale/position and make clear that a stable pivot can remain the semantic origin while texture size changes. This supports keeping Kelo's visual root at the feet and deriving visual bounds/nameplates around it rather than moving the collider.
5. PixiJS v8 container docs support zIndex/sorting but warn sorting should be used sparingly for large child counts. That is counterevidence to globally sorting every world object every frame.
6. Community top-down 2D guidance commonly uses the feet/bottom pivot as the Y-sort point and recommends keeping always-background objects static while only sorting occluder-capable objects with characters. A Reddit r/gamedev discussion specifically suggests a hybrid static/dynamic list, with bushes or irregular sprites moved into the dynamic sorted group when they must occlude actors.
7. Community foot-slide guidance consistently matches animation cycle/foot contact distance to movement speed; one r/gamedev thread describes measuring ground-contact travel distance and deriving animation speed from distance/frames/fps. This supports distance-driven phase for the upcoming 8-frame atlas rather than a fixed 130 ms frame duration.
8. Counterevidence: simple single-Y sorting fails on bridges, stairs, large/irregular objects and objects the player can enter. A 3x3 fountain can therefore require a special occlusion rule, footprint/region, or split sprite rather than blindly assigning one baseline to all cases.

### HYPOTHESIS

The safest premium scale-up is a hybrid scene-depth model centered on a stable foot root:

- Keep floor and non-occluding decorative tiles baked/cached.
- Represent only occluder-capable props as lightweight draw commands with a semantic base/depth Y.
- Merge those commands with actor draw commands and sort by `depthY`, where actors use `footY = p.y + 10` and normal props use their world base (`PLAZA.y + (gy+h)*TILE`, adjusted per asset if the visible base is above the tile bottom).
- Keep physical collision as a separate explicit dataset; visual bounds and depth must not be inferred from collider radius.
- Special-case complex footprints such as the fountain if simple base-Y produces wrong crossings.
- Add a small stable contact shadow anchored to `footY`, independent of animation bob and visual scale.
- Validate a sprite atlas mechanically before loading it: dimensions, alpha bounds per cell, edge-touch/bleed, required transparent padding, contact-foot coordinate variance and duplicate-frame similarity.

For the current plaza's ~21 prop placements, sorting only the occluder subset should be cheap in principle, while retaining most of the performance advantage of baked static layers. This performance conclusion remains a hypothesis until measured in the existing browser audit.

### PROPOSED_CHANGE

**P1 — Extend the existing audit before gameplay edits**
- Add reproducible keyboard lateral traces (RIGHT/LEFT/reversal/diagonal) and optional touch trace.
- Record player foot root, camera transform, draw order and collision outcomes.
- Add desktop + mobile contexts; emulate/measure 60 Hz baseline and use controlled dt injection or browser-supported cadence harness for 90/120 comparisons rather than claiming physical refresh hardware that CI does not have.

**P2 — Atlas validator**
- Add a script that rejects a future `hero-side-v2.png` unless dimensions/cell count are exact and every cell stays within safe transparent padding.
- Report per-frame alpha bounding box, top/left/right/bottom edge touches, bottom-most opaque Y, contact-foot X/Y estimate, frame similarity and bleed flags.
- Do not ship the locally generated candidate merely because it is 1024x384.

**P3 — Fix aspect ratio before global enlargement**
- A/B current lateral 48x81 against 54x81 only.
- Do not change height, collider, camera, speed, animation phase or shadow in this first A/B.
- Measure silhouette preference, edge shimmer and collision outcome equality.

**P4 — Restore contact shadow as a separate render primitive**
- Draw a small ellipse before the PNG sprite, centered on the foot root (`p.x`, `footY` plus tuned few-pixel offset).
- Shadow size may be tied to visual draw width, but its world anchor must not bob with frame artwork.
- Keep collider radius 20.

**P5 — Hybrid depth list in plaza final pass**
- Keep floorLayer static.
- Split prop rendering into background/non-occluding cached decorations and a small list of occluder draw commands.
- Build actor commands from NPCs + localPlayer.
- Stable-sort occluders + actors by semantic base Y; preserve a deterministic tie-breaker.
- Start with columns/trees/benches/lamps/bushes/planters. Test fountain separately because its 3x3 footprint can violate simple baseline assumptions.

**P6 — Explicit prop collision dataset**
- Do not derive collision boxes from sprite alpha bounds.
- Reintroduce only gameplay-meaningful collision shapes for solid plaza props, with smaller forgiving footprints than their visual crowns/tops.
- Fountain, columns and tree trunks are first candidates; benches/bushes should be tested for whether they improve feel or create navigation friction.
- Same baseline trace before/after; `collisionOutcomeDiffCount` is expected only at intentional prop contacts, not elsewhere.

**P7 — Distance-driven 8-frame phase after atlas passes validation**
- Store a normalized `phase01` or accumulated travel distance.
- Advance by world distance / authored stride length, not by render count or fixed 130 ms alone.
- Define semantic frames 0/4 as contact candidates only after inspecting the actual approved artwork.
- Walk/run should use separate stride lengths and preserve phase across gait transition/reversal where possible.

**P8 — Scale ladder only after P2-P7 baseline evidence**
- Compare aspect-correct 54x81, then integer-friendly approximately 62x93, 68x102 and 70x105.
- Derive `drawX/drawY` from a per-atlas foot pivot rather than center/bottom assumptions.
- Collider target remains 20->20.
- Nameplate Y should use visual top bound plus a fixed gap, while depth uses foot root; do not conflate the two.

**P9 — Renderer redundancy debt, benchmark before refactor**
- Instrument actor draw calls per RAF and NPC visual-state mutations.
- Do not remove `_r()` or rewrite the render stack until a baseline screenshot/trace is captured.
- If final-pass depth sorting is successful, design a later layer-owner cleanup that eliminates duplicate actor drawing while reproducing the same final frame and metrics.

### DO_NOT_ASSUME

- Do not assume `hero-side-v2.png` is valid because it is 1024x384; candidate cell content must be audited.
- Do not assume all edge touches are harmless. A frame touching left/right/top/bottom can indicate clipping or inter-cell bleed; inspect deliberately.
- Do not change collider radius when increasing visual scale.
- Do not use sprite alpha bounds as collision geometry.
- Do not sort the entire world every frame when only a small occluder subset needs actor-relative depth.
- Do not assume a single baseline Y solves fountain/bridge/stair-like overlap cases.
- Do not use bobbed head/top coordinates for depth.
- Do not tie shadow position to the animated frame's foot pixel; tie it to logical foot root.
- Do not remove duplicate render wrappers without baseline -> change -> same trace -> remeasurement.
- Do not claim 90/120 Hz hardware verification from a headless browser unless refresh cadence is actually measured/proven.

### EXPERIMENT

1. Baseline current V5.39/v90 (`2706ed1...`) on live Pages once deployed: capture mobile 390x844 DPR2 and desktop 1440x900.
2. Trace A: idle 1s -> RIGHT 2s -> release -> LEFT 2s -> rapid RIGHT/LEFT reversal x4 -> diagonal NE/SW.
3. Trace B: cross in front of/behind each plaza prop class at multiple Y positions: column, tree, bench, lamp, bush/planter, fountain.
4. Log current actor draw count/RAF, final depth ordering, collider radius, player/camera positions and FPS/frame-time distribution.
5. Atlas audit candidate before upload. A local audit of the current generated candidate (not present in Gemini) found exact 1024x384 RGBA, but WALK cells include border touches and RUN cells broadly touch both horizontal cell edges/top; therefore mark candidate NOT PRODUCTION-READY pending regeneration/repacking from independently framed source poses.
6. A/B lateral draw size 48x81 vs 54x81 only; rerun exact traces.
7. Add root-anchored shadow flag; rerun.
8. Add hybrid prop/actor depth list with no collision changes; rerun Trace B and compare `propDepthOrderErrorCount`.
9. Add explicit collision shapes behind a feature flag; rerun path/collision traces.
10. After a validated 8+8 atlas exists, compare fixed-time phase to distance-driven phase using the exact same physical trajectory.
11. Only then run scale ladder 54x81 -> ~62x93 -> ~68x102 -> ~70x105, keeping collider 20 and same traces.
12. Record screenshots/video/traces before deciding the production scale.

### DECIDING_METRICS

- `atlasCellEdgeTouchCount` target 0 for unintended left/right bleed; exceptions documented explicitly
- `atlasBottomFootVariancePx` target low/intentional around declared pivot
- `atlasFrameDuplicateSimilarity`
- `actorDrawCallsPerActorPerRAF`
- `npcRenderStateMutationCount`
- `footAnchorScreenJitterP95`
- `footSlipPxPerContact`
- `reversalPosePopCount`
- `walkRunTransitionPosePopCount`
- `propDepthOrderErrorCount` target 0 for simple occluders
- `fountainDepthOrderErrorCount` tracked separately
- `collisionOutcomeDiffCount` target 0 outside intentional new prop solids
- `colliderRadiusBeforeAfter` target 20->20
- `nameplateOverlapRate`
- `spriteEdgeShimmerCount`
- `cameraScreenDeltaVariance`
- `frameTimeP50/P95/P99`
- `longFrameCountOver16_7ms` desktop 60 Hz baseline
- heap/GC event count if the harness can expose it
- draw-call/sort-item count per frame
- visual preference clips at mobile/desktop and available refresh cadences

### RISKS

- Splitting every prop out of the cached layer could regress CPU/render cost; use a hybrid subset and benchmark.
- Sorting by base Y alone can fail for large or traversable objects such as fountain/bridges/stairs; special occlusion regions or split art may be required.
- Adding collisions to all decorative props can make movement frustrating; collision should follow gameplay footprint, not visual size.
- A larger sprite increases perceived occlusion and nameplate overlap even when physics is unchanged.
- Root-anchored shadow can look detached if art contact frames have large vertical inconsistencies; atlas validation and foot-root alignment must precede strong shadow styling.
- Non-integer zoom/DPR combinations can still shimmer with nearest-neighbor rendering; integer draw dimensions reduce one source of distortion but cannot guarantee pixel-perfect device alignment on every browser zoom/DPR.
- Existing double actor rendering can hide or confuse depth tests unless the final pass is instrumented; do not interpret screenshots without knowing which pass produced the visible pixels.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1-P9 and report:
- live commit/build actually deployed and exact cache/version observed;
- whether current plaza props are intentionally non-solid or missing collision ownership;
- baseline actor draw calls/RAF and any measurable NPC render-state mutation from duplicate passes;
- feasibility of splitting `propLayer` into static background + small occluder command list without adding another renderer owner;
- proposed semantic base Y for each prop class and which require special handling;
- whether fountain should be split/masked/region-sorted instead of simple Y-sort;
- atlas validator results on any candidate actually placed in the repo;
- 48x81 vs 54x81 A/B evidence before larger scaling;
- contact-shadow A/B evidence;
- depth/collision traces and FPS/frame-time before/after;
- exact commits/tests/screenshots/traces and any proposal rejected/deferred;
- whether ENGINE_MAP ownership should be corrected in the same verified cleanup or separately.

## CG-20260901-013 — Unify camera-space sampling before enlarging the lateral hero

ID: CG-20260901-013
TIMESTAMP: 2026-09-01T10:35:38-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 37ae2dcf639ba90b4d25609e9f40b9a600c9f8c1
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,camera,render,canvas2d,60hz,90hz,120hz,shadow,atlas,textures,benchmark,architecture
AFFECTED_FILES: engine-a.js, engine-h.js, engine-l.js, engine-z.js, engine-t.js, engine-ab.js, engine-ac.js, assets/hero.PNG, scripts/live-audit.mjs, ENGINE_MAP.md
RESPONDS_TO: CG-20260901-010, CG-20260901-011, CG-20260901-012; current user priority premium lateral movement and larger avatar

### PROBLEM

The current renderer has two different world-to-screen camera transforms in the same final render stack, while the hero renderer rounds sprite world coordinates before a fractional camera/zoom transform. This can create inconsistent sampling, camera-relative shimmer, and boundary discontinuities that will become more obvious when the lateral avatar is enlarged. Separately, engine-ab destructively converts every near-white RGB pixel in the hero source to transparent, which is unsafe for a production sprite containing legitimate white clothing/highlights. The current smoothing policy is also split between engine-h (smoothing true/high), engine-l (false), and engine-ab (temporarily false).

### CONFIRMED_IN_GEMINI

At main commit 37ae2dcf639ba90b4d25609e9f40b9a600c9f8c1:

1. `index.html` is V5.39 and loads engines with `?v=90`.
2. `engine-z.js` sets `CONFIG.zoom = clamp(screenW/(targetTiles*32), 1.05, 1.45)`, using 11 visible tiles on widths below 500 and 14 otherwise. It also caps look-ahead to 36.
3. `engine-t.js` runs before `engine-z.js` and caps zoom to <=1.05, but engine-z subsequently overwrites CONFIG.zoom, so engine-t is not the final zoom authority.
4. `engine-a.js::render()` computes `camX=camera.x-screenW/2`, `camY=camera.y-screenH/2` and translates by `(-camX,-camY)` without applying `CONFIG.zoom`.
5. `engine-l.js::render()` first calls the previous render, then draws the plaza and actors using a second transform: translate screen center -> scale(CONFIG.zoom) -> translate(-camera.x,-camera.y).
6. Therefore the base world and the engine-l plaza pass do not share one world-to-screen matrix. The opaque plaza floor usually hides the earlier base pass inside the plaza, but the coordinate systems remain different and can disagree at boundaries, on overlays, and on any object not covered by the plaza redraw.
7. With viewport 390 px, engine-z requests zoom ~= 390/(11*32)=1.108. With wide desktop viewports it can hit the 1.45 cap. Thus camera-relative distances in the plaza pass are multiplied by ~1.108 to 1.45 while the base pass remains 1.0.
8. `CONFIG.roundPixels` remains false in engine-a. Camera x/y are smoothed continuously with exponential damping and remain fractional in normal movement.
9. `engine-ab.js` rounds destination world coordinates with `Math.round(p.x-dw/2)` and `Math.round(footY-dh)` before they pass through the fractional camera/zoom transform in engine-l. Snapping world coordinates independently is not equivalent to snapping the final screen/device coordinate.
10. `engine-h.js` sets Canvas2D image smoothing true/high in resize and before its wrapped render. `engine-l.js` sets imageSmoothingEnabled=false in its plaza pass. `engine-ab.js` temporarily sets false for the sprite then restores the previous state. The final sampling policy therefore depends on wrapper context rather than an explicit per-asset contract.
11. `engine-ab.js` preprocesses `assets/hero.PNG` through getImageData and sets alpha=0 for any pixel where R,G,B are all >232. This is a broad white-key operation, not true-alpha handling.
12. The same engine-ab source frames are ~256x384 before padding and are drawn around 48/54 px wide and ~81 px tall, a strong downscale. Nearest-neighbor downscaling is therefore part of current hero quality, not only upscaling.
13. `engine-ac.js` still advances the current 4-frame locomotion state with elapsed time (`VISUAL_FRAME_SEC=0.130`) and keeps stop follow-through time-based (`0.075 s`). That fixed render-count issue remains improved, but stride is not yet distance/contact based.
14. `engine-l.js` still redraws actors after the base renderer; `ENGINE_MAP.md` remains stale about current hero ownership and old engine-i behavior.

### EXTERNAL_EVIDENCE

1. MDN `requestAnimationFrame()` states callbacks generally follow display refresh rate, including 60/75/120/144 Hz, and warns animation progress must be based on elapsed time rather than callback count. This supports retaining update-side locomotion timing and measuring at multiple refresh rates.
2. MDN documents `imageSmoothingEnabled=false` as useful for preserving hard pixel-art edges, but its crisp-pixel-art guidance also warns that non-integer source-to-canvas or CSS-to-device mappings can create uneven/distorted pixels, especially at fractional DPR/page zoom.
3. MDN `devicePixelRatio` guidance recommends sizing the backing canvas to physical pixel density and normalizing drawing coordinates; it also notes DPR can be fractional and change with page zoom/display configuration.
4. MDN WebGL best practices specifically warns non-integer DPR can create moire artifacts and discusses pre-snapping to whole device coordinates. Although that page targets WebGL, the underlying device-pixel mapping issue is directly relevant to Canvas2D camera/sprite sampling.
5. PixiJS documentation supports sorting only where needed because per-frame sorting can be expensive at scale; this remains compatible with the prior proposed hybrid depth list rather than sorting the entire tilemap.
6. Community top-down rendering practice consistently uses feet/ground contact as the depth origin and separates static layers from dynamic Y-sorted objects. Counterevidence: large/tall irregular props can need split sprites or specialized occlusion rather than a single Y pivot.

### HYPOTHESIS

Before increasing avatar size, Kelo will look more stable if all gameplay/world rendering that must visually align uses one authoritative world-to-screen camera transform, and pixel snapping occurs at final screen/device coordinates rather than by rounding actor world coordinates. The hero asset pipeline should use true alpha and an explicit sampling policy; broad near-white color-key removal should be eliminated for any replacement asset. For the current high-resolution pixel-art-style hero, nearest-neighbor vs smoothed downscale should be A/B measured rather than assumed, because the source is heavily downscaled.

### PROPOSED_CHANGE

**P1 — Instrument the transform mismatch before changing it**
- Expose a debug helper that maps a set of fixed world landmarks through both the engine-a base transform and engine-l plaza transform.
- Record pixel deltas at player foot, +/-100 world px lateral, plaza boundary, NPC positions, and aimed-skill marker.
- Record `CONFIG.zoom`, DPR, camera fractional components, and viewport.

**P2 — Define one authoritative worldToScreen transform**
- Introduce a pure helper or shared matrix contract, not a new render wrapper.
- All world layers that must align use the same camera center, zoom, and viewport convention.
- Preserve UI/joystick in screen space.
- Do not refactor all render ownership at once; first prove same-trace alignment.

**P3 — Screen/device-space snap experiment**
- Baseline current world-space `Math.round()` in engine-ab.
- B: no actor rounding.
- C: snap final screen translation to `round(screenPx*dpr)/dpr` while preserving logical physics coordinates.
- Never snap `p.x/y`, collider or physics.
- Compare camera-relative jitter during slow lateral movement and reversals.

**P4 — Explicit hero sampling A/B**
- Current: imageSmoothing=false.
- B: imageSmoothing=true only for hero downscale.
- C: pre-bake/downsample validated hero frames to intended render scale and draw 1:1/near-1:1.
- Test at 54x81 and later 62x93 / 68x102.
- Keep plaza/tile pixel-art policy separate from hero policy.

**P5 — True-alpha asset contract**
- New lateral/hero production assets must already contain real alpha.
- For true-alpha assets, skip the `RGB>232 => alpha=0` white-key pass entirely.
- Add validator metrics: alpha coverage, near-white opaque pixel count, cell-edge bleed, pivot variance, and frame bounds.
- Do not remove legacy color-key behavior for current hero.PNG until replacement asset is verified, to avoid mixing behavior changes.

**P6 — Continue locomotion evolution only after sampling baseline**
- Keep current hard physical stop unchanged.
- Preserve update-side visual state.
- Future 8-frame WALK/RUN phase should advance primarily by traveled distance/stride semantics with bounded time fallback, preserving contact phases on reversal.
- Re-run at 60/90/120 Hz after camera/sampling alignment.

### DO_NOT_ASSUME

- Do not assume engine-t owns final zoom; engine-z loads later and overwrites it.
- Do not assume `imageSmoothing=false` is always visually superior for a 256x384 source downscaled to ~54x81.
- Do not assume world-space integer rounding yields device-pixel stability under fractional camera, zoom or DPR.
- Do not remove the base render or engine-l redraw without a before/after trace proving no missing layers/UI/effects.
- Do not enlarge collider radius when enlarging visual sprite.
- Do not ship a generated 8x2 atlas based only on dimensions; validate cell alpha/bounds/pivots.
- Do not claim the current hero.PNG contains damaged white costume pixels without a binary/visual alpha audit; the destructive threshold operation itself is confirmed, actual lost semantic pixels still needs measurement.

### EXPERIMENT

1. Baseline V5.39/v90 on current main.
2. Test mobile 390x844 DPR2 plus desktop 1440x900 DPR1/2 where available.
3. Trace: idle -> RIGHT 2s -> release -> LEFT reversal -> diagonal -> plaza boundary -> pass NPC -> return.
4. Log every frame: player world foot, camera x/y, zoom, DPR, base-world screen foot prediction, plaza-transform screen foot prediction, fractional device coordinate, visual frame/gait.
5. Measure current transform delta and screen-space jitter.
6. Apply only unified worldToScreen transform behind a feature flag; rerun exact trace.
7. Test actor snap modes A/B/C without changing movement physics.
8. Test hero smoothing modes A/B/C at 54x81; capture zoomed crops and frame-time P95/P99.
9. Audit legacy hero.PNG near-white opaque pixels before removing any white-key compatibility path.
10. Only after those measurements, connect a validated true-alpha 8+8 lateral asset and re-run stride/contact/reversal tests.

### DECIDING_METRICS

- `baseVsPlazaScreenDeltaPxP95` target ~0 for aligned world content
- `footAnchorScreenJitterP95`
- `devicePixelFractionVariance`
- `cameraRelativeFootVelocityVariance`
- `reversalPosePopCount`
- `spriteEdgeShimmerCount`
- `nearWhiteOpaquePixelsBeforeKeying`
- `semanticPixelLossCount` from legacy keying audit
- `heroSamplingPreference` blind A/B at 54x81 and 68x102
- `frameTimeP95`, `frameTimeP99`
- `renderAvatarCallsPerRAF`
- `collisionOutcomeDiffCount` target 0
- `colliderRadiusBeforeAfter` target 20->20
- `propDepthOrderErrorCount`
- `nameplateOverlapRate`

### RISKS

- Unifying camera transforms can reveal layers that were accidentally relying on the current mismatch; feature-flag and same-trace comparison are required.
- Screen-space snapping can trade shimmer for small camera judder if applied to the whole camera too aggressively.
- Smoothing the hero while tiles remain nearest-neighbor may look stylistically inconsistent; this must be judged visually.
- Pre-baked multi-scale hero frames improve sampling but increase asset memory and maintenance if overused.
- Removing legacy white-key processing before a true-alpha replacement is ready can restore the original white background.
- Enlarging the avatar before depth/occlusion work remains risky because tall props are not yet correctly interleaved.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1-P6 and report:
- measured current base-vs-plaza transform deltas at mobile and desktop viewports;
- whether one shared worldToScreen helper can be introduced without a new wrapper owner;
- A/B/C screen-jitter results for current rounding vs no rounding vs device-space snap;
- hero downscale visual comparison with smoothing false/true/pre-baked at identical sizes;
- binary audit of hero.PNG showing whether near-white semantic pixels are actually destroyed by current keying;
- any live boundary/pop evidence caused by split transforms;
- render-call/frame-time measurements before/after;
- exact commits, tests, screenshots/traces and any proposal rejected/deferred.

## CG-20260901-014 — Remove touch gait discontinuity and add facing hysteresis before 8+8 lateral animation

ID: CG-20260901-014
TIMESTAMP: 2026-09-01T11:34:38-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 0eb98da792c0a509a69597e6e2b7bc023782b8e7
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,input,joystick,touch,60hz,90hz,120hz,latency,render,benchmark,bug
AFFECTED_FILES: engine-a.js, engine-ac.js, engine-ab.js, engine-ah.js, scripts/live-audit.mjs
RESPONDS_TO: CG-20260901-009, CG-20260901-010, CG-20260901-011, CG-20260901-013; current user priority lateral premium movement

### PROBLEM

The current mobile locomotion stack derives visual gait and physical movement from two different magnitudes. `engine-a.js::processInput()` converts touch radius through a 0.12 circular deadzone and a POWER curve (`mag^1.35`) into `input.normX/Y`, while `engine-ac.js::stickMag()` ignores that processed vector whenever `input.touchActive` and instead recomputes raw pointer radius / joystickRadius. `gaitFrom()` switches idle→walk at raw 0.14 and walk→run at raw 0.74, and the gait then abruptly changes `CONFIG.speed` from 96 to 165+(mag-0.74)*28. The base movement subsequently multiplies the processed `input.norm` by that CONFIG.speed. This can create visible foot-skate near walk onset and a large speed discontinuity at run onset even though the thumb barely moved. Direction family selection also uses one hard side-vs-vertical threshold with no hysteresis, so analog noise near diagonals can make facing rows flap.

### CONFIRMED_IN_GEMINI

At current `main` base `0eb98da792c0a509a69597e6e2b7bc023782b8e7`:

1. `index.html` is `Kelo World — V5.39` and loads engines with `?v=90`.
2. `engine-a.js` has `joystickRadius=60`, `joystickDeadzone=0.12`, `joystickCurve='POWER'`. For touch, `processInput()` maps raw radius ratio `r` to processed magnitude approximately `((r-0.12)/0.88)^1.35` after deadzone, clamped by radius.
3. `engine-ac.js::stickMag()` instead returns raw touch distance / joystickRadius while touch is active.
4. `engine-ac.js::gaitFrom()` uses raw thresholds `0.14` idle/walk and `0.74` walk/run.
5. At raw r=0.14 the processed movement magnitude is only ~0.00604, so gait becomes WALK while target physical speed is only about 0.58 world px/s with CONFIG.speed=96. That is a strong foot-skate risk.
6. Immediately below run threshold, raw r=0.739 maps to processed magnitude ~0.6219 and target speed ~59.70 px/s (`0.6219*96`). At raw r=0.740, processed magnitude changes only to ~0.6233 but gait flips to RUN and target speed jumps to ~102.84 px/s (`0.6233*165`): approximately +43.14 px/s / +72.25% for a 0.001 raw thumb-radius change.
7. Keyboard input normalizes to magnitude 1, therefore keyboard is effectively always RUN under the current gait classifier.
8. `engine-ac.js` facing family uses `abs(dx)*1.15 >= abs(dy)` with no previous-family hysteresis. The boundary is `|dy/dx|=1.15`, about 49 degrees from horizontal. Small analog direction noise around this angle can alternate side vs vertical animation family.
9. `engine-ac.js` prioritizes actual displacement, then velocity, then input intent for `v.dx/v.dy`. On a full lateral reversal under `accelDecay=18`, continuous exponential velocity crosses zero after approximately `ln(2)/18 = 38.5 ms`; the physical body can therefore still travel in the old direction briefly after the thumb/keyboard reverses.
10. `engine-ah.js` still hard-stops velocity only when movement input is absent, so this reversal crossing behavior is distinct from release-to-idle behavior.
11. `engine-ab.js` currently has no diagonal rows; side faces share row 2 and left is mirrored. Any threshold chatter therefore appears as visible row switching between lateral and up/down art, not merely metadata noise.
12. Current `ENGINE_MAP.md` remains stale for hero renderer ownership and some engine responsibilities; code, not the map, is authoritative for this round.

### EXTERNAL_EVIDENCE

1. Godot's official `Input.get_vector()` documentation recommends treating two movement axes as one vector with a circular deadzone; its controller documentation says the deadzone should be high enough to suppress noise but low enough not to suppress intended input. This supports using one processed locomotion magnitude for both physical speed and gait classification rather than mixing raw-radius and post-curve magnitudes.
2. Unity Input System documentation likewise describes a stick deadzone processor that operates on the Vector2 actuation magnitude, reinforcing the single-vector model for analog intent.
3. MDN documents that `requestAnimationFrame()` commonly runs at 60/75/120/144 Hz and warns animation progression must be time-based rather than callback-count-based. The existing update-side time state is directionally correct; the new gait/facing experiment must preserve that refresh-rate independence.
4. Community reports for top-down 8-direction animation repeatedly describe jarring direction snaps when diagonal inputs are released a few milliseconds apart, with suggestions to preserve recent direction/history rather than selecting from the instantaneous final sample. This is weaker evidence than engine docs but directly matches the failure mode expected from a single hard directional threshold.
5. Counterevidence: immediate facing changes can feel more responsive in action combat. Therefore hysteresis must affect animation-family presentation only and must not delay physical movement or aiming vectors.

### HYPOTHESIS

The biggest current mobile movement-quality gain may come before the new 8+8 art: make analog gait, physical target speed, and animation phase share one processed intent magnitude, then stabilize facing-family selection with a small Schmitt-style angular hysteresis. For reversals, separate `intentDirection` from `travelDirection`: respond physically immediately as today, but allow the visual state to hold/resolve a contact pose during the ~0–40 ms velocity-crossing window instead of instantly mirroring a running stride or continuing a full old-direction cycle. This should reduce foot sliding, run-speed popping, diagonal row chatter and reversal pops without changing collider or world position policy.

### PROPOSED_CHANGE

**P1 — Instrument raw vs processed touch magnitude before behavior change**
- Add debug-only samples for rawRadiusRatio, processedNormMag, gait, CONFIG.speed and actual displacement speed.
- Sweep touch radius from 0→1 slowly and back using a real/coalesced pointer path when possible.
- Record threshold crossings and target-speed discontinuities.

**P2 — Single source of analog magnitude**
- For gait decisions, derive magnitude from processed `Math.hypot(input.normX,input.normY)` after `processInput()` rather than recomputing raw touch distance in `engine-ac.js`.
- Keep raw radius only as diagnostic metadata.
- Do not alter deadzone/POWER curve in the same experiment.

**P3 — Make physical speed curve continuous across WALK↔RUN**
- Do not retain an instantaneous CONFIG.speed jump 96→165 at one gait threshold.
- Candidate A: blend the speed scale over a narrow processed-magnitude band (for example around 0.65–0.85) while gait label may still change once.
- Candidate B: define desired target speed as an explicit continuous monotonic function of processed magnitude, then derive the base scale from it.
- Choose only after plotting thumb magnitude→world speed. Preserve current max-speed neighborhood unless A/B evidence supports change.

**P4 — Direction-family hysteresis**
- Preserve current family (`side` vs `vertical`) across a small angular deadband instead of reclassifying at one `|dy/dx|=1.15` boundary every update.
- Candidate test: when already side, remain side until `|dy/dx| > 1.30`; when vertical, enter side only when `|dy/dx| < 1.00`. This creates roughly a 45°–52.4° hysteresis band. Treat these as benchmark candidates, not ship constants.
- Keep exact left/right sign responsive once side family is selected.

**P5 — Reversal presentation state**
- Track `intentSignX`, `travelSignX`, and zero-cross timestamp separately.
- On RIGHT↔LEFT intent reversal while travel direction is still old, keep physical acceleration policy unchanged.
- Visual candidate: resolve/hold nearest foot-contact frame and begin body lean/turn; flip the lateral cycle when travel velocity/displacement crosses zero or after a strict short cap.
- Do not introduce a 38.5 ms artificial wait; that value is an expected current physical crossing at full symmetric reversal, not a mandated animation delay.

**P6 — Prepare 8+8 contract**
- New lateral atlas should expose semantic metadata: WALK contact indices, RUN contact indices, stride length candidates, pivot per frame and optional reversal/contact-safe frames.
- Phase should ultimately be distance-driven, so processed physical displacement—not raw thumb radius—owns stride advancement.

### DO_NOT_ASSUME

- Do not assume the current raw gait thresholds 0.14/0.74 remain correct when moved into processed magnitude space.
- Do not simply replace `stickMag()` with `hypot(input.norm)` and ship; the current 96→165 CONFIG.speed jump would still create a large physical discontinuity.
- Do not smooth or delay the actual input vector for hysteresis; presentation family only.
- Do not flip the sprite based solely on intent while the body is still visibly translating the opposite way unless A/B video proves it better; that can create moonwalk.
- Do not change collider radius 20, camera, joystick deadzone, POWER exponent, or acceleration decay in the same first experiment.
- Do not use a screenshot to judge reversal or diagonal chatter; use video/traces.

### EXPERIMENT

1. Baseline V5.39/v90 current code on keyboard and touch.
2. Touch sweep: raw radius 0→1 over ~4 s, hold, return; repeat at angles 0°, 40°, 47°, 49°, 51°, 55°, 90°.
3. Record raw/processed magnitude, gait, target speed, actual speed, selected face family and frame.
4. Reversal trace: RIGHT 1.5 s → immediate LEFT 1.5 s → RIGHT, repeat WALK-like analog magnitude and full RUN magnitude.
5. Establish baseline `speedJumpAtWalkRun`, `familyFlipCountNearDiagonal`, `intentToTravelZeroCrossMs`, `reversalPosePopCount`, `footSlipPxPerContact`.
6. Apply P2 only behind a flag, rerun exact traces; do not approve unless physical discontinuity is explicitly measured.
7. Apply P3 continuous speed mapping, rerun.
8. Apply P4 hysteresis only, rerun diagonal sweeps.
9. Apply P5 reversal presentation only, rerun reversal clips at 60/90/120 Hz where available.
10. Only after the behavior baseline is stable, connect a validated 8 WALK + 8 RUN atlas and convert phase to distance/stride semantics.

### DECIDING_METRICS

- `rawTouchMag`
- `processedNormMag`
- `targetSpeedPxPerSec`
- `actualSpeedPxPerSec`
- `speedJumpAtWalkRunPxPerSec` target near 0 for infinitesimal input changes
- `speedCurveMonotonicViolationCount` target 0
- `walkAnimationBelowMinTravelSpeedMs`
- `familyFlipCountNearDiagonal`
- `familyFlipsPerSecondNearBoundary`
- `intentToTravelZeroCrossMs`
- `intentToVisualFacingFlipMs`
- `reversalPosePopCount`
- `moonwalkFrameCount`
- `footSlipPxPerContact`
- `phaseDeltaOnDuplicateRender` target 0
- `collisionOutcomeDiffCount` target 0
- `colliderRadiusBeforeAfter` target 20→20
- frame-time P95/P99 and moving-video preference at 60/90/120 Hz

### RISKS

- Retuning gait in processed space can unintentionally make WALK too hard/easy to access on touch if thresholds are copied blindly.
- A continuous speed curve that ramps too slowly can make the joystick feel weak; too aggressively can recreate the current jump in softer form.
- Too much angular hysteresis can make the hero appear to face sideways while moving clearly vertically.
- Reversal contact holding can look sticky if it exceeds the real velocity-crossing window.
- Keyboard has binary magnitude 1 and will remain effectively RUN unless a separate walk modifier or keyboard policy is intentionally designed later.
- Current 4-frame asset may be too semantically weak to show the full benefit; measurements should separate movement correctness from art limitations.

### EXPECTED_GROK_FEEDBACK

Grok should independently classify P1–P6 and report:
- measured raw-radius→processed-magnitude→target-speed curve on touch;
- confirmation/refutation of the calculated ~0.58 px/s WALK onset and ~59.70→102.84 px/s threshold jump;
- exact input/update ordering in the live loop;
- whether a continuous speed curve can be introduced in `engine-ac` without changing the core `engine-a` owner;
- diagonal family flip counts before/after hysteresis;
- reversal zero-cross time at WALK-like and RUN-like magnitudes;
- A/B video/trace evidence for intent-facing vs travel-facing vs contact-bridge reversal;
- any conflict with combat aim/melee facing semantics;
- exact commits/tests/live verification and any rejected/deferred item.

## CG-20260901-015 — Separate foot-root, shadow, nameplate and visual scale before enlarging Kelo

ID: CG-20260901-015
TIMESTAMP: 2026-09-01T12:37:19-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 68c15f65d40f0bbc75227e3444b6769f43367f0d
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,camera,collision,atlas,benchmark,60hz,90hz,120hz,hd2d
AFFECTED_FILES: engine-a.js, engine-ab.js, engine-ac.js, engine-l.js, engine-v.js, engine-z.js, ENGINE_MAP.md, assets/hero.PNG
RESPONDS_TO: CG-20260901-012, CG-20260901-013, CG-20260901-014, user priority to enlarge characters without degrading collision/camera/occlusion/legibility/FPS

### PROBLEM

Kelo's current visual presentation still couples several concepts that must be independent before the avatar is enlarged: world position/collider, sprite foot root, contact shadow, nameplate placement and zone-dependent camera zoom. Current `engine-ab.js` replaces the base avatar renderer with the PNG renderer, but it does not draw the base contact shadow. It also positions the nameplate in world space relative to sprite height. Inside the plaza, `engine-l.js` draws actors inside a zoomed world transform; outside the plaza, the base renderer uses a different camera transform. Therefore sprite size, nameplate size/gap and apparent foot anchoring can vary by render path/zoom. A larger avatar will magnify these inconsistencies even if the collider stays radius 20.

### CONFIRMED_IN_GEMINI

At base commit `68c15f65d40f0bbc75227e3444b6769f43367f0d`:

1. `index.html` is V5.40 and loads the engine stack at cache version `v=91`; this is newer than prior research rounds, so conclusions were rechecked against current main.
2. `ENGINE_MAP.md` remains stale: it still advertises V5.15/v66 and says `engine-m.js` owns the hero sprite, while current `engine-ab.js` is the effective PNG avatar override.
3. Base `engine-a.js` defines `localPlayer.radius = 20` and base `renderAvatar()` draws a contact ellipse at approximately `(p.x, p.y + 14)` with radii `0.9*radius` by `0.45*radius`, then draws the procedural avatar and a 10px nameplate.
4. Current `engine-ab.js` overrides `renderAvatar()`. When the PNG sheet is ready it does NOT call the base renderer, so the base contact shadow is absent on the PNG path.
5. `engine-ab.js` defines `footY = p.y + 10`, draws the side sprite at world size `48 x 81`, and draws the nameplate at `footY - dh - 6` using an 11px font. This gives an explicit foot-root candidate but no explicit shadow-root/nameplate-root abstraction.
6. `engine-v.js` is intentionally empty except for a note that scale was absorbed into `engine-ab` draw size, confirming visual scale is currently encoded directly in the sprite renderer rather than an independent avatar presentation contract.
7. `engine-l.js` wraps `render()`, applies HiDPI, invokes the prior renderer, then draws plaza floor/props and redraws NPCs/Kelo inside `translate(center) -> scale(CONFIG.zoom) -> translate(-camera)`. Therefore the PNG sprite and its 11px nameplate are both world-scaled inside the plaza.
8. `engine-z.js` currently sets `CONFIG.zoom` from viewport width and clamps it to 1.05..1.45. Thus the same world-space `48 x 81` side sprite can appear approximately `50.4 x 85.1` to `69.6 x 117.5` CSS px on the plaza depending on zoom; the 11px world-space nameplate becomes approximately 11.6..16.0 CSS px there.
9. Outside the plaza, base rendering does not use that same zoom transform, so screen-space avatar/nameplate behavior is not globally uniform.
10. The current assets directory contains `hero.PNG` but no production `hero-side-v2.png`; the previously generated experimental 8+8 asset is therefore not in current main and must not be assumed available or valid.
11. Current `engine-ac.js` still uses 4 animation columns and a time-based 130ms visual frame cadence; the prior gait discontinuity research remains unresolved and no new Grok feedback supersedes it.
12. Current `GROK_TO_CHATGPT.md` still has no feedback newer than GC-20260831-003, so none of CG-012/013/014 can be treated as implemented or closed.

### EXTERNAL_EVIDENCE

1. MDN documents `imageSmoothingEnabled` as the Canvas2D control for smoothing scaled images and recommends disabling it when enlarging pixel art to preserve hard edges. However MDN's pixel-art guidance also warns that non-integer mappings between source pixels, canvas pixels and device pixels can make some pixels uneven; this matters because Kelo is being resampled and then additionally transformed by zoom/DPR.
2. The CSSWG issue on `image-rendering: pixelated` records the same counterevidence: nearest-neighbor at scale factors far from integers can visibly distort pixel widths. Therefore nearest filtering is not a sufficient guarantee of premium quality at arbitrary avatar/zoom scales.
3. Godot's open proposal for a jitter-free/sharp-bilinear pixel-art filter exists specifically because smooth cameras and nearest filtering can produce visible jitter when texels do not map cleanly to screen pixels. This supports benchmarking sampling and screen-space stability rather than assuming a single filter solves it.
4. PixiJS documents explicit child sorting by zIndex; its sorting model reinforces keeping presentation order as a render concern separate from physics/collider size. We do not need to migrate to PixiJS to use that principle.
5. Recent Godot community debugging of top-down Y-sort converges on putting the sorting/origin reference at the bottom/feet of the sprite rather than its visual center. This is community evidence, not proof of exact constants, but it matches Kelo's existing `footY = p.y + 10` concept.

### HYPOTHESIS

Before increasing Kelo to ~1.15-1.30x, define one presentation contract rooted at the feet: `footWorld`, `visualBounds`, `shadowBounds`, `nameplateAnchor` and `collider` must be independent. The collider remains radius 20 unless collision testing independently justifies a change. Sprite scale changes only visual bounds. Shadow follows the foot root, not sprite bob. Nameplate should be rendered in screen space (or at minimum counter-scaled) so its font size/gap remains legible and stable across 1.05..1.45 zoom. This separation should make larger sprites look grounded without changing navigation or making UI text balloon with camera zoom.

### PROPOSED_CHANGE

Evaluate incrementally; do not bulk-refactor.

**P1 — Instrument the current presentation contract first**
- Add a debug-only probe that records per frame: `footWorldX/Y`, sprite world rect, sprite screen rect, collider center/radius, shadow center/radii, nameplate screen rect, zoom, DPR and render path/zone.
- Record draw counts for avatar/shadow/nameplate to catch duplicates.
- No gameplay or visual change in P1.

**P2 — Introduce one foot-root helper without changing output**
- Candidate semantic helper: `getAvatarFootRoot(p) -> {x:p.x, y:p.y+10}` for PNG actors.
- Keep world/physics coordinates untouched.
- Renderer should derive sprite destination, shadow anchor and depth key from this root.
- Do not yet change sprite size, collider or gait.

**P3 — Restore an explicit PNG contact shadow**
- Draw exactly one shadow for the PNG path, centered on the foot root and underneath the actor.
- Initial candidate bounds should be benchmarked; for current collider radius 20, start near base proportions rather than scaling shadow 1:1 with sprite height.
- Keep shadow vertical position fixed to the foot root during any future torso/head bob. Do not bob the shadow with the sprite.
- If stride/bob later changes body position, shadow opacity/width may react subtly to airborne-looking frames, but only after contact metrics are stable.

**P4 — Decouple nameplate from world zoom**
- Move/calculate nameplate after world->screen projection so font size remains a chosen CSS-pixel size, e.g. benchmark 11/12/13 CSS px, rather than multiplying by CONFIG.zoom.
- Anchor its baseline to the sprite's screen-space top plus a fixed CSS gap.
- Clamp/avoid the HUD safe area and measure overlap with nearby actors/props.
- Do not use the collider top for the nameplate once sprite size is enlarged; use visual bounds.

**P5 — Scale only the visual rectangle in controlled A/B steps**
- Preserve radius=20, movement speeds, camera and collision outcomes.
- First compare current 48x81 against aspect-correct 54x81.
- Then, only after foot/shadow/nameplate instrumentation passes, compare approximately 62x93 and 68x102. Treat 70x105 as a later candidate, not a target.
- At each size, compute resulting CSS screen size across zoom 1.05/typical-mobile/~1.45 and reject sizes that create unacceptable HUD/nameplate/occlusion pressure.

**P6 — Sampling benchmark tied to actual screen transform**
- Compare nearest, smoothing-enabled hero-only and a pre-resized/prebaked hero asset at the same final screen sizes.
- Measure/screenshot at representative DPR 1/2/3 and zoom samples; do not globally toggle smoothing based on one screenshot.
- Prefer alpha-native assets for the future side sheet; do not run new assets through the existing `RGB > 232 => alpha 0` color key.

**P7 — Keep depth/collision work orthogonal**
- Continue CG-012's proposal to Y-sort only dynamic/occluding props with actors using a foot/base depth key and to add explicit plaza colliders where intended.
- Do not enlarge the collider to match the sprite. A visually larger coat/hair may overlap props while feet/body collision remains stable; that is normal for top-down sprites if depth ordering is correct.

### DO_NOT_ASSUME

- Do not assume V5.39/v90 remains current; this round verified V5.40/v91.
- Do not assume `engine-m.js` owns the hero because ENGINE_MAP says so; current runtime override is in `engine-ab.js`.
- Do not assume the experimental 8+8 PNG is in the repo; it is not present in current assets.
- Do not assume a larger sprite requires a larger collider.
- Do not scale the shadow by the same factor as the full sprite without testing; contact shadows communicate ground contact, not hair/coat extent.
- Do not let vertical bob move the contact shadow with the torso.
- Do not let world zoom silently determine UI/nameplate font size.
- Do not claim nearest-neighbor is always superior; non-integer scale/DPR is documented counterevidence.
- Do not refactor duplicate render paths before collecting draw counts and same-trace evidence.

### EXPERIMENT

Use one deterministic trace before and after each individual change:

1. Boot current main/live build and record exact build identity.
2. Stand idle 2s in plaza; walk RIGHT 2s; stop 1s; walk LEFT 2s; reverse RIGHT->LEFT at run intent; move diagonally near 45-55 degrees; pass an NPC; pass behind/in front of one occluding prop candidate.
3. Repeat at desktop and a representative mobile touch viewport.
4. P1 baseline: record foot/sprite/shadow/nameplate/collider screen/world telemetry and avatar/shadow/nameplate draw counts.
5. P2 only: introduce foot-root helper with no visible delta. The same trace should produce numerically identical world positions/collision outcomes.
6. P3 only: add exactly one PNG shadow. Verify `shadowDrawsPerAvatar == 1`, foot-to-shadow center error and no floating during stop/reversal.
7. P4 only: screen-space/counter-scaled nameplate. Verify stable font CSS size/gap across zoom samples and reduced variation between plaza/non-plaza paths.
8. P5 scale A/B: 48x81 -> 54x81 -> 62x93 -> 68x102, one size per run; collider remains radius 20. Compare screen occupancy, overlap, camera visibility and collision trace equality.
9. P6 sampling A/B/C at a fixed avatar size and camera trace; capture pinned screenshots plus frame-time metrics.
10. Only after those pass should Grok combine this with 8 WALK + 8 RUN and distance-driven stride.

### DECIDING_METRICS

- `footAnchorScreenJitterP95`
- `footToShadowCenterErrorPxP95`
- `shadowDrawsPerAvatar`
- `avatarDrawsPerActorPerRAF`
- `nameplateFontCssPxMinMax`
- `nameplateGapCssPxMinMax`
- `nameplateOverlapRate`
- `hudSafeAreaIntrusionCount`
- `visualRectToViewportAreaRatio`
- `colliderRadiusBeforeAfter` (target 20 -> 20 during visual-only tests)
- `collisionOutcomeDiffCount` (target 0 during visual-only tests)
- `propDepthOrderErrorCount`
- `spriteEdgeShimmerCount` or equivalent screenshot-derived instability metric
- `frameTimeP95/P99`
- `longFrameCount`
- exact before/after commit and deployed build identity

### RISKS

- Moving nameplates to screen space can create new overlap/layout concerns unless all actors use the same policy and HUD safe areas are respected.
- A fixed shadow can look too detached on frames with large leg lifts; solve via restrained shadow width/opacity modulation rather than moving its ground anchor.
- Multiple current render paths may cause a newly added shadow/nameplate to duplicate if ownership is not measured first.
- Increasing visual size can expose current plaza depth errors dramatically even with perfect collision separation.
- Counter-scaling text inside the existing transformed context can be error-prone; a dedicated screen-space pass is cleaner but is a larger architectural change and therefore must be benchmarked behind a flag.
- Prebaking multiple sprite resolutions may improve sampling but increases asset memory/maintenance; compare against runtime sampling before adopting.

### EXPECTED_GROK_FEEDBACK

Grok should answer this entry explicitly and report:

- viability classification for P1-P7;
- current commit actually inspected (re-read main, do not assume this base still current);
- whether base PNG path truly has zero/one/multiple shadows in the final rendered frame after all wrappers;
- measured avatar/nameplate/shadow draw counts per RAF;
- measured plaza vs non-plaza screen-space nameplate size/gap at representative zooms;
- exact collider radius and proof that visual-only size tests do not change collision outcomes;
- before/after screenshots/traces for 48x81 vs 54x81 and, only if clean, larger candidates;
- frame-time P95/P99 and any mobile regression;
- any conflict with CG-012/013/014 discovered in newer code;
- exact commits, Pages/live verification, failures and proposals rejected/deferred.

## CG-20260901-016 — Decouple camera look-ahead from raw intent during lateral reversals

ID: CG-20260901-016
TIMESTAMP: 2026-09-01T13:38:22-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 39b792b6fb8a6a745ff8902d3ef9185797f61640
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,camera,input,joystick,60hz,90hz,120hz,render,benchmark
AFFECTED_FILES: engine-a.js, engine-z.js, engine-ac.js, engine-l.js, scripts/live-audit.mjs
RESPONDS_TO: CG-20260901-013, CG-20260901-014, CG-20260901-015

### PROBLEM
Current lateral camera look-ahead is driven by processed input direction, while player travel direction is accelerated/damped separately. On a 180-degree reversal the camera's look-ahead therefore changes sign on a very different time constant from the avatar's actual velocity. This can make left/right reversals feel visually delayed or counter-steered even if locomotion itself is correct. The camera dead-zone is also expressed as a fraction of CSS viewport width in world units before the plaza zoom transform, so its effective visible width is not invariant across zoom/device classes.

### CONFIRMED_IN_GEMINI
At current main, engine-a.js uses CONFIG.accelDecay=18, lookAheadDecay=4, deadXRatio=0.10 and computes camera.lookOffsetX toward input.normX*CONFIG.lookAheadDist. Player velocity moves toward input.normX*CONFIG.speed with exponential decay 18. engine-z.js later clamps CONFIG.lookAheadDist to 36 and sets CONFIG.zoom from viewport width, up to 1.45. engine-l.js renders the plaza/actors inside scale(CONFIG.zoom).

For an idealized full-speed RIGHT→LEFT reversal, if vx and lookOffsetX begin at their positive steady states and input flips instantly, exponential sign-crossing times are approximately ln(2)/18 = 38.5 ms for velocity and ln(2)/4 = 173.3 ms for look-ahead. This leaves about 134.8 ms where physical travel has already reversed but look-ahead still points toward the old side: ~8.1 frames at 60 Hz, ~12.1 at 90 Hz, ~16.2 at 120 Hz. This is a code-derived prediction, not a runtime measurement.

The horizontal dead-zone is deadW=screenW*0.10 world units, while engine-l later magnifies those world units by zoom. Thus the visible dead-zone fraction becomes approximately deadXRatio*zoom in the plaza renderer: ~10.5% at zoom 1.05 and ~14.5% at zoom 1.45. This is another code-derived prediction and should be verified against the effective camera transform before changing behavior.

### EXTERNAL_EVIDENCE
Unity Cinemachine documentation warns that look-ahead prediction is sensitive to noisy motion and can amplify camera jitter; it provides independent look-ahead smoothing and horizontal damping controls. Godot Camera2D documentation separates drag margins, target position and smoothed screen-center position, reinforcing that camera composition target and actual camera location are distinct state. Godot issue reports and community threads repeatedly document interactions between smoothing, pixel-perfect rendering and jitter; one recent top-down/isometric community example describes a custom camera whose behavior explicitly changes when direction changes, rather than treating last input and actual travel as the same signal.

Counterevidence: camera lag is not inherently bad. A delayed look-ahead can make motion feel weighted and reduce twitchiness. Therefore the goal is not 'make camera instant'; it is to measure whether intent-driven look-ahead creates a visible contradiction during reversal, and compare it with velocity/travel-driven or hybrid targets under the same trace.

### HYPOTHESIS
A premium lateral camera should use a hybrid look-ahead target derived primarily from actual travel velocity once moving, with input intent allowed to bias anticipation only when velocity is small or direction is stable. During a hard reversal, the camera should not spend ~135 ms looking toward the old travel side after the avatar has crossed zero velocity. A short hysteresis/zero-cross bridge can preserve weight without counter-steering.

A second hypothesis is that camera dead-zone should be defined in screen/composition space (or compensated by zoom) so the perceived horizontal freedom around Kelo is comparable on mobile and desktop.

### PROPOSED_CHANGE
P1 instrumentation only: expose cameraIntentSignX, travelSignX, lookOffsetX, camera.targetX, camera.x, zoom, screenW, deadW, localPlayer.vx and projected player screen X per RAF/update.

P2 behind an experiment flag, compare three look-ahead target sources without changing locomotion: A=current processed input; B=normalized velocity; C=hybrid, where velocity owns direction above a small speed threshold and input only biases magnitude/anticipation when travel and intent agree or speed is near zero.

P3 test reversal-aware look-ahead: when intentSignX != travelSignX and |vx| is above threshold, decay look-ahead toward zero first; only establish the new-side look-ahead after velocity crosses zero or a maximum bridge time elapses. Do not snap camera position.

P4 test zoom-compensated horizontal dead-zone, e.g. worldDeadW=(screenW*desiredScreenRatio)/(CONFIG.zoom||1), versus current deadW=screenW*ratio. Keep vertical behavior unchanged in the first experiment.

P5 only if metrics improve, centralize camera world→screen transform so base renderer and plaza renderer consume the same camera composition contract. This does not authorize a refactor before measurement.

### DO_NOT_ASSUME
Do not assume the 38.5/173.3 ms analytical values equal browser-observed reversal timing; update order, collisions, gait wrappers and variable frame dt can change it. Do not assume velocity-only look-ahead is superior on touch; analog intent may usefully anticipate before actual movement. Do not change avatar scale, sprite atlas, collider, stride cadence, depth sorting or nameplate in the same A/B. Do not remove smoothing globally. Do not change engine-z zoom behavior as part of P1/P2.

### EXPERIMENT
Baseline on current main with identical deterministic traces using keyboard first, then real PointerEvent/touch if the harness is reliable:
1. hold RIGHT 1.5 s;
2. reverse to LEFT 1.5 s;
3. reverse RIGHT 1.5 s;
4. repeat at walk-equivalent analog magnitude if touch automation works;
5. diagonal 35°→55° sweep to ensure camera change does not amplify facing-family transitions.

Run at effective 60/90/120 Hz where possible or replay recorded dt sequences if display refresh cannot be forced. Capture player world X, vx, intent sign, lookOffsetX, camera target/current X and final projected screen X.

Then run A/B/C look-ahead source variants with no locomotion changes. Finally test current dead-zone versus zoom-compensated dead-zone on representative widths (e.g. ~390 mobile portrait and ~1440 desktop) using the same world trace.

### DECIDING_METRICS
reversalTravelZeroCrossMs; reversalLookAheadZeroCrossMs; staleLookAheadAfterTravelReverseMs; playerScreenXOvershootPx; playerScreenXReversalJerkP95; cameraVelocityJerkP95; cameraSettleMs; screenCompositionDeadZonePct; mobileDesktopDeadZonePctDelta; frameTimeP95/P99; footAnchorScreenJitterP95. Preferred direction: staleLookAheadAfterTravelReverseMs materially reduced without increasing cameraVelocityJerkP95, playerScreenXOvershootPx, jitter or nausea-inducing motion; mobileDesktopDeadZonePctDelta should shrink if zoom compensation is adopted.

### RISKS
Velocity-driven look-ahead can feel reactive rather than anticipatory at movement start. Zero-first reversal logic can feel sticky if threshold/bridge time is too large. Zoom-compensated dead-zones can make desktop camera more active than users expect. Additional camera state can create wrapper duplication if implemented outside engine-a.js. Pixel snapping should not be mixed into this experiment because it would confound camera jerk and shimmer measurements.

### EXPECTED_GROK_FEEDBACK
Classify P1-P5 independently as VIABLE/NEEDS_TEST/NOT_VIABLE/DEFERRED against current main. If testing P1/P2, report exact commit, deterministic trace, refresh/dt conditions, before/after staleLookAheadAfterTravelReverseMs, playerScreenXOvershootPx and cameraVelocityJerkP95. Confirm whether the analytical ~134.8 ms opposite-sign window is reproduced. Report whether dead-zone measured in visible screen space actually expands with zoom as predicted. If current architecture or render order invalidates either derivation, provide the exact code path/measurement rather than applying the proposal.

## CG-20260901-017 — MOV-001 fixed speed continuity, but lateral animation is still time-based and can treadmill at very low analog input

ID: CG-20260901-017
TIMESTAMP: 2026-09-01T14:33:37-04:00
AUTHOR: ChatGPT
BASE_COMMIT: d7b131b009401632828e2b289e1e2a7f29400aa6
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,input,joystick,touch,render,60hz,90hz,120hz,benchmark,canvas2d,atlas,shadow,camera
AFFECTED_FILES: engine-ac.js, engine-ab.js, engine-ah.js, engine-a.js, scripts/live-audit.mjs, docs/IMPLEMENTATION_ROADMAP.md
RESPONDS_TO: CG-20260901-014, CG-20260901-016, MOV-001

### PROBLEM
MOV-001 correctly removed the raw-touch-vs-processed-input mismatch and the physical WALK->RUN speed step, but the visible 4-frame locomotion cycle remains fixed at 130 ms/frame (520 ms/cycle) regardless of actual travel distance or gait. This means the physical speed is now continuous while the visual stride is still disconnected from world displacement. At very small processed magnitudes, visual walking can still start while Kelo barely translates, producing treadmill/foot-slide behavior. This is now a cleaner and more isolated next problem than the old speed discontinuity.

### CONFIRMED_IN_GEMINI
Current main is V5.41/cache v92 at commit d7b131b009401632828e2b289e1e2a7f29400aa6. `engine-ac.js` now reads `processedMag = hypot(input.normX,input.normY)`, uses a smooth speed cap from 96 to historical max 172.28, and publishes `KELO_MOVEMENT_AUDIT`. Collider remains `localPlayer.radius` and MOV-001 does not intentionally modify collision geometry.

`engine-ac.js` still advances `v.frame` every `VISUAL_FRAME_SEC=0.130` while `v.on` is true. It does not use distance travelled to advance phase. `engine-ab.js` consumes that frame for the local player, so render is read-only for local animation state, which is good, but cadence remains wall-clock/update-time based.

`gaitFrom()` uses `GAIT_IDLE_MAX=0.04`. Because the comparison is `<0.04`, a processed magnitude just above 0.04 becomes WALK. With `speedFor()` still returning 96 below magnitude 0.55, target speed at magnitude 0.04 is only about 3.84 world px/s. Yet `updateVisualMotion()` sets `hasIntent = gait !== 'idle'`, so the full walk animation can run even at this near-stationary speed. This is a code-derived finding; browser-observed appearance still needs capture.

The fixed 520 ms visual cycle corresponds to very different world travel per cycle under MOV-001: approximately 2.0 px at mag 0.04, 7.0 px at 0.14, 15.0 px at 0.30, 27.5 px at 0.55, 48.2 px at 0.74, and 89.6 px at full magnitude. Therefore one identical 4-pose cycle can represent roughly a 45x range in travel distance between near-threshold input and full run. This strongly predicts foot sliding/treadmill behavior at one or both ends.

`engine-ab.js` still uses lateral destination width 48 and height derived from source aspect, integer-rounds destination x/y, disables smoothing for the sprite draw, and uses `footY=p.y+10`. It still performs destructive white chroma-key removal on load. These remain relevant to later scale/sampling work but should not be changed in the same stride experiment.

`engine-ah.js` remains a second movement wrapper that hard-stops velocity after the wrapped update when no input exists. This is not the cause of the stride mismatch while input is held, but it remains part of the final movement ownership chain and must be included in regression traces.

`ENGINE_MAP.md` is stale relative to current runtime: it still advertises V5.15/v66 and identifies engine-m.js as hero owner, while current `engine-ab.js` is the active PNG avatar renderer. Treat the map as orientation, not current truth, until refreshed deliberately.

### EXTERNAL_EVIDENCE
MDN documents that `CanvasRenderingContext2D.imageSmoothingEnabled=false` preserves hard pixel edges when scaling, but MDN also warns that pixel-art scaling can become uneven when CSS pixels do not align cleanly with device pixels / devicePixelRatio. This supports keeping sampling and stride experiments separate: a visually sliding foot can be animation-phase mismatch even when pixel sharpness is correct. MDN also notes that modern mobile DPR can exceed 2 and page zoom changes DPR, reinforcing that screenshot quality must be tested at real DPR/zoom combinations rather than inferred from source dimensions. citeturn453140search0turn453140search1turn453140search4

Unity Cinemachine documentation treats look-ahead prediction, damping and composition as separate camera controls and warns that motion prediction can amplify jitter. This remains relevant to CAM-001, but is counterevidence against changing camera simultaneously with stride: camera motion can mask or amplify perceived foot slip, so hold camera behavior constant while measuring stride. citeturn453140search7turn453140search8

Community evidence is consistent with the basic diagnosis: developers repeatedly identify foot sliding when translation speed and animation speed do not match, recommending matching locomotion cadence to movement rather than treating animation as an independent clock. A separate recent pixel-art thread shows non-integer motion and high-refresh rendering can expose diagonal jitter even with fixed-step/interpolation, and another notes that rounding away subpixel motion can itself create visible judder. These are community reports, not universal rules, but they support testing distance-based phase plus subpixel rendering rather than assuming fixed 130 ms cadence is safe at 60/90/120 Hz. citeturn878354reddit35turn878354reddit36turn878354reddit37

Counterevidence: fully distance-locked animation is not always visually best. Stylized games may intentionally exaggerate cadence, preserve a minimum walk tempo, or blend authored walk/run clips rather than map pose phase linearly to speed. Therefore the experiment should compare a strict distance phase with a clamped/blended stride model, not assume exact physical locking is automatically premium.

### HYPOTHESIS
The next premium-feel improvement should decouple `visual locomotion active` from mere nonzero gait intent and make local stride phase primarily a function of actual distance travelled. A minimum-motion threshold should prevent full walking poses at ~4 px/s, while a stride-length model should keep contact cadence approximately stable in world distance as analog magnitude changes.

A likely robust model is: accumulate actual planar distance after collision resolution; convert accumulated distance to normalized stride phase using gait-specific target stride lengths; only allow locomotion animation after either actual displacement or actual speed exceeds a small threshold; blend stride length/cadence across walk->run rather than hard-resetting phase. Keep the current 4-frame atlas initially so the experiment isolates phase logic. The later 8+8 atlas can then consume the same normalized phase contract.

### PROPOSED_CHANGE
P1 instrumentation only: extend movement audit with `distanceThisStep`, `strideDistanceAccum`, `stridePhase01`, `visualOn`, `actualSpeed`, `gait`, `frame`, and `framesAdvancedThisLogicalStep`. Do not alter sprite, camera, collider or sampling.

P2 A/B/C visual phase experiment behind a narrow flag:
A = current 130 ms/frame baseline;
B = strict distance phase using actual post-collision displacement;
C = distance phase with a minimum visual-motion threshold and clamped gait-specific stride length so extremely slow analog movement either remains idle or uses a restrained shuffle rather than a full walk cycle.

Candidate initial stride calibration should be measured from current visual expectation rather than guessed. A practical starting point for the 4-frame placeholder is to target roughly 45-55 world px/cycle around the current walk/run boundary (~0.74 processed magnitude gives ~48.2 px/cycle under the old 520 ms clock). Then test whether full run needs a longer stride length, faster phase, or a separate authored run cycle later.

P3 preserve phase through walk<->run transitions. Do not reset to frame 0 solely because `gait` label changes. If gait changes, map existing normalized phase onto the new stride profile.

P4 keep reversal logic out of this first A/B unless it is necessary to avoid invalid measurements. Record direction sign and reversal points, but MOV-002 remains the dedicated visual-facing/contact bridge task.

P5 add a deterministic movement trace to the audit harness that can directly set/drive processed magnitudes 0.04, 0.14, 0.30, 0.55, 0.74, 1.00 for fixed durations, plus blocked movement against a wall. The blocked case should produce near-zero stride phase advance in B/C.

P6 after stride behavior is selected, then evaluate subpixel destination drawing vs current `Math.round()` separately. Do not combine rounding/sampling changes with P2 because they confound foot-slip and jitter judgments.

### DO_NOT_ASSUME
Do not call MOV-001 failed: it solved a different, real discontinuity. Do not change collider 20, max intended speed, camera look-ahead, zoom, depth ordering, shadow, nameplate, avatar size or atlas in this experiment. Do not infer that `gait='walk'` should always mean visible walking if actual displacement is negligible. Do not make NPC legacy renderer changes in the same patch. Do not remove `engine-ah.js` merely because it is a wrapper; ownership cleanup requires its own baseline and same-trace verification.

### EXPERIMENT
On current main baseline, run each magnitude 0.04/0.14/0.30/0.55/0.74/1.00 for 2 seconds on open ground, then repeat one representative magnitude into a solid obstacle. Capture world distance, actual speed, visual frame sequence, cycle count, projected foot screen position and camera state. Repeat with A/B/C visual phase policies using identical dt traces approximating 60/90/120 Hz where possible.

Include hard RIGHT->LEFT and LEFT->RIGHT reversals only as observational traces in this round: do not optimize reversal state yet. Capture mobile ~390x844 DPR2 and desktop ~1440x900. If real touch automation remains unreliable, drive the already-processed `input.normX/Y` in a test-only deterministic harness and label that as logical-input replay, not physical touch proof.

### DECIDING_METRICS
`worldPxPerAnimationCycle`; `footSlipPxPerContact`; `stridePhaseDeltaPerWorldPx`; `animationCyclesPer100WorldPx`; `visualWalkFramesBelow5PxPerSec`; `blockedMovementStrideAdvance`; `phaseAdvanceOnDuplicateRender` (target 0); `framesAdvancedPerLogicalStep`; `walkRunPhaseResetCount`; `reversalPosePopCount` observational only; `footAnchorScreenJitterP95`; frameTimeP95/P99; colliderOutcomeDiffCount (target 0).

Success direction: dramatically reduce variation in `worldPxPerAnimationCycle` across analog magnitudes, eliminate or sharply reduce full-walk cycling near ~4 px/s, produce zero/near-zero stride advance while physically blocked, preserve collider outcomes and max speed, and avoid new refresh-rate dependence at 60/90/120 Hz.

### RISKS
Distance phase tied directly to noisy post-collision micro-displacement can twitch near walls; threshold/hysteresis may be needed. A single stride length for walk and run can make one gait look unnatural. Too-high minimum-motion threshold can make slow analog movement look like gliding idle. Phase mapping at gait transitions can pop if frame semantics are not biomechanically compatible. Current 4-frame art may limit how much improvement is visible even with correct phase logic. Camera and integer destination rounding can still create screen-space jitter after world-space stride is fixed.

### EXPECTED_GROK_FEEDBACK
Classify P1-P6 independently against current main. If testing, report exact commit, trace/dt conditions, magnitude samples, before/after `worldPxPerAnimationCycle`, `visualWalkFramesBelow5PxPerSec`, `blockedMovementStrideAdvance`, `phaseAdvanceOnDuplicateRender`, frame-time P95/P99 and collider regression. Confirm whether the predicted near-threshold treadmill behavior is visible in Pages, and whether the current 4-frame art meaningfully benefits from distance phase before authoring 8+8 frames. Report any newer code path that changes `input.norm`, movement speed, visual state or avatar rendering and invalidates this analysis.

## CG-20260901-018 — MOV-004 per-step displacement threshold can reintroduce refresh-rate-dependent frozen feet

ID: CG-20260901-018
TIMESTAMP: 2026-09-01T15:35:34-04:00
AUTHOR: ChatGPT
BASE_COMMIT: e1b8b90afc433df5e9bc4488d48860a50238957c
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,input,touch,60hz,90hz,120hz,render,benchmark,bug,pages,playwright,architecture
AFFECTED_FILES: engine-ac.js, engine-a.js, engine-ah.js, engine-ab.js, ENGINE_MAP.md, index.html, docs/VISUAL_DIRECTION_MEMORY.md
RESPONDS_TO: CG-20260901-017 and live MOV-004 implementation at 452885d951ab9e256b4863581d0343021899bd8b / V5.42

### PROBLEM

MOV-004 correctly changed the local hero from wall-clock 130 ms frame stepping to distance-driven stride, but its current implementation discards every individual movement step whose post-movement displacement is <= 0.12 world px. That fixes tiny-noise/treadmill concerns only at the cost of making visual stride advancement depend on update frequency. A player can physically move while visual stride phase does not advance, especially at low analog magnitudes and high-refresh displays.

There is a second instrumentation issue: engine-ah is loaded after engine-ac and wraps updateMovement outside it. engine-ac publishes KELO_MOVEMENT_AUDIT before engine-ah applies its no-input hard stop, so audit.actualSpeed is not guaranteed to represent the final state at the end of the complete movement wrapper chain on release frames.

### CONFIRMED_IN_GEMINI

Current main is e1b8b90afc433df5e9bc4488d48860a50238957c. Its only change after V5.42 is documentation (`docs/VISUAL_DIRECTION_MEMORY.md`); runtime index remains `Kelo World — V5.42` with cache `v=93`.

In current `engine-ac.js`:
- `MIN_VISUAL_MOVE_PX = 0.12`.
- actual post-movement displacement is `dist = hypot(p.x-v.lastX, p.y-v.lastY)`.
- direction uses `dist > MIN_VISUAL_MOVE_PX` as one branch.
- crucially, stride uses `v.lastStepDistancePx = dist > MIN_VISUAL_MOVE_PX ? dist : 0`.
- stridePhase advances only when `lastStepDistancePx > 0`.
- WALK cycle is 50 world px and RUN cycle is 90 world px.
- collision prevention is otherwise conceptually sound: stride is based on post-collision world displacement, not input or render count.

The 0.12-per-update gate implies these equivalent minimum per-second displacements if update cadence tracks display refresh:
- 60 Hz: 0.12*60 = 7.2 px/s
- 90 Hz: 0.12*90 = 10.8 px/s
- 120 Hz: 0.12*120 = 14.4 px/s

Therefore the same slow analog movement can advance stride at one cadence and freeze it at another. This is a code-derived prediction until the 60/90/120 trace is measured.

Current `engine-a.js` confirms movement itself integrates velocity with `localPlayer.x += vx*dt` / `y += vy*dt`, so world displacement scales with dt. Input is normalized/curved independently of this visual threshold. Collider remains radius 20.

Current `engine-ah.js` is still an outer movement wrapper loaded after engine-ac. It calls its captured `_move(dt)` first, then, when there is no movement input, sets localPlayer.vx/vy and input.normX/normY to zero. Therefore engine-ac's `publishAudit()` currently occurs before the outer hard-stop mutation.

Current `engine-ab.js` remains a pure consumer for local-player `_visualMotion.frame`, but legacy NPC fallback still uses render-count `_walkHold` and Date.now()/130; do not generalize local MOV-004 verification to NPCs.

`ENGINE_MAP.md` remains stale in several relevant places: it still advertises V5.15/v66 and lists engine-m.js as hero owner while current PNG locomotion rendering is in engine-ab.js. This does not itself cause the stride bug, but it is an architecture-truth risk during debugging.

### EXTERNAL_EVIDENCE

1. MDN states requestAnimationFrame callback frequency generally follows display refresh and explicitly warns that progression must account for elapsed time or high-refresh screens change animation behavior. 60/75/120/144 Hz are common examples. This supports treating any fixed "pixels per update" discard threshold as suspicious when update frequency can vary.

2. Gaffer On Games' timestep analysis explains that simulation behavior can change with dt and recommends making time/update semantics explicit rather than assuming one refresh frequency. For Kelo World this does not imply an immediate fixed-timestep refactor; it does imply that movement/animation acceptance criteria must be invariant across tested dt values.

3. Unity root-motion documentation uses a root transform derived from body/feet motion so pose displacement and world displacement remain related; its Feet option anchors blending around the lowest foot to reduce floating. Kelo World is not using root motion, but the relevant principle is that contact animation should be driven by world-relative displacement rather than arbitrary frame count.

4. Godot documentation demonstrates animation playback tied to movement state/speed and delta-based movement. This supports keeping visual cadence coupled to actual locomotion rather than a constant per-render counter.

5. Community Unreal/gamedev reports consistently identify "skating" when animation travel does not match movement speed and recommend matching play rate/stride to actual movement speed. Counterevidence in those same discussions is useful: extreme speed-scaling can look mechanically or visually bad. Therefore Kelo should not force a mathematically perfect foot lock at every analog magnitude; use distance as the base signal, then stylistically clamp cadence only after measuring.

### HYPOTHESIS

Separate "is this displacement reliable enough to update facing direction?" from "did the player actually travel distance that should contribute to stride?".

The 0.12 threshold can remain provisionally for direction-vector noise rejection, but stride distance should not discard legitimate sub-0.12 movement every update. A tiny floating-point epsilon or a sub-threshold distance accumulator should preserve low-speed distance across 60/90/120 Hz while still producing zero stride when collision resolution leaves the player truly stationary.

Preferred first candidate:
- `directionDistThreshold = 0.12` stays for choosing dx/dy versus velocity/intent.
- `strideDistEpsilon` becomes a tiny numerical epsilon (candidate 1e-4 to 1e-3 world px), OR accumulate all finite positive `dist` into a remainder and only quantize presentation later.
- advance `stridePhase += actualPostCollisionDist / cyclePx`.
- do not use input magnitude itself to advance stride.
- keep blocked collision test: if post-collision position is unchanged, phase delta must be 0.

Do not pick the epsilon by intuition alone if collision solver produces measurable micro-jitter; measure stationary/collision displacement noise first.

### PROPOSED_CHANGE

P1 — Add deterministic cadence trace before changing MOV-004.
Run the same controlled low-speed movement sequence at dt approximating 1/60, 1/90 and 1/120. Log cumulative world distance, cumulative strideDistancePx, stridePhase and frame transitions.

P2 — Measure discarded legitimate distance.
Add audit-only counters (or test harness probes): `worldDistanceActual`, `worldDistanceCreditedToStride`, `worldDistanceDiscarded`, `strideCreditRatio`.
Expected healthy invariant away from collisions: credit ratio approximately 1.0 regardless of refresh/dt.

P3 — Split direction and stride thresholds.
If P1 reproduces the prediction, replace the per-step 0.12 stride gate with a numerical epsilon or accumulated-distance method while leaving direction noise handling separate.

P4 — Verify wall collision separately.
Hold RIGHT against a solid wall for >=1 second at 60/90/120-equivalent dt. `stridePhaseDelta` and `worldDistanceCreditedToStride` should remain approximately zero after collision settles.

P5 — Move or duplicate final audit publication to the outermost movement chain during tests.
Because engine-ah mutates velocity after engine-ac publishes its audit, add a final-state probe after all movement wrappers or explicitly log both `preHardStopSpeed` and `finalSpeed`. Do not refactor wrapper ownership blindly in the same experiment.

P6 — Only after refresh invariance passes, resume MOV-002 reversal work. Reversal presentation should not be tuned on top of cadence logic whose low-speed behavior varies by update rate.

### DO_NOT_ASSUME

- Do not call MOV-004 verified because CI or Pages deployment succeeds; those checks do not prove stride cadence quality.
- Do not assume 0.12 is harmless because it is a small world-space number; multiplied by update frequency it becomes a refresh-dependent speed floor.
- Do not remove the 0.12 direction threshold and stride threshold simultaneously; that would confound facing jitter with cadence behavior.
- Do not switch to fixed timestep solely to fix this bug. The local fix can be refresh-invariant even under variable dt if stride credits real post-collision distance correctly.
- Do not treat NPC animation as verified by local-player results; engine-ab's legacy path is still render-count/time-based.
- Do not change collider radius 20, camera, avatar scale, sprite sampling or atlas in this benchmark.

### EXPERIMENT

Baseline: current main runtime V5.42/v93 with MOV-004.

Trace A — unobstructed slow lateral:
1. Place Kelo in open space.
2. Feed a processed horizontal magnitude producing ~4, 8, 12 and 16 px/s target/steady travel where harness permits.
3. Run each for the same wall-clock duration at dt 1/60, 1/90, 1/120.
4. Log actual world distance and credited stride distance every logical update.
5. Compare total stridePhase progression and visual frame sequence.

Trace B — normal WALK and RUN:
1. RIGHT steady at representative walk magnitude.
2. RIGHT full magnitude/run.
3. Repeat at 60/90/120-equivalent dt.
4. Confirm cycle distances remain ~50 and ~90 world px without cadence-dependent loss.

Trace C — collision:
1. Move RIGHT into a representative wall until settled.
2. Keep RIGHT held 1 second.
3. Repeat at 60/90/120-equivalent dt.
4. Confirm post-settle phase does not advance.

Trace D — stop/release audit truth:
1. Move RIGHT steady.
2. Release input.
3. Capture engine-ac audit timing and final localPlayer velocity after engine-ah wrapper returns.
4. Confirm whether current `KELO_MOVEMENT_AUDIT.actualSpeed` differs from final speed on the release frame.

Then implement only the smallest threshold split if Trace A fails invariance, rerun identical traces, and compare.

### DECIDING_METRICS

- `worldDistanceActualPx`
- `worldDistanceCreditedToStridePx`
- `worldDistanceDiscardedPx`
- `strideCreditRatio`
- `stridePhaseDeltaPer100WorldPx`
- `visualFrameTransitionsPer100WorldPx`
- `lowSpeedFrozenStrideMs`
- `blockedMovementStrideAdvancePx`
- `refreshRateStridePhaseDeltaPct` comparing 60/90/120
- `finalSpeedAfterMovementChain`
- `auditSpeedVsFinalSpeedError`
- `colliderRadius` must remain 20
- console/page error count
- exact commit and Pages build identity

Pass target for the threshold fix candidate:
- unobstructed stride credit ratio near 1.0 across all three dt conditions (allow tiny floating error);
- refreshRateStridePhaseDeltaPct near 0 for equal actual world distance;
- blockedMovementStrideAdvancePx near 0 after collision settles;
- no collider/camera/gameplay semantic changes.

### RISKS

- Crediting every tiny `dist` can turn collision-resolution or floating-point jitter into microscopic stride creep if stationary world coordinates oscillate. Measure noise before choosing epsilon.
- An accumulated-distance approach can preserve sub-threshold movement correctly but needs clear reset semantics on teleport/zone transitions to avoid carrying old distance into a new scene.
- Changing cadence thresholds before final movement-chain telemetry is trustworthy can create false confidence from pre-hard-stop measurements.
- A perfect mathematical distance lock can look stiff at extreme analog speeds; after invariance is correct, a stylistic minimum/maximum cadence may still be desirable, but it must be defined in world-distance/time terms rather than frames-per-update.

### EXPECTED_GROK_FEEDBACK

Classify P1-P6 independently. If testing, report exact main/base commit, whether update cadence is actually coupled to rAF or otherwise controlled in the current loop, and the real 60/90/120-equivalent results. Confirm or refute the predicted 7.2/10.8/14.4 px/s effective stride-credit floor. Report stationary/collision displacement noise before selecting epsilon. Also verify the engine-ac vs engine-ah audit ordering on input release. Do not implement reversal or avatar scaling in the same change unless this cadence invariant is first demonstrated.

## CG-20260901-019 — Low-speed lateral reversal can flip the sprite before travel reverses, and the trigger path changes with refresh cadence

ID: CG-20260901-019
TIMESTAMP: 2026-09-01T16:36:06-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 7a21dab4483dbf0ec0f6aa614bfc8d4b544cbf29
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,input,joystick,touch,60hz,90hz,120hz,render,benchmark,bug,architecture
AFFECTED_FILES: engine-a.js, engine-ac.js, engine-ab.js, engine-ah.js, index.html, ENGINE_MAP.md, docs/VISUAL_DIRECTION_MEMORY.md
RESPONDS_TO: CG-20260901-018 and current MOV-001+MOV-004 locomotion state

### PROBLEM

The current local-player facing policy mixes three different direction sources during lateral movement: actual post-movement displacement, current physical velocity, and finally raw processed input intent. This works reasonably at normal speed, but during a hard LEFT<->RIGHT reversal it can make presentation contradict physics at low analog speeds: the sprite can face the new input direction while the player is still physically traveling in the old direction. Which fallback source wins also changes with update cadence because the displacement branch uses a fixed 0.12 world-px-per-update threshold.

This is especially visible-risky for the user's current goal of premium planted lateral locomotion. A larger avatar will amplify the perceived moonwalk/pop if the torso and legs mirror before travel actually changes direction.

### CONFIRMED_IN_GEMINI

Current main is `7a21dab4483dbf0ec0f6aa614bfc8d4b544cbf29`. `index.html` is `Kelo World — V5.43` / cache `v=94`. The V5.43 runtime change is the environment TileRegistry migration; `engine-ac.js`, `engine-ab.js`, `engine-ah.js`, and base movement semantics remain compatible with the prior MOV-004 analysis.

`engine-a.js` currently:
- uses `CONFIG.accelDecay = 18.0`;
- exponentially approaches target velocity using `factor = 1 - exp(-decay*dt)`;
- integrates position using `localPlayer.x += localPlayer.vx*dt` and y equivalent;
- keeps localPlayer collider radius 20;
- produces keyboard full-magnitude input and curved analog touch input.

`engine-ac.js` currently:
- computes post-movement `dx/dy` and `dist`;
- defines `MIN_VISUAL_MOVE_PX = 0.12`;
- chooses visual direction source in this order:
  1. if `dist > 0.12`, use actual post-movement dx/dy;
  2. else if physical speed `> 16`, use vx/vy;
  3. else if there is movement intent, use `input.normX/Y`;
- updates face immediately from the selected vector with no explicit reversal state;
- keeps `stridePhase` through the reversal and maps it directly to one of four frames;
- mirrors the same side row for LEFT in `engine-ab.js`.

For a symmetric full-speed reversal from +V to -V under the current exponential acceleration, continuous physical velocity crosses zero after:
`ln(2) / 18 = ~38.5 ms`.

A discrete code-model using the current formulas predicts full-speed visual facing changes at approximately:
- 60 Hz: ~50.0 ms, using actual displacement;
- 90 Hz: ~44.4 ms, using actual displacement;
- 120 Hz: ~41.7 ms, but the deciding branch can already be the input fallback because the per-update dx becomes <0.12 and speed <16 near zero.

More importantly, at low steady lateral speeds the current fallback can flip BEFORE physical travel reverses. Code-derived examples for a symmetric reversal:
- ~4 px/s: sprite direction can flip on the first update at 60/90/120 while vx is still positive;
- ~8 px/s: same first-update early flip while vx is still positive;
- ~12 px/s: same first-update early flip while vx is still positive;
- ~16 px/s: predicted flip timing differs by cadence: ~33.3 ms at 60 Hz but first update (~11.1 / 8.3 ms) at 90/120, still while vx remains positive.

These are deterministic predictions from the current code path, not live screenshot/video measurements yet.

`engine-ab.js` consumes `_visualMotion.face` and, for LEFT, mirrors the entire sprite immediately with `scale(-1,1)`. It does not have a dedicated turn pose, planted-foot metadata, contact-foot mapping, or phase remap on reversal.

`engine-ah.js` remains a later wrapper that hard-stops vx/vy only when no movement input exists. During a hard reversal, input remains active, so the contradiction above is owned primarily by `engine-ac` direction-source selection rather than the release hard-stop.

`ENGINE_MAP.md` remains stale (V5.15/v66, hero owner mismatch), while current PNG locomotion is in `engine-ab.js`. Treat actual code as authoritative.

### EXTERNAL_EVIDENCE

1. Unity's official animation-transition documentation exposes transition interruption, exit timing, transition offset and normalized-time controls specifically because animation-state changes often need presentation timing independent of the instant a logical condition changes. This supports an explicit reversal presentation state rather than blindly mirroring on the first new input sample.

2. Unity's official Animation+Navigation coupling example drives locomotion from velocity parameters and includes a run-on-the-spot center clip partly to reduce foot sliding during blends. The relevant principle for Kelo World is that presentation direction/speed should track actual motion state, not only desired input direction.

3. A Godot advanced-movement community implementation explicitly lists orientation warping, stride warping, stop animation and rotate-in-place with foot locking as separate concerns. This is useful counterevidence against trying to solve all reversal quality with a single sprite flip.

4. Reddit/Unity2D reports of rapid direction switching describe glitchy/sliding behavior when direction state changes too eagerly; one recurring fix is to separate animator transition timing/conditions from raw key state. Community evidence is anecdotal, so it should guide experiments, not dictate constants.

5. A recent Unity controller discussion reports that a previous iteration's flip->walk transition suffered foot misalignment and that improved turn handling used a guided rotation/root-motion approach. Kelo World should not copy root motion, but the failure mode is directly relevant: instant visual inversion plus unchanged gait phase can make feet appear to teleport or swap contact.

Counterevidence / caution:
- Delaying facing until an animation cycle finishes can feel sluggish and make the character appear to move backward for too long.
- A fixed 100+ ms turn animation may be excessive for Kelo World's responsive top-down control.
- Therefore the solution should be a short, measured reversal bridge tied to physical zero-cross/contact, with a hard maximum latency, not an unconditional cinematic turn animation.

### HYPOTHESIS

Separate three concepts explicitly:
- `intentDirection`: where the player is asking to go now;
- `travelDirection`: sign/direction of actual post-collision movement/velocity;
- `visualFacing`: presentation direction shown by the sprite.

For a hard lateral reversal, visualFacing should not be allowed to jump to the new intent merely because displacement falls below the 0.12 threshold. It should remain aligned with the old travel direction until physical reversal is established, then flip at a safe presentation point.

A promising minimal policy for the current 4-frame asset is:
1. detect reversal intent when intentX and established travelX have opposite signs above a small intent threshold;
2. enter a short `reversal` presentation state without changing physics;
3. while travel velocity/displacement still has the old sign, keep old visualFacing;
4. when travel crosses zero and establishes the new sign, allow the facing flip;
5. initially preserve stridePhase rather than resetting it, then benchmark whether a contact-preserving frame remap is needed;
6. impose a small maximum presentation bridge (candidate range 40-80 ms, to benchmark, not a chosen constant) so low-speed edge cases cannot feel sticky.

Because the current 4-frame sheet has no verified contact-foot metadata, do NOT assume frame 0 or frame 2 is a safe contact pose. First benchmark a physics-zero-cross-only variant; inspect actual frame sequence before adding phase remapping.

### PROPOSED_CHANGE

P1 — Instrument reversal without changing feel.
Add audit fields or a harness probe for `intentX`, `vx`, post-movement `dx`, directionSource (`dist|velocity|intent`), `visualFacing`, `stridePhase`, `visualFrame`, and reversal timestamps.

P2 — Deterministic same-trace matrix.
From steady RIGHT, issue full LEFT and repeat from steady LEFT to RIGHT at 60/90/120-equivalent dt. Repeat at low, walk, and run magnitudes. Measure physical velocity zero-cross, displacement sign change, facing-flip time, and source branch.

P3 — Candidate B: travel-gated facing.
During explicit opposite-sign lateral intent, disallow the `intent` fallback from flipping visualFacing while actual travel still has the old sign. Physics remains untouched.

P4 — Candidate C: short reversal bridge.
If Candidate B removes moonwalk but still produces a one-frame leg/body pop, add a presentation-only reversal state with a bounded bridge around zero-cross. Do not reset stride phase blindly.

P5 — Contact-aware remap only after sprite inspection.
If frame-by-frame capture shows the mirrored phase swaps the planted foot visibly, define contact metadata for the current 4-frame row or wait for the validated 8+8 atlas. Compare phase-preserve vs nearest-contact remap on the same trace.

P6 — Do not combine this with avatar scaling, camera reversal, direction-family hysteresis or sampling changes. Those are separate experiments.

### DO_NOT_ASSUME

- Do not assume `input.normX` is the correct facing direction during deceleration/reversal; it is intent, not current travel.
- Do not assume current full-speed reversal is already broken visually; at high speed current displacement gating mostly tracks travel. The strongest predicted bug is low-speed/threshold-edge behavior.
- Do not assume a fixed turn-animation duration is desirable.
- Do not reset `stridePhase = 0` on every reversal without measuring; that can create a visible leg pop of its own.
- Do not alter acceleration/deceleration physics to make the sprite animation easier.
- Do not modify collider radius 20.
- Do not infer player results apply to NPCs; NPC fallback remains legacy/time-based.
- Do not mark this fixed from CI/Pages deployment alone.

### EXPERIMENT

Baseline: current `main` V5.43/v94, commit `7a21dab4483dbf0ec0f6aa614bfc8d4b544cbf29`.

Trace R1 — full-speed reversal:
1. Open unobstructed area.
2. Hold RIGHT until vx is within a small tolerance of steady speed.
3. Switch directly to LEFT without neutral frame.
4. Log every update until stable LEFT.
5. Repeat LEFT->RIGHT.
6. Run at dt 1/60, 1/90, 1/120.

Trace R2 — low-speed analog reversal:
Repeat R1 with processed magnitudes producing representative ~4, 8, 12, 16, 50 and 100 px/s steady travel where the harness can control them. The key failure is any interval where `sign(visualFacing) != sign(actualTravel)` while actual travel magnitude is meaningfully nonzero.

Trace R3 — phase/pop capture:
For each reversal, record `stridePhase` and `visualFrame` immediately before and after facing flip and capture a tight sprite-region screenshot sequence. Count apparent contact-foot swaps / one-frame pose pops.

Trace R4 — Candidate B:
Implement only travel-gated facing, rerun R1-R3 identically.

Trace R5 — Candidate C only if needed:
Add bounded reversal bridge around zero-cross, rerun same traces. Reject it if input-to-facing latency becomes perceptibly sluggish without reducing pop/slip.

### DECIDING_METRICS

- `reversalIntentAtMs`
- `travelVelocityZeroCrossMs`
- `postMovementDxZeroCrossMs`
- `visualFacingFlipMs`
- `facingLeadBeforeTravelReverseMs` (must be <= 0 outside negligible near-zero region)
- `facingLagAfterTravelReverseMs`
- `directionSourceAtFacingFlip`
- `reversalPosePopCount`
- `contactFootSwapCount` when visually identifiable
- `stridePhaseBeforeFlip`
- `stridePhaseAfterFlip`
- `visualFrameBeforeFlip`
- `visualFrameAfterFlip`
- `refreshRateFacingFlipDeltaMs`
- `inputToStableOppositeFacingMs`
- `collisionOutcomeDiffCount` must remain 0
- `colliderRadius` must remain 20
- frame-time P95/P99 should not regress materially

Candidate pass direction:
- no meaningful interval where sprite faces opposite actual travel before physical reversal;
- facing changes promptly after actual reversal, with bounded low refresh/high refresh difference;
- no increase in collision differences;
- reduced or zero visible one-frame reversal pop on repeated captures;
- no physics-speed change.

### RISKS

- Using velocity sign alone near zero can chatter because tiny values change sign; use explicit reversal state and/or a small physical threshold/hysteresis rather than `vx === 0` logic.
- A delayed facing flip can feel like backward skating if the delay extends beyond actual travel reversal.
- A contact remap without verified source-frame semantics can be worse than preserving phase.
- The current MOV-004 0.12 stride-credit issue from CG-018 remains unresolved and can contaminate very-low-speed frame cadence; reversal experiments should log it and avoid declaring complete locomotion quality until both issues are settled.
- Future larger avatars magnify reversal errors, so this should be validated before the scale ladder.

### EXPECTED_GROK_FEEDBACK

Classify P1-P6 independently. Reproduce the low-speed opposite-facing prediction before modifying gameplay. Report exact dt/cadence, steady speed, velocity zero-cross, facing flip time and which direction source caused the flip. Confirm or refute the code-derived low-speed first-update flip. If implementing a travel-gated facing candidate, keep physics and collider unchanged and provide before/after frame traces or screenshots. Do not add a contact-phase remap unless the current 4-frame sprite's contact semantics are actually inspected and documented.

## CG-20260901-020 — Stateless 4-direction classification can chatter near diagonals and collision slides; benchmark a presentation-only hysteresis band

ID: CG-20260901-020
TIMESTAMP: 2026-09-01T17:33:44-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 1b1af84300163ec9d2fcf5de8acacb8d3e9ef938
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,input,joystick,touch,60hz,90hz,120hz,render,benchmark,bug,playwright
AFFECTED_FILES: engine-ac.js, engine-ab.js, engine-a.js, tests/kelo-live.spec.js, ENGINE_MAP.md, docs/IMPLEMENTATION_ROADMAP.md
RESPONDS_TO: CG-20260901-014, CG-20260901-018, CG-20260901-019

### PROBLEM
The current local-player presentation direction is a stateless 4-way classifier. `engine-ac.js` chooses SIDE when `abs(dx) * 1.15 >= abs(dy)` and otherwise chooses vertical. That creates one hard boundary near 49 degrees from horizontal with no hysteresis. Analog thumb noise, velocity/displacement changes, or collision-induced changes to the post-collision travel vector can therefore make the visual family flip SIDE<->VERTICAL repeatedly even when the player's intended direction changes only slightly. This is a presentation problem; the physical movement vector must remain untouched.

### CONFIRMED_IN_GEMINI
- Live `main` was re-read before this entry. Base commit is `1b1af84300163ec9d2fcf5de8acacb8d3e9ef938`.
- `index.html` currently loads the movement/render chain including `engine-ab.js`, `engine-ac.js`, then later `engine-ah.js`; the cached runtime observed during this round was V5.43/v94, while later environment-only documentation on main records V5.44 validation. Do not infer movement changes from that environment work.
- `engine-ac.js` owns local update-side visual state. Direction source priority is post-collision displacement when `dist > 0.12`, then physical velocity when `speed > 16`, then processed input when intent remains.
- The actual family decision is stateless: `side = abs(v.dx) * 1.15 >= abs(v.dy)`.
- Algebraically the current SIDE boundary is `abs(dx)/abs(dy) >= 1/1.15 = 0.869565...`, i.e. approximately 48.99 degrees from horizontal. There is no enter/exit band.
- `engine-ab.js` consumes `visualMotion.face` directly and mirrors the same side row for LEFT. A family flip therefore changes sprite row immediately; there is no diagonal blend animation or transition state.
- `engine-a.js` normalizes keyboard diagonals to a clean unit vector, while analog/touch can provide a continuum of angles. Therefore the chatter risk is primarily analog and collision/travel-vector driven, not repeated pure keyboard 45-degree input alone.
- Collision resolution in `engine-a.js` is axis-separated. During a diagonal scrape against blocking geometry, one displacement component can be suppressed while the other remains, which can rotate the post-collision travel vector across the visual family boundary even if the input vector itself remains stable.
- `tests/kelo-live.spec.js` is stale for current movement research: defaults still point to Pages `?v=69`, title V5.18, and its pointer-drag path previously measured zero movement. It does not expose a deterministic analog angle sweep or current `KELO_MOVEMENT_AUDIT` direction fields.
- `ENGINE_MAP.md` and `docs/IMPLEMENTATION_ROADMAP.md` are stale relative to production movement: roadmap still lists MOV-001/MOV-004 as PENDING even though their code exists, and ENGINE_MAP still names obsolete version/hero ownership. Treat live code as authority.

### EXTERNAL_EVIDENCE
- Unity's official 2D Blend Tree documentation says 2D Simple Directional is intended for directional motions such as forward/back/left/right. This supports treating animation direction as an explicit presentation dimension rather than conflating it with every instantaneous movement-vector fluctuation.
- Godot's official AnimationTree documentation describes BlendSpace2D and specifically notes that frame-by-frame 2D animation may use Discrete mode (or Carry to retain play position). This is relevant because Kelo's sprite-sheet presentation is discrete; smoothing should happen in the direction-state decision, not by visually interpolating incompatible sprite rows.
- Recent and historical Godot community reports describe diagonal animation ambiguity and recommend keeping a separate animation-direction/current-direction variable instead of blindly feeding the raw movement vector into animation selection. Community evidence is not authoritative, but it matches the failure mode visible in Gemini.
- Counterevidence: too much hysteresis can make a character feel stubborn, continuing to face sideways after the thumb has clearly moved vertical. Therefore hysteresis width must be benchmarked, not assumed.

### HYPOTHESIS
A small stateful Schmitt-style band on visual direction family will reduce SIDE<->VERTICAL chatter without affecting physics, attack vector, joystick magnitude, collision, or speed. A promising first candidate is:
- if the current visual family is SIDE, remain SIDE until `abs(dy)/abs(dx) > 1.30` (about 52.4 degrees from horizontal);
- if the current visual family is VERTICAL, enter SIDE only when `abs(dy)/abs(dx) < 1.00` (below 45 degrees from horizontal).
This creates roughly a 7.4-degree state-dependent hold band. These numbers are hypotheses, not validated constants.

A second hypothesis is that family hysteresis should operate on a clearly selected presentation direction source after the reversal work separates intent/travel/facing. Applying hysteresis before fixing reversal could hide one symptom while preserving the intent-vs-travel contradiction documented in CG-019.

### PROPOSED_CHANGE
Do not change production gameplay in this research round.

First extend audit/test capability so a deterministic direction sweep can be replayed without relying on the currently broken pointer-drag emulation. Add/read-only telemetry for:
- directionSource (`displacement`, `velocity`, `intent`);
- raw presentation vector x/y;
- current visual family (`side`/`vertical`);
- visual facing;
- family-switch count.

Then compare:
A. Baseline stateless `*1.15` classifier.
B. Symmetric narrow hysteresis around the existing ~49-degree boundary.
C. Candidate stateful band: vertical->side below 45 degrees, side->vertical above ~52.4 degrees.

Keep the physical input vector and collider exactly unchanged. Do not add 8-direction art yet.

### DO_NOT_ASSUME
- Do not assume every family switch near a wall is wrong; if actual travel genuinely changes direction, a visual change may be desirable.
- Do not assume the proposed 45/52.4-degree band is optimal.
- Do not use a time debounce alone as the first solution; it can add latency and still behave differently under rapidly changing analog input.
- Do not use render-frame count as hysteresis state or timing.
- Do not modify attack/aim direction as part of this presentation experiment.
- Do not claim touch validation from the old Playwright mouse drag path.
- Do not advance avatar scale while diagonal facing stability is still unknown; larger sprites amplify row-pop/chatter.

### EXPERIMENT
Baseline -> one change -> same trace -> re-measure.

Trace 1: synthetic analog angle sweep at constant processed magnitude (e.g. 0.8):
- hold 35 degrees for 500 ms;
- sweep slowly 35->60 degrees over 1.5 s;
- hold 60 degrees 500 ms;
- sweep back 60->35 degrees over 1.5 s.
Run dt sequences approximating 60, 90 and 120 Hz.

Trace 2: noisy boundary hold:
- center near 49 degrees;
- inject deterministic +/-0.5, +/-1.0 and +/-2.0 degree perturbations;
- identical perturbation sequence at 60/90/120 Hz.

Trace 3: collision scrape:
- stable diagonal input into a representative vertical wall/corner;
- record intent vector, post-collision displacement vector, velocity, source, family and face before/during/after contact.

Trace 4: keyboard regression:
- RIGHT, UP, 45-degree RIGHT+UP, release one key, release all;
- verify physical normalization and speed remain unchanged.

If a reliable touch harness becomes available, replay a real thumb arc after deterministic synthetic traces; synthetic input is not a substitute for touch ergonomics.

### DECIDING_METRICS
- `directionFamilySwitchesPerSecond` near boundary.
- `falseDiagonalPoseSwitchCount` for deterministic noise where the intended family should remain stable.
- `familySwitchAngleEnterSideDeg` and `familySwitchAngleEnterVerticalDeg`.
- `familySwitchAngleVarianceDeg` across 60/90/120 Hz.
- `collisionInducedFamilySwitchCount` and whether each switch matches sustained actual travel.
- `visualFacingChangesPerSecond`.
- `inputVectorDifferenceBeforeAfter = 0` for presentation-only variants.
- `collisionOutcomeDiffCount = 0`.
- `maxSpeedDiff = 0`.
- no new runtime/page errors.

Pass target for the first benchmark: materially lower spurious family switches than A, no measurable physics/collision difference, and no visibly delayed legitimate 90-degree turn. Do not define DONE solely from switch count.

### RISKS
- A band that is too wide can feel sticky and make legitimate diagonal-to-vertical turns late.
- Using post-collision displacement as the presentation vector can cause valid but visually surprising orientation changes while scraping props; using intent instead can cause skating against walls. This tradeoff must be observed, not solved by assumption.
- Existing reversal behavior (CG-019) can contaminate direction-family metrics if sign reversal and family transition happen simultaneously.
- MOV-004's per-update 0.12 displacement threshold (CG-018) can change which source feeds the direction classifier across refresh rates; the benchmark must log `directionSource` or results will be ambiguous.
- Current live test harness is stale and its pointer drag is not a valid analog proof.

### EXPECTED_GROK_FEEDBACK
Please independently classify the proposal. Highest-value feedback is not a code-only patch; it is evidence from the same deterministic angle/noise/collision traces. Report:
1. whether a reproducible family chatter exists on current main;
2. exact switch angles and counts for A/B/C;
3. whether collision scraping creates switches that are visually correct or noisy;
4. whether results differ at 60/90/120 Hz because the source selector changes;
5. whether the harness can inject processed analog vectors directly without modifying gameplay behavior;
6. whether the proposed hysteresis should wait until MOV-002 reversal separation is in place;
7. any simpler state model that preserves responsiveness with fewer magic thresholds.

## CG-20260901-021 — Formalize a foot-root contract before avatar scale-up; current PNG override loses the base shadow and plaza repaint still draws actors above all props

ID: CG-20260901-021
TIMESTAMP: 2026-09-01T18:33:45-04:00
AUTHOR: ChatGPT
BASE_COMMIT: caeab30a7eb5c66e845a3d2f2226f1bc28f65eb7
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,collision,camera,hd2d,canvas2d,benchmark,mobile,architecture
AFFECTED_FILES: engine-a.js,engine-ab.js,engine-l.js,engine-v.js,docs/VISUAL_DIRECTION_MEMORY.md
RESPONDS_TO: CG-20260901-015,CG-20260901-020

### PROBLEM
Before increasing the hero from the current ~48x81 lateral presentation toward 54x81 / 62x93 / 68x102, Kelo needs a stable semantic ground-contact point. The current production PNG renderer defines `footY = p.y + 10`, but the base renderer's contact shadow is bypassed by the PNG override, nameplate position is derived directly from sprite height, and the plaza repaint draws a single baked `propLayer` before repainting every actor. Scaling now would enlarge visible overlap errors without changing the physical collider.

### CONFIRMED_IN_GEMINI
- `localPlayer.radius` is still 20 in `engine-a.js`; collision is circle-vs-AABB and independent of the PNG draw size.
- Base `engine-a.js::renderAvatar` draws a shadow ellipse centered at `(p.x, p.y + 14)` with radii `p.radius*0.9` and `p.radius*0.45`.
- `engine-ab.js` overrides `renderAvatar` and, on the PNG path, never calls the base renderer, so that base ellipse shadow is not inherited.
- The PNG renderer uses a de-facto foot root `footY = p.y + 10`, draws lateral width 48 / front-back width 54, derives height from source aspect ratio, and puts the nameplate at `footY - dh - 6`.
- `engine-v.js` is effectively empty and explicitly says scale is absorbed into `engine-ab` draw size so feet stay planted; there is no first-class `visualScale`, `footRoot`, `visualBounds`, `shadowAnchor`, or `nameplateAnchor` contract.
- `engine-l.js` currently draws `floorLayer`, `transitionLayer`, then the entire baked `propLayer`, then repaints simulated players and local player. Therefore actors are always repainted over plaza props regardless of their foot Y.
- `engine-l.js` applies `CONFIG.zoom` around the whole world-space repaint. Because the nameplate is drawn inside `renderAvatar`, its 11px font is also world-scaled by zoom instead of remaining a stable CSS/UI size.
- Current visual-direction memory already prefers render layers `props_back -> actors -> props_front -> UI`, which the live plaza renderer does not yet implement.

### EXTERNAL_EVIDENCE
- Godot YSort documentation: higher-Y 2D children are drawn later, a standard top-down depth model; this supports using a semantic ground-contact/foot Y rather than sprite top or animated bob as depth key. https://docs.godotengine.org/en/3.1/classes/class_ysort.html
- Unity sprite documentation describes Y-axis sprite sorting as common for 2D games where lower sprites should appear in front. https://docs.unity3d.com/es/2021.1/Manual/Sprites.html
- Godot Sprite2D exposes centering and offset independently from node position, supporting the architectural separation between gameplay/world root and visual sprite offset. https://docs.godotengine.org/en/4.5/classes/class_sprite2d.html
- MDN confirms Canvas2D `drawImage()` supports independent destination rectangle scaling, so increasing presentation size does not require changing world/collider coordinates. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
- MDN confirms `imageSmoothingEnabled=false` preserves hard pixel edges when scaling, but MDN's pixel-art guidance warns non-integer CSS/device-pixel mapping can create uneven pixels at non-integer DPR/zoom. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled and https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look
- Community counterevidence: pure Y-sort is not universally sufficient for bridges, stairs, and large irregular props; some objects require explicit front/back layer splitting or custom occlusion logic. Reddit examples: r/gamedev 2D pivot sorting and Y-sort discussions.

### HYPOTHESIS
A first-class foot-root contract will let Kelo become visually larger without changing collision or causing floating/bobbing depth errors. The correct architecture is likely:
`physicsRoot(x,y) -> footRoot(x,y+offset) -> visualRect/pivot -> shadowAnchor -> sortY -> nameplateAnchor`.
Bob/lean should modify only visual sprite offset, never the physics root, foot root, collider, shadow anchor, or sortY. The contact shadow should remain centered on the foot root and can change width/alpha subtly with gait, but should not follow body bob.

### PROPOSED_CHANGE
Do NOT scale the hero yet. First benchmark a presentation-only contract with no visible size change:
1. Add a read-only helper/state for `footRootX`, `footRootY`, `sortY`, `visualTopY`, `visualBottomY`, `visualWidth`, `visualHeight` using the current 48/54-wide dimensions and current foot offset.
2. Draw exactly one contact shadow from the PNG path, anchored to foot root, preserving collider 20.
3. Keep body bob/lean future transforms above the foot-root transform so contact remains planted.
4. Move nameplate positioning to an explicit anchor rather than directly coupling it to `dh`; eventually project it to screen/UI space, but test separately.
5. In a later isolated depth experiment, split plaza props into back/front or dynamic occluders keyed by prop base Y; do not globally Y-sort the whole baked scene.
6. Only after the anchor contract passes, run the visual scale ladder: 48x81 -> 54x81 aspect-correct -> 62x93 -> 68x102 -> 70x105, collider fixed at 20.

### DO_NOT_ASSUME
- Do not assume `p.y+10` is the final artistic pivot; it is only the current de-facto contact coordinate.
- Do not assume one Y key can correctly sort the whole fountain/tree/stair-like geometry; irregular props may require split layers or occlusion regions.
- Do not assume the missing PNG shadow is necessarily visually worse until an A/B screenshot is inspected; a badly sized dark ellipse can make the hero look sticker-like.
- Do not increase collider radius with sprite size.
- Do not move nameplates, combat hitboxes, camera target, or network position as a side effect of visual scaling.
- Do not replace Canvas2D/WebGL architecture for this problem; current issue is coordinate/layer semantics, not API throughput.

### EXPERIMENT
Baseline trace on current live version, then one change at a time:
A. current PNG renderer (no PNG-path contact shadow), current size.
B. same size + explicit foot-root fields only; pixel output should remain identical.
C. same size + one anchored ellipse/contact shadow.
D. same size + shadow while standing, walking RIGHT/LEFT, hard reversal, diagonal slide, collision with wall.
E. depth test: pass above/below representative tree/column/bench/fountain using foot-root sort candidate, without touching collision.
F. after all anchor/depth metrics pass, run scale ladder 54x81, 62x93, 68x102 and inspect mobile/desktop at min/max zoom and DPR buckets.
For each stage use the same capture positions and movement trace. Test 60/90/120Hz where locomotion is involved.

### DECIDING_METRICS
- `colliderRadius`: exactly 20 throughout presentation experiments.
- `footRootWorldDriftPxP95`: 0 from visual-only bob/scale transforms.
- `footToShadowCenterErrorPxP95`: target <= 1 CSS px after projection.
- `shadowDrawsPerAvatarPerRAF`: target exactly 1 visible contact shadow per final actor presentation.
- `avatarDrawsPerActorPerRAF`: measure current duplicate repaint before depth refactor; no unexplained increase.
- `sortKeyChangesFromBobCount`: target 0.
- `actorDepthOrderErrorCount` on above/below prop trace: target 0 for supported props.
- `nameplateGapCssPxMinMax` and `nameplateFontCssPxMinMax` across zoom 1.05-1.45.
- `visualRectToViewportAreaRatio` at each scale candidate.
- `collisionOutcomeDiffCount`: target 0 versus baseline.
- frame-time P95/P99 and JS heap/GC: no material regression.
- screenshot inspection at representative mobile viewport and desktop.

### RISKS
- Drawing the shadow in both a base pass and PNG pass can produce duplicate shadows if wrapper order changes.
- Foot-root Y and base shadow currently disagree (`p.y+10` vs `p.y+14`); choosing one without an A/B can visually shift grounding.
- Scaling nameplates inside world zoom makes readability inconsistent; moving them to screen-space is correct architecturally but should be a separate change to avoid conflating results.
- Large props baked into one `propLayer` cannot be correctly interleaved with actors by a single later repaint; proper occlusion may require asset/layer restructuring.
- Non-integer zoom/DPR can make larger nearest-neighbor sprites shimmer even if world foot root is stable; sampling policy must be benchmarked separately.

### EXPECTED_GROK_FEEDBACK
Classify the foot-root contract and single anchored shadow as VIABLE / NEEDS_TEST / NOT_VIABLE against current `main`. If testing, report exact current actor draw count per RAF, whether adding a PNG-path shadow creates duplicates, current projected foot/shadow error, and whether `p.y+10` or `p.y+14` better matches visible soles in the current hero frames. Do not scale the hero or rewrite depth architecture in the same implementation. If depth is evaluated, identify which plaza props can use one base-Y key and which require split back/front layers.

## CG-20260901-022 — Avatar enlargement is currently coupled to anisotropic side scaling, world-pixel snapping, zoom-scaled nameplates, and a second actor repaint

ID: CG-20260901-022
TIMESTAMP: 2026-09-01T19:34:28-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 85ae3f871ed56c0754ecdbdee760cc67b5c4de99
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,canvas2d,textures,atlas,shadow,camera,benchmark,60hz,90hz,120hz,architecture,pages
AFFECTED_FILES: engine-ab.js, engine-l.js, engine-z.js, engine-v.js, ENGINE_MAP.md, docs/VISUAL_DIRECTION_MEMORY.md
RESPONDS_TO: user priority to enlarge Kelo while preserving premium lateral motion, collisions, camera, occlusion, readability, FPS and sprite quality

### PROBLEM

The environment has advanced to the validated cleaner V5.44 visual direction, but the live hero presentation contract is still the older Canvas2D path. Enlarging the hero by only changing `dw/dh` would magnify several existing presentation defects at once: side-view aspect distortion, integer world snapping before camera/zoom transforms, a nameplate that scales with world zoom, and plaza repaint ordering that redraws actors after a single monolithic prop layer. These concerns need to be separated before the 62x93 / 68x102 scale ladder can be trusted.

### CONFIRMED_IN_GEMINI

At `BASE_COMMIT`:

1. `engine-ab.js` remains the effective PNG hero override despite stale `ENGINE_MAP.md` metadata naming `engine-m.js` as hero owner.
2. Each source frame is dynamically derived as `FW = sheet.width / 4` and `FH = sheet.height / 4`, then cropped by `padX = FW*0.05` and `padY = FH*0.04` before drawing.
3. Destination size is `48 x dh` for left/right and `54 x dh` for up/down, with `dh = round(54 * FH/FW)`. For a 2:3 frame contract this is approximately 48x81 lateral and 54x81 vertical.
4. Because the source crop removes 5% from each horizontal edge and 4% from each vertical edge, the cropped-frame aspect ratio is about `(0.90*FW)/(0.92*FH)`. Under a 2:3 frame ratio this is ~0.652. A height of 81 would therefore be aspect-correct at ~52.8 px width. The current lateral width 48 is about 9% narrower than that cropped-source aspect, while 54 is slightly wider. This means the lateral presentation is not just smaller; it is anisotropically compressed.
5. Sprite destination X/Y are rounded in world space with `Math.round(...)` before the plaza camera transform. `engine-l.js` later applies `ctx.scale(CONFIG.zoom)` where `engine-z.js` allows zoom 1.05–1.45. Therefore a one-world-pixel snap can become a 1.05–1.45 CSS-pixel screen jump before DPR mapping.
6. `engine-l.js` owns HiDPI backing-store scaling and caps DPR at 3, then performs an additional world zoom transform. On the validated mobile audit the canvas was 390x844 CSS backed by 780x1688 pixels (DPR 2).
7. `engine-ab.js` sets `imageSmoothingEnabled=false` for the sprite draw, which preserves hard edges but does not guarantee visually uniform pixels after arbitrary world zoom + DPR mapping.
8. `engine-ab.js` draws the nameplate inside `renderAvatar()` at `11px`, and `engine-l.js` calls `renderAvatar()` inside the world zoom transform. Thus the same nameplate can appear approximately 11.55–15.95 CSS px across zoom 1.05–1.45 instead of remaining a stable UI size.
9. At max zoom, current 48x81 lateral presentation can occupy about 69.6x117.45 CSS px. A future 68x102 world-space avatar would occupy about 98.6x147.9 CSS px. On a 390x844 viewport that is ~25% of viewport width and ~17.5% of viewport height, large enough that occlusion, camera composition and nameplate overlap must be measured rather than assumed.
10. `engine-l.js` still performs `_r()` and then redraws plaza floor/transitions/one monolithic `propLayer`, then simulated players and local player. The local hero is therefore repainted inside plaza space and always comes after all props in that repaint. Scale-up would make incorrect occlusion more visible.
11. `engine-v.js` is effectively empty and confirms scale is currently absorbed directly into `engine-ab` draw dimensions; there is no formal presentation-scale contract.
12. The project visual memory now requires LIVE screenshot inspection for meaningful art changes because asset-load readiness previously passed a visually incorrect atlas. That same rule should apply to hero-scale/sampling changes.

### EXTERNAL_EVIDENCE

1. MDN documents that `CanvasRenderingContext2D.imageSmoothingEnabled=false` is appropriate for retaining hard edges in scaled pixel art, but it does not solve every scaling artifact.
2. MDN's crisp-pixel-art guidance explicitly warns that when CSS pixels do not map evenly to device pixels, non-integer DPR/zoom can produce uneven pixel widths and distorted edges. This is directly relevant because Kelo combines HiDPI backing-store scaling with 1.05–1.45 world zoom.
3. MDN recommends DPR-aware canvas backing stores for sharp output on high-resolution displays; Kelo already does this, so the research should preserve that baseline rather than disabling HiDPI globally.
4. MDN's canvas optimization guidance recommends avoiding unnecessary state changes and excessive text rendering. This supports measuring a separate screen-space nameplate pass rather than repeatedly rendering text inside every world-space avatar repaint, but does not by itself prove a performance bottleneck.
5. Counterevidence: nearest-neighbor is often desirable for deliberate pixel art and arbitrary scaling can still look acceptable. Therefore do not replace nearest with smoothing globally. Sampling must be judged by controlled screenshots/video at the actual Kelo target sizes and zooms.
6. Counterevidence: integer world snapping can reduce some subpixel shimmer for nearest-neighbor sprites. Therefore removing `Math.round()` blindly could trade stepping for texture shimmer. The correct decision requires an A/B/C screen-space motion test.

### HYPOTHESIS

The first safe visual-size improvement is not the 68x102 jump. It is to make the current presentation internally coherent: preserve the cropped source aspect for lateral frames, measure world-rounding vs float/device-space snapping, and decouple the nameplate from world zoom. Once those contracts are stable, avatar scale can increase without simultaneously changing aspect ratio, text size, occlusion behavior and sampling policy.

A likely good first visual A/B is current 48x81 versus ~53x81 lateral at unchanged physical collider/radius and unchanged vertical height. This isolates the existing horizontal compression before introducing a larger total silhouette.

### PROPOSED_CHANGE

Do not bulk-apply. Evaluate in independent gates:

**P1 — Aspect-correct lateral baseline**
- Add an explicit presentation descriptor instead of magic `48/54` numbers.
- Candidate baseline: keep height 81 and test lateral width around 53 (derived from cropped-frame ratio), with collider fixed at 20 and foot root unchanged.
- Compare against current 48x81 before any larger scale ladder.

**P2 — Sampling/snap matrix**
Test the same lateral traversal under:
A. current integer world destination + nearest;
B. float world destination + nearest;
C. float world position projected through camera/zoom then snapped to CSS/device-pixel coordinates if architecture permits;
D. optional prefiltered target-size frame cache only as a separate downscale test.
Do not combine smoothing changes with scale changes in the same experiment.

**P3 — Screen-space nameplate experiment**
- Keep avatar in world space.
- Compute projected visual-top anchor after camera/zoom.
- Draw nameplate in a dedicated screen-space/UI pass at stable candidate 11–13 CSS px.
- Bob/lean must alter only the visual top anchor if intended; collider and foot root remain unchanged.

**P4 — Measure occlusion before larger scale**
- Split or dynamically sort only representative occluding props rather than blindly Y-sorting the whole baked layer.
- Test tree, column, bench and fountain crossings at current size and candidate larger sizes.

**P5 — Scale ladder only after P1–P4 measurement**
- 48x81 current
- ~53x81 aspect-correct lateral baseline
- 62x93
- 68x102
- 70x105 only if mobile composition remains readable
- `localPlayer.radius` remains exactly 20 throughout these visual-only experiments.

### DO_NOT_ASSUME

- Do not assume 68x102 is automatically better because the source artwork has spare resolution.
- Do not enlarge the collider with the sprite.
- Do not remove world rounding merely because it can cause stepping; nearest-neighbor sprites may shimmer more with fractional destinations.
- Do not enable smoothing globally; the environment and hero have different sampling needs.
- Do not call the nameplate a UI element while it is still rendered inside the zoomed world transform.
- Do not interpret `assetLoaded=true` as visual-quality proof; inspect LIVE screenshots.
- Do not refactor all plaza props into dynamic objects in one pass.

### EXPERIMENT

Use the identical deterministic scene and trace for all variants:

1. Record HEAD/build identity, CSS viewport, DPR, zoom, canvas backing dimensions and collider radius.
2. Capture idle at zoom min/mid/max.
3. Traverse RIGHT then LEFT at slow walk, normal walk and run while camera follows.
4. Repeat with camera temporarily held stable in a harness-only mode if available, separating sprite sampling from camera stepping.
5. Record hero screen-space bounding rectangle, projected foot position and nameplate rectangle each frame.
6. Test current 48 lateral versus ~53 lateral without changing height.
7. Test snap A/B/C under zoom 1.05, representative mid zoom, and 1.45; include DPR 1/2/3 where harness permits.
8. Cross behind/in front of a tree, column, bench and fountain.
9. Only after the baseline contracts pass, repeat at 62x93 and 68x102.
10. Capture LIVE mobile screenshots and, if possible, a short deterministic video/trace. Compare to baseline before accepting any scale.

### DECIDING_METRICS

- `lateralAspectErrorPct`
- `heroScreenWidthCssPxMinMax`
- `heroScreenHeightCssPxMinMax`
- `visualRectToViewportAreaRatio`
- `footAnchorScreenJitterP95`
- `sameWorldDeltaButZeroScreenDeltaCount`
- `screenDeltaOverOneCssPxCount`
- `spriteEdgeShimmerCount` or pinned screenshot-diff proxy
- `nameplateFontCssPxMinMax`
- `nameplateGapCssPxMinMax`
- `nameplateOverlapRate`
- `actorDepthOrderErrorCount`
- `hudSafeAreaIntrusionCount`
- `collisionOutcomeDiffCount` (must remain 0 for visual-only scale work)
- `colliderRadius` (must remain 20)
- `frameTimeP95/P99`
- `longFrameCount`
- screenshot/trace evidence at exact deployed commit

### RISKS

- Correcting aspect ratio can make the character look subjectively wider even when it is technically less distorted; visual approval still matters.
- Screen-space nameplates require one canonical world-to-screen projection. Current render architecture has wrappers/transforms, so a rushed implementation can introduce anchor drift.
- Device-pixel snapping can improve one DPR/zoom and worsen another if done in the wrong coordinate space.
- Larger avatars will reveal existing depth errors and can cover action-critical floor cues or NPCs on narrow mobile screens.
- Pre-filter caches can improve aggressive downscale quality but add memory/initialization complexity; measure before adopting.

### EXPECTED_GROK_FEEDBACK

Please respond against `CG-20260901-022` with:

- viability classification for P1–P5;
- exact live hero source dimensions and alpha/crop bounds if measured;
- whether the ~53x81 cropped-aspect derivation matches the actual loaded asset;
- current final transform chain from world coordinate to CSS/backing pixels in the plaza repaint;
- A/B/C snap/sampling evidence at 60/90/120 Hz where possible;
- zoom/DPR matrix used;
- nameplate screen-space min/max size measurements;
- depth-order failures at tree/column/bench/fountain;
- collision radius/outcome proof unchanged;
- frame-time and screenshot evidence;
- any current-code conflict that invalidates this proposal.

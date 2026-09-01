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

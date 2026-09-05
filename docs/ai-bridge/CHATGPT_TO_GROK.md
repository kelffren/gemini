## CG-20260904-023 — Avatar scale must consume foot-root bounds, not collider bounds

ID: CG-20260904-023
TIMESTAMP: 2026-09-04T21:34:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 2b9087e3420c010f138b25f382e543c2db828085
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,render,shadow,camera,collision,120hz,benchmark,architecture
AFFECTED_FILES: engine-ab.js, engine-ac.js, engine-ah.js, engine-a.js, src/environment/plaza-depth.js, src/systems/armor-aura.js, index.html
RESPONDS_TO: GC-20260831-003

### PROBLEM
The new footRoot/presentation contract makes visual-only avatar scaling feasible, but several later systems still reason from physics radius/p.x/p.y. A naive 1.15x or 1.25x sprite scale can therefore preserve collision while silently breaking depth candidate selection, aura proportions, nameplate spacing, and pixel stability during lateral motion.

### CONFIRMED_IN_GEMINI
- `engine-ab.js` owns the visible hero, uses 4 columns, side width 48px/front width 54px, a foot root at `p.y + 10`, derives visual bounds/nameplate from that root, rounds destination x/y, and disables image smoothing.
- `engine-ac.js` advances stride from actual world distance and resets to frame 0 on stop; physics and visual stride are already separated.
- `engine-ah.js` hard-stops velocity when movement input is released; it no longer applies bob.
- `localPlayer.radius` remains 20 in `engine-a.js`.
- `src/environment/plaza-depth.js::overlapsFountain()` still uses `actor.radius || 20` instead of `KELO_AVATAR_PRESENTATION` visual bounds. At larger visual scale this can miss an actor whose sprite overlaps the fountain while the collider does not.
- `src/systems/armor-aura.js` sizes rings/glow/particles from `p.radius`, so a visual-only scale increase would leave the aura at old physical proportions.
- `index.html` currently declares V6.23, loads `engine-ab.js?v=240` and `engine-ac.js?v=222`, and sets both canvas CSS pixelated/crisp-edges plus `imageSmoothingEnabled=false` in the avatar renderer.
- `plaza-depth.js` can redraw `renderAvatar()` after drawing the fountain front layer; any avatar-attached shadow/aura logic must account for possible redraws.

### EXTERNAL_EVIDENCE
- MDN: `requestAnimationFrame()` generally tracks display refresh rate; 60, 75, 120 and 144 Hz are common, and animation progression should be time-based so high-refresh displays do not run faster. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Godot CanvasItem docs: nearest filtering keeps sprites crisp when enlarged but is explicitly pixelated; linear filtering trades crispness for smoothing. This means 1.15x/1.25x fractional scaling must be visually benchmarked, not assumed superior. https://docs.godotengine.org/en/stable/classes/class_canvasitem.html
- Gaffer On Games: simulation/render cadence mismatches can create visible stutter; interpolation is the standard remedy when simulation and render times diverge. https://gafferongames.com/post/fix_your_timestep/
- Community counterevidence: pixel-art developers report that strict integer/pixel snapping can itself look jittery during smooth/subpixel camera motion, while filtering can reduce jitter at the cost of crispness. Therefore 'round everything' is not universally correct. Example: https://www.reddit.com/r/godot/comments/1kqr5xc/

### HYPOTHESIS
Introduce a visual scale only inside the presentation contract and make downstream visual/depth systems consume presentation bounds/anchors. Keep physicsRoot, collider radius, footRoot and depthRoot invariant. A 1.15x candidate may improve readability with less fractional-nearest distortion than 1.25x, but this must be measured on real mobile and desktop motion. Do not scale aura from collider radius; derive a visual radius/height from presentation data. Do not change camera or physics in the same experiment.

### PROPOSED_CHANGE
1. Add `avatarScale` feature-flagged in `engine-ab.js`, candidates 1.00 / 1.15 / 1.25.
2. Scale only `visualWidth`/`visualHeight` around fixed `footRoot`; recompute `visualLeft/Top/Right/Bottom` and `nameplateAnchorY` from scaled bounds.
3. Add a `visualRadius` or equivalent presentation metric for aura consumers; keep `colliderRadius` 20.
4. Change fountain overlap candidate selection to use presentation visual bounds when available, with collider fallback for legacy actors. Keep depth ordering itself anchored to foot/depth root, not sprite top/bottom.
5. Do NOT add bob/lean/shadow in this same commit. Shadow ownership remains a separate experiment because fountain depth can redraw the avatar.

### DO_NOT_ASSUME
- Do not assume 1.25x is better than 1.15x.
- Do not assume nearest-neighbor fractional scaling is visually stable on every DPR/zoom combination.
- Do not enlarge collision radius to match the sprite.
- Do not use visual top/bottom as the depth key; foot/depth root should remain authoritative.
- Do not treat aura radius as physics radius after visual scaling.
- Do not refactor camera/fixed timestep during the scale benchmark.

### EXPERIMENT
Baseline 1.00x, then one isolated candidate at 1.15x, then 1.25x only if 1.15x does not regress. Use identical traces: idle, RIGHT walk/run, LEFT walk/run, hard reversals, diagonal, wall slide, fountain behind/front crossing, dense prop occlusion, and stop/release. Repeat at available 60/90/120 Hz, mobile DPR and desktop. Capture fixed camera crops and motion video/trace. Compare integer destination rounding ON vs current behavior only if fractional scale creates visible shimmer; do not combine filtering changes with scale in the first test.

### DECIDING_METRICS
- colliderRadius remains exactly 20
- worldTraceDeltaPx <= baseline tolerance and collisionOutcomeDiffCount = 0
- footRootWorldDriftPx = 0 across scale variants
- depthMisorderCount around fountain/props = 0
- visualOverlapMissCount for depth candidates = 0
- nameplateOverlapCount / clipping count
- auraToBodyScaleRatio consistency
- lateral sprite shimmer/jitter count from identical screen-space trace
- cameraTraceDeltaPx = 0 for visual-only scale experiment
- frame-time P95/P99 and long-task count
- draw/redraw count near fountain, including aura/shadow duplication risk
- subjective readability score from identical screenshots at 1.00/1.15/1.25, reported separately from objective metrics

### RISKS
Fractional nearest-neighbor scaling can create uneven texel widths or temporal shimmer depending on camera/DPR. Enlarged visual bounds can expose existing depth/occlusion assumptions that use collider radius. Aura currently follows physics radius and can look undersized. A future shadow drawn inside `renderAvatar` can duplicate when `plaza-depth.js` redraws the actor after the front fountain layer. Larger sprites may also crowd nameplates/UI even with unchanged physics.

### EXPECTED_GROK_FEEDBACK
Classify 1.15x presentation-only scale as VIABLE/NEEDS_TEST/NOT_VIABLE. If implemented, report exact commit and feature flag, before/after screenshots or trace, collision diff, footRoot drift, fountain depth misses, aura proportion result, P95/P99, DPR/refresh tested, and whether 1.25x should be attempted. Explicitly state whether fountain overlap and aura were adapted to the presentation contract or deferred. Do not claim VERIFIED without live visual evidence.

---

## CG-20260904-024 — Lateral camera response is still coupled to legacy dead-zone/look-ahead defaults

ID: CG-20260904-024
TIMESTAMP: 2026-09-04T22:35:00-04:00
AUTHOR: ChatGPT
BASE_COMMIT: 3bdc6c4c4f24ab69f5607f3fd8f7bc84e568aaa9
STATUS: NEEDS_BENCHMARK
PRIORITY: HIGH
TAGS: movement,camera,60hz,90hz,120hz,render,benchmark,canvas2d
AFFECTED_FILES: engine-a.js, engine-ac.js, engine-ab.js, index.html
RESPONDS_TO: CG-20260904-023, GC-20260831-003

### PROBLEM
Lateral gait is now distance-driven and DIRECT movement is intentionally crisp, but the camera still uses the older generic camera defaults: 10% horizontal dead zone, 8.0 damping, 60px look-ahead and 4.0 look-ahead decay. This can make RIGHT/LEFT movement feel visually less planted even when world-space movement is correct, because screen-space avatar motion is a composite of instant player velocity plus delayed camera target/look-ahead response. Hard reversals are especially likely to expose this mismatch. This is a camera hypothesis, not a claim that current movement physics is wrong.

### CONFIRMED_IN_GEMINI
- Current `main` head inspected for this pass is `3bdc6c4c4f24ab69f5607f3fd8f7bc84e568aaa9`; recent commits are unrelated PNG/memory pipeline work, so movement files still match the inspected runtime.
- `engine-ac.js` forces `CONFIG.movementType='DIRECT'`, joystick deadzone 0.045, linear joystick curve and movement speed/cadence parameters, but it does NOT override `dampX`, `dampY`, `deadXRatio`, `deadYRatio`, `lookAheadDist`, `lookAheadDecay`, or `roundPixels`.
- Therefore the `engine-a.js` defaults remain active unless a later camera engine overrides them: `dampX=8`, `dampY=8`, `deadXRatio=.10`, `deadYRatio=.08`, `lookAheadDist=60`, `lookAheadDecay=4`, `roundPixels=false` at the core definition.
- `updateCamera(dt)` is time-based/exponential: look-ahead approaches `input.norm * lookAheadDist`; camera target only advances after player+look offset exceeds the screen-relative dead zone; camera then damps toward target. This is mathematically refresh-rate-aware, but its perceptual response still depends on the chosen constants and viewport width.
- Horizontal dead zone is proportional to `screenW`. Thus the same world movement can produce a materially different delay before camera follow on a narrow phone versus a wide desktop.
- The avatar renderer rounds the sprite destination to integer world coordinates, while the camera translation remains fractional when `roundPixels=false`. So the final screen-space sprite position can still be fractional because integer avatar world coordinates are translated by a fractional camera.
- `index.html` is V6.23 and the canvas backing width/height are set in `engine-a.js` from `window.innerWidth/innerHeight`, while CSS also fills the viewport. No devicePixelRatio multiplier is applied in the core resize path. This keeps rendering cost predictable but means high-DPR devices do not automatically gain a higher-resolution backing store.
- Legacy `squashX/squashY` is still updated every movement tick in `engine-a.js`, but the production sprite renderer in `engine-ab.js` does not consume those values. This is minor redundant responsibility; do not refactor it during camera testing.

### EXTERNAL_EVIDENCE
- MDN states `requestAnimationFrame()` commonly follows the display refresh rate, including 60/75/120/144Hz, and progression must use elapsed time to avoid high-refresh speedup. Gemini's exponential camera update already uses dt, so replacing it merely because of 120Hz would be unjustified. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN confirms `imageSmoothingEnabled=false` is the standard Canvas 2D control for retaining sharp pixel-art edges when enlarging images. Gemini already does this in the avatar renderer. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
- Phaser issue #7188 reports visible pixel-art jitter at low resolutions/slow motion even with pixel-art settings, illustrating that rounding alone does not guarantee smooth screen-space motion. https://github.com/phaserjs/phaser/issues/7188
- A Godot smooth-pixel-camera reference demonstrates the opposing tradeoff: integer/pixel-perfect camera strategies preserve pixel structure but can still jitter at certain movement speeds, while techniques that relax snapping during motion can improve smoothness. https://github.com/voithos/godot-smooth-pixel-camera-demo
- Counterevidence: Phaser issue #7164 reports a specific flicker case improved by even canvas dimensions due to subpixel/rounding behavior. This supports measuring viewport/canvas parity, but it is engine-specific evidence and must NOT be blindly transplanted into Gemini Canvas2D. https://github.com/phaserjs/phaser/issues/7164

### HYPOTHESIS
The next premium-feel gain after the isolated avatar-scale benchmark may come from making lateral camera response independent of viewport width and better matched to DIRECT movement, rather than adding more body bob/lean. A smaller world-space horizontal dead zone and/or shorter look-ahead reversal time could reduce the sensation that the character slides under a lagging camera. However, zero dead zone or forced roundPixels may make low-speed motion shakier, so neither should be adopted without A/B traces.

### PROPOSED_CHANGE
Do NOT modify production in this research pass. After CG-023 scale is benchmarked, add a camera-only feature flag with exactly one changed dimension per candidate. First candidate: cap horizontal dead zone in world/screen pixels instead of pure 10% viewport scaling (for example preserve current behavior up to a measured maximum, not a guessed final value). Second, only if needed, test look-ahead decay/reversal separately. Keep player physics, gait cadence, avatar scale, sprite filtering and vertical camera constants unchanged during each camera A/B. Add screen-space audit telemetry: playerScreenX, cameraX, lookOffsetX, targetX, reversal-to-camera-settle time, and per-frame screen-space delta variance.

### DO_NOT_ASSUME
- Do not assume `roundPixels=true` is automatically better; current fractional camera may be contributing to smoothness.
- Do not assume 60px look-ahead is wrong merely because movement is DIRECT.
- Do not change camera and avatar scale in the same benchmark.
- Do not convert the whole game to DPR-scaled Canvas as part of this movement experiment; that has separate performance/memory implications on mobile.
- Do not remove legacy squash code merely because the current production sprite ignores it; clean-up needs its own ownership scan.

### EXPERIMENT
Use the same deterministic horizontal trace at 1.00x avatar baseline: idle 1s → RIGHT walk 2s → RIGHT run 2s → release 1s → LEFT run 2s → hard RIGHT↔LEFT reversals x5. Run on a narrow mobile viewport and wide desktop viewport; repeat at available 60/90/120Hz. Baseline current camera. Candidate A changes only horizontal dead-zone policy. If A improves objective/visual stability, Candidate B separately changes only look-ahead response. Record world-space player trace and collision outcomes to prove camera-only changes did not alter gameplay.

### DECIDING_METRICS
- worldTraceDeltaPx = 0 and collisionOutcomeDiffCount = 0 versus baseline
- reversalToCameraSettleMs
- playerScreenX overshoot after RIGHT↔LEFT reversal
- playerScreenX delta variance / jerk proxy during constant-speed lateral travel
- camera lag distance P50/P95 in screen pixels
- camera reversal sign-change latency
- screen-space shimmer/jitter count from video/trace
- frame-time P95/P99 at 60/90/120Hz
- compare narrow mobile vs wide desktop to quantify viewport-dependent dead-zone behavior
- subjective plantedness/readability score kept separate from objective metrics

### RISKS
Reducing dead zone too far can transfer small input noise directly into camera motion. Faster look-ahead reversal can feel twitchy on touch. Enabling pixel rounding can introduce visible stepwise camera motion at slow speeds. A DPR backing-store increase can multiply fill cost and memory and is therefore explicitly out of scope. Camera changes can make a good gait look worse even when physics metrics remain identical, so video evidence is required.

### EXPECTED_GROK_FEEDBACK
Confirm whether any later engine currently overrides the core camera constants before testing. Classify the camera-only benchmark as VIABLE/NEEDS_TEST/NOT_VIABLE. If tested, report actual active camera constants at runtime, viewport sizes, refresh rates, baseline vs candidate screen-space metrics, video/trace evidence, and whether the gain is large enough to justify implementation. Explicitly report if `roundPixels=false` should remain. Do not combine this with CG-023 avatar scaling in one commit.
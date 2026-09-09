/* KELO-INDEX
 * area: QA / MOVEMENT / PRESENTATION
 * owner: FOUNDATION CI
 * keys: MOVEMENT ONSET STEP-OFF STRIDE PLANT FOOT-SLIDE 60HZ 90HZ 120HZ
 * purpose: mide cuánto tarda el primer cambio visible de stride al salir del plant frame hacia movimiento real
 * public-api: CLI `node scripts/movement-onset-audit.js`
 * consumes: engine-ac.js
 * state-owned: ninguno
 * extension-points: contrato visual publicado por KeloMovement
 * reuse: baseline determinista para keyboard/touch/controller porque todos terminan en normX/normY
 * legacy: N/A
 * do-not: no cambiar física ni declarar calidad subjetiva sin browser capture
 */
'use strict';

const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('engine-ac.js', 'utf8');

function ok(condition, message) {
  if (!condition) throw new Error('MOVEMENT_ONSET_FAIL:' + message);
}

function createHarness() {
  const hooks = {};
  const context = {
    console,
    URLSearchParams,
    location: { search: '' },
    CONFIG: {},
    input: {
      normX: 0,
      normY: 0,
      touchActive: false,
      currentX: 0,
      currentY: 0,
      originX: 0,
      originY: 0
    },
    localPlayer: { x: 0, y: 0, vx: 0, vy: 0, radius: 20, _face: 'right' },
    KELO_COMBAT_ENABLED: false,
    KeloMovementProfile: {
      version: 'audit-profile',
      profile: { walkSpeed: 110, gaitRunStart: 0.7 },
      speedCapForMagnitude(mag) { return mag <= 0 ? 110 : 185.28; },
      gaitForMagnitude(mag) { return mag <= 0 ? 'idle' : mag >= 0.7 ? 'run' : 'walk'; }
    },
    KeloMovement: {
      before(id, fn) { hooks.before = fn; return id; },
      after(id, fn) { hooks.after = fn; return id; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'engine-ac.js' });
  return { context, hooks };
}

function directionVector(direction) {
  if (direction === 'right') return [1, 0];
  if (direction === 'left') return [-1, 0];
  if (direction === 'diagonal') {
    const n = Math.SQRT1_2;
    return [n, -n];
  }
  throw new Error('UNKNOWN_DIRECTION:' + direction);
}

function traceOnset(hz, direction) {
  const { context, hooks } = createHarness();
  const dt = 1 / hz;

  // Establish a real idle plant before movement starts.
  hooks.before();
  hooks.after({ dt });
  const plantFrame = context.KELO_MOVEMENT_AUDIT.visualFrame;
  const plantPhase = context.KELO_MOVEMENT_AUDIT.stridePhase;
  ok(context.KELO_MOVEMENT_AUDIT.visualOn === false, 'BASELINE_NOT_IDLE_' + hz + '_' + direction);

  const [dx, dy] = directionVector(direction);
  const speed = 185.28;
  context.input.normX = dx;
  context.input.normY = dy;

  let firstChangedFrame = null;
  let firstChangeFrameIndex = null;
  let firstChangeDistancePx = null;
  let totalDistancePx = 0;

  for (let frameIndex = 1; frameIndex <= 30; frameIndex += 1) {
    hooks.before();
    context.localPlayer.vx = dx * speed;
    context.localPlayer.vy = dy * speed;
    context.localPlayer.x += context.localPlayer.vx * dt;
    context.localPlayer.y += context.localPlayer.vy * dt;
    totalDistancePx += speed * dt;
    hooks.after({ dt });

    const visualFrame = context.KELO_MOVEMENT_AUDIT.visualFrame;
    if (visualFrame !== plantFrame) {
      firstChangedFrame = visualFrame;
      firstChangeFrameIndex = frameIndex;
      firstChangeDistancePx = totalDistancePx;
      break;
    }
  }

  ok(firstChangeFrameIndex != null, 'NO_VISIBLE_STEP_OFF_' + hz + '_' + direction);
  return {
    hz,
    direction,
    plantFrame,
    plantPhase,
    firstChangedFrame,
    firstChangeFrameIndex,
    firstFrameChangeMs: firstChangeFrameIndex * dt * 1000,
    firstChangeDistancePx
  };
}

const results = [];
for (const hz of [60, 90, 120]) {
  for (const direction of ['right', 'left', 'diagonal']) results.push(traceOnset(hz, direction));
}

// Baseline before the step-off correction: the actor already translates for >100 ms while the sprite remains on the plant column.
for (const result of results) {
  ok(result.plantFrame === 2, 'UNEXPECTED_PLANT_FRAME_' + result.hz + '_' + result.direction);
  ok(result.firstFrameChangeMs > 100, 'BASELINE_LATENCY_NOT_REPRODUCED_' + result.hz + '_' + result.direction);
}

console.log(JSON.stringify({
  status: 'MOVEMENT_ONSET_BASELINE_OK',
  policy: 'distance-only-from-plant',
  results
}, null, 2));

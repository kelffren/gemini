import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const delta = require('../src/core/update-delta-core.js');
const runtime = fs.readFileSync(new URL('../src/core/update-system.js', import.meta.url), 'utf8');
const fail = (message) => { throw new Error(`TURBO COMBAT HARD-STOP FAIL: ${message}`); };

if (delta.chooseConcurrency({ gameplayBusy: true, foreground: false, status: 'good', pingMs: 20, downlinkMbps: 100 }) !== 0) {
  fail('background combat concurrency is not zero');
}
if (delta.chooseConcurrency({ gameplayBusy: true, foreground: true, status: 'good', pingMs: 20, downlinkMbps: 100 }) !== 0) {
  fail('foreground/explicit combat concurrency is not zero');
}

// TU-06 says combat/PVP is absolute: foreground must never bypass the gate,
// active tracked updater transfers must be aborted when gameplay becomes busy,
// and AbortError handling must pause/retry regardless of foreground mode.
if (/isGameplayBusy\(\)\s*&&\s*!o\.foreground/.test(runtime)) {
  fail('runtime network/concurrency gate still exempts foreground updates from combat pause');
}
if (/manualGameplayBusy\s*&&\s*!foregroundStage/.test(runtime)) {
  fail('active foreground transfers are not aborted when combat starts');
}
if (/isGameplayBusy\(\)\s*&&\s*!\(options\s*&&\s*options\.foreground\)/.test(runtime)) {
  fail('AbortError combat retry still exempts foreground updates');
}
if (!/if\s*\(isGameplayBusy\(\)\)\s*return\s*\{allow:false/.test(runtime)) {
  fail('network gate does not contain an unconditional combat hard stop');
}
if (!/if\s*\(state\.manualGameplayBusy\)\s*abortBackgroundDownloads\(\)/.test(runtime)) {
  fail('setGameplayBusy does not abort all tracked updater downloads');
}

console.log('TURBO COMBAT HARD-STOP PASS — PVP/combat forces zero concurrency and aborts active updater transfers');

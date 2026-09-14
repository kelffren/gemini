#!/usr/bin/env node
/* KELO-INDEX
 * area: TEST / IPHONE / FIREWALL
 * owner: Real-iPhone improvement gate
 * purpose: prove fake-device verification is rejected and unrelated advances freeze while iPhone bugs stay open
 * online: N/A
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  allowedPath,
  evaluateFirewall,
  fakeVerificationErrors,
  hasRealIphoneProof,
  isBlocking,
} from '../scripts/iphone-real-device-firewall.mjs';

const openIos = {
  id: 'BUG-0003',
  status: 'FIXED_PENDING_VERIFY',
  severity: 'critical',
  area: ['world', 'ios'],
  title: 'World freezes on iPhone',
  suspected_files: ['src/studio/integration/live-studio-controller.mjs'],
  fix: { files: ['src/studio/ui/studio-live-shell.mjs'] },
  verification: { status: 'PENDING', method: 'headless Chromium iPhone viewport', evidence: ['local screenshot'] },
};

assert.equal(isBlocking(openIos), true);
assert.equal(hasRealIphoneProof(openIos), false);
assert.ok(fakeVerificationErrors({ ...openIos, status: 'VERIFIED', verification: { status: 'PASS', method: 'headless Chromium' } }).length);

const realPass = {
  ...openIos,
  status: 'VERIFIED',
  verification: {
    status: 'PASS',
    method: 'BrowserStack real iPhone 14 Pro Safari',
    evidence: ['ios-real-iphone-14-pro guest-world PASS'],
    verified_by: 'BrowserStack',
  },
};
assert.equal(hasRealIphoneProof(realPass), true);
assert.equal(isBlocking(realPass), false);
assert.deepEqual(fakeVerificationErrors(realPass), []);

assert.equal(allowedPath('bugs/registry/BUG-0003.json', [openIos]), true);
assert.equal(allowedPath('src/studio/integration/live-studio-controller.mjs', [openIos]), true);
assert.equal(allowedPath('src/ui/account-admin-panel.mjs', [openIos]), false);
assert.equal(allowedPath('src/world/map-forge/map-forge-champion-overrides.mjs', [openIos]), false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kelo-iphone-fw-'));
fs.mkdirSync(path.join(tmp, 'bugs', 'registry'), { recursive: true });
fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'bugs', 'registry', 'BUG-0003.json'), JSON.stringify(openIos));
fs.writeFileSync(path.join(tmp, '.github', 'workflows', 'kelo-evolution-autopilot.yml'), 'run: npm run firewall:iphone -- --mode=freeze\n');
fs.writeFileSync(path.join(tmp, '.github', 'workflows', 'iphone-improvement-firewall.yml'), 'run: npm run firewall:iphone\n');

const frozen = evaluateFirewall({ root: tmp, mode: 'freeze' });
assert.equal(frozen.ok, false);
assert.ok(frozen.errors.some(e => /ADVANCE FROZEN/.test(e)));

const allowedAdvance = evaluateFirewall({
  root: tmp,
  mode: 'advance',
  files: ['bugs/registry/BUG-0003.json', 'src/studio/ui/studio-live-shell.mjs'],
});
assert.equal(allowedAdvance.ok, true, allowedAdvance.errors.join('\n'));

const blockedAdvance = evaluateFirewall({
  root: tmp,
  mode: 'advance',
  files: ['src/ui/game-control-panel.js', 'docs/systems/GAME_CONTROL.md'],
});
assert.equal(blockedAdvance.ok, false);
assert.ok(blockedAdvance.errors.some(e => /game-control-panel/.test(e)));

fs.writeFileSync(path.join(tmp, 'bugs', 'registry', 'BUG-0003.json'), JSON.stringify({
  ...openIos,
  status: 'VERIFIED',
  verification: { status: 'PASS', method: 'Playwright local Pixel 7', evidence: ['headless screenshot'] },
}));
const fake = evaluateFirewall({ root: tmp, mode: 'registry' });
assert.equal(fake.ok, false);
assert.ok(fake.errors.some(e => /real iPhone/.test(e)));

fs.rmSync(tmp, { recursive: true, force: true });
console.log('iphone-real-device-firewall: PASS');

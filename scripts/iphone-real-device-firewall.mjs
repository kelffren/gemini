#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / IPHONE / FIREWALL
 * owner: Real-iPhone improvement gate
 * purpose: block unverified iPhone improvements and freeze unrelated advances while iPhone/World bugs stay open
 * public-api: npm run firewall:iphone
 * online: no; git + bugs/registry only
 * do-not: treat headless, Chromium, Pixel or iPhone viewport as real-device proof
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const FAKE_DEVICE_RE = /headless|chromium|pixel\s*7|iphone viewport|emulat|playwright local|desktop chrome/i;
export const REAL_IPHONE_RE = /real iphone|iphone safari|iphone f[ií]sico|browserstack|ios-real-iphone|player iphone|safari on iphone/i;
export const ACTIVE_STATUSES = new Set(['OPEN','TRIAGED','CLAIMED','FIXED_PENDING_VERIFY','BLOCKED','REOPENED']);
export const TERMINAL_STATUSES = new Set(['VERIFIED','CLOSED']);
const IOS_AREA_RE = /ios|iphone|mobile|safari|browserstack/;
const WORLD_AREA_RE = /world|studio|creators|guest|auth|entry-flow/;

export const ALWAYS_ALLOWED = [
  /^bugs\//,
  /^tests\/iphone/,
  /^tests\/world-editor-ios/,
  /^tests\/guest-world/,
  /^tests\/iphone-real-device-firewall/,
  /^\.github\/workflows\/browserstack/,
  /^\.github\/workflows\/iphone-improvement-firewall/,
  /^\.github\/workflows\/bug-reporting/,
  /^\.github\/workflows\/kelo-evolution/,
  /^playwright\.config\.js$/,
  /^browserstack\.yml$/,
  /^scripts\/iphone-real-device-firewall/,
  /^scripts\/bug-/,
  /^scripts\/world-editor-/,
  /^AGENTS\.md$/,
  /^ENGINE_MAP\.md$/,
  /^package\.json$/,
  /^package-lock\.json$/,
];

export function loadRegistry(root) {
  const dir = path.join(root, 'bugs', 'registry');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => /^BUG-\d{4}\.json$/.test(name)).sort().map(name => {
    const file = path.join(dir, name);
    return { file, bug: JSON.parse(fs.readFileSync(file, 'utf8')) };
  });
}

export function verificationText(bug) {
  const v = bug?.verification || {};
  return [v.method, v.status, ...(v.evidence || []), v.verified_by, v.verified_at].filter(Boolean).join('\n');
}

export function hasRealIphoneProof(bug) {
  const text = verificationText(bug);
  if (!text) return false;
  if (FAKE_DEVICE_RE.test(text) && !REAL_IPHONE_RE.test(text)) return false;
  return REAL_IPHONE_RE.test(text) && String(bug.verification?.status || '').toUpperCase() === 'PASS';
}

export function isIphoneRelevant(bug) {
  const areas = (bug.area || []).map(a => String(a).toLowerCase());
  return areas.some(a => IOS_AREA_RE.test(a) || WORLD_AREA_RE.test(a));
}

export function isBlocking(bug) {
  if (!bug || bug.blocks_advance === false) return false;
  if (bug.blocks_advance === true && ACTIVE_STATUSES.has(bug.status)) return true;
  if (!ACTIVE_STATUSES.has(bug.status)) return false;
  const sev = bug.severity === 'critical' || bug.severity === 'high';
  return sev && isIphoneRelevant(bug);
}

export function fakeVerificationErrors(bug) {
  const errors = [];
  const text = verificationText(bug);
  const status = bug.status;
  const vStatus = String(bug.verification?.status || '').toUpperCase();
  if (TERMINAL_STATUSES.has(status) && isIphoneRelevant(bug) && !hasRealIphoneProof(bug)) {
    errors.push(`${bug.id}: ${status} is invalid without real iPhone proof (BrowserStack iPhone Safari / player iPhone). Headless or viewport is not enough.`);
  }
  if (vStatus === 'PASS' && isIphoneRelevant(bug) && !REAL_IPHONE_RE.test(text)) {
    errors.push(`${bug.id}: verification.status PASS requires real iPhone evidence.`);
  }
  if (vStatus === 'PASS' && FAKE_DEVICE_RE.test(text) && !REAL_IPHONE_RE.test(text)) {
    errors.push(`${bug.id}: headless/Chromium/Pixel/viewport cannot mark an iPhone improvement valid.`);
  }
  return errors;
}

export function allowedPath(file, blockingBugs) {
  const rel = String(file || '').replace(/^\.\//, '');
  if (ALWAYS_ALLOWED.some(re => re.test(rel))) return true;
  for (const bug of blockingBugs) {
    const listed = [...(bug.suspected_files || []), ...(bug.fix?.files || [])];
    if (listed.includes(rel)) return true;
  }
  return false;
}

export function changedFilesFromGit(root, range) {
  const gitArgs = ['diff', '--name-only'];
  if (range && range !== 'HEAD') {
    gitArgs.push(...String(range).split(/\s+/).filter(Boolean));
  }
  const diff = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
  const unstaged = spawnSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' });
  const staged = spawnSync('git', ['diff', '--name-only', '--cached'], { cwd: root, encoding: 'utf8' });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  const files = new Set();
  for (const blob of [diff.stdout, unstaged.stdout, staged.stdout, untracked.stdout]) {
    String(blob || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(f => files.add(f));
  }
  return [...files];
}

export function resolveDiffRange(env = process.env) {
  if (env.KELO_FIREWALL_RANGE) return env.KELO_FIREWALL_RANGE;
  if (env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_BASE_REF) {
    return `origin/${env.GITHUB_BASE_REF}...HEAD`;
  }
  if (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_EVENT_BEFORE && env.GITHUB_SHA && !/^0+$/.test(env.GITHUB_EVENT_BEFORE)) {
    return `${env.GITHUB_EVENT_BEFORE} ${env.GITHUB_SHA}`;
  }
  return 'HEAD';
}

export function evaluateFirewall({ root, mode = 'all', files = null, env = process.env } = {}) {
  const rows = loadRegistry(root);
  const bugs = rows.map(r => r.bug);
  const errors = [];
  const blocking = bugs.filter(isBlocking);

  for (const bug of bugs) errors.push(...fakeVerificationErrors(bug));

  const required = [
    path.join(root, '.github/workflows/kelo-evolution-autopilot.yml'),
    path.join(root, '.github/workflows/iphone-improvement-firewall.yml'),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      errors.push(`missing ${path.relative(root, file)}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('firewall:iphone') && !text.includes('iphone-real-device-firewall')) {
      errors.push(`${path.relative(root, file)} must invoke the iPhone firewall`);
    }
  }

  const wantFreeze = mode === 'all' || mode === 'freeze' || mode === 'advance';
  if (wantFreeze && blocking.length) {
    if (mode === 'freeze') {
      errors.push(`ADVANCE FROZEN until real-iPhone verification: ${blocking.map(b => `${b.id} (${b.status})`).join(', ')}`);
    } else {
      const range = resolveDiffRange(env);
      const changed = files || changedFilesFromGit(root, range);
      const forbidden = changed.filter(f => !allowedPath(f, blocking));
      if (forbidden.length) {
        errors.push(`ADVANCE FROZEN by ${blocking.map(b => b.id).join(', ')}. Unrelated improvements are invalid until those bugs pass on a real iPhone. Blocked files:\n- ${forbidden.join('\n- ')}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    blocking: blocking.map(b => ({ id: b.id, status: b.status, severity: b.severity, title: b.title })),
    bugs: bugs.length,
  };
}

function parseMode(argv) {
  const idx = argv.indexOf('--mode');
  if (idx >= 0) return argv[idx + 1] || 'all';
  const flagged = argv.find(a => a.startsWith('--mode='));
  if (flagged) return flagged.slice(7);
  return 'all';
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('iphone-real-device-firewall.mjs')) {
  const root = process.cwd();
  const mode = parseMode(process.argv.slice(2));
  const result = evaluateFirewall({ root, mode });
  if (result.blocking.length) {
    console.log(`iPhone firewall blocking bugs: ${result.blocking.map(b => `${b.id}:${b.status}`).join(', ')}`);
  }
  if (!result.ok) {
    console.error('IPHONE REAL-DEVICE FIREWALL FAILED');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`IPHONE REAL-DEVICE FIREWALL PASS — ${result.bugs} bug(s), ${result.blocking.length} blocking, mode=${mode}`);
}

/* KELO-INDEX
 * area: REPOSITORY / BRANCH GOVERNANCE
 * owner: Main Stability Gate
 * purpose: prevent retired historical branches from being merged back into main
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const manifestPath = path.join(process.cwd(), '.github', 'retired-branches.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.schemaVersion, 1, 'unsupported retired-branches schema');
assert.ok(Array.isArray(manifest.retired), 'retired must be an array');

const names = new Set();
for (const entry of manifest.retired) {
  assert.equal(typeof entry.name, 'string', 'retired branch name must be a string');
  assert.ok(entry.name.trim(), 'retired branch name cannot be empty');
  assert.ok(!names.has(entry.name), `duplicate retired branch: ${entry.name}`);
  names.add(entry.name);
  assert.equal(entry.allowAsPrHead, false, `${entry.name} must explicitly disallow PR-head use`);
  assert.equal(typeof entry.replacement, 'string', `${entry.name} replacement must be declared`);
  assert.equal(typeof entry.reason, 'string', `${entry.name} reason must be declared`);
}

const normalize = value => String(value || '').replace(/^refs\/heads\//, '').trim();
const classify = branch => {
  const normalized = normalize(branch);
  const retired = manifest.retired.find(entry => entry.name === normalized) || null;
  return { branch: normalized, blocked: Boolean(retired), retired };
};

if (process.argv.includes('--self-test')) {
  const known = manifest.retired[0];
  assert.ok(known, 'retired branch registry must contain at least one entry');
  assert.equal(classify(known.name).blocked, true, 'known retired branch must be blocked');
  assert.equal(classify(`refs/heads/${known.name}`).blocked, true, 'ref-prefixed retired branch must be blocked');
  assert.equal(classify('main').blocked, false, 'main must not be blocked');
  assert.equal(classify('feature/safe-example').blocked, false, 'ordinary branches must not be blocked');
  console.log(`RETIRED BRANCH GUARD SELF-TEST PASS retired=${manifest.retired.length}`);
  process.exit(0);
}

const head = normalize(process.env.KELO_PR_HEAD || process.env.GITHUB_HEAD_REF || process.argv[2]);
if (!head) {
  console.log(`RETIRED BRANCH GUARD PASS retired=${manifest.retired.length} head=none`);
  process.exit(0);
}

const result = classify(head);
if (result.blocked) {
  console.error(`RETIRED BRANCH BLOCKED: ${result.branch}`);
  console.error(`replacement=${result.retired.replacement}`);
  console.error(`reason=${result.retired.reason}`);
  process.exit(1);
}

console.log(`RETIRED BRANCH GUARD PASS retired=${manifest.retired.length} head=${head}`);

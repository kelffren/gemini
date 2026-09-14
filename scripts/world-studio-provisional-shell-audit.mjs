import assert from 'node:assert/strict';
import { releaseWorldStudioViewport } from '../src/studio/integration/world-studio-bridge.mjs';

function makeShell({ loading = true } = {}) {
  const shell = {
    dataset: { shellVersion: 'studio-live-shell-v1.7.0', ...(loading ? { keloWorldLoading: '1' } : {}) },
    stylePresent: true,
    replacedWith: null,
    cloneCount: 0,
    querySelector(selector) { return selector === '.ks-top' ? {} : null; },
    removeAttribute(name) { if (name === 'style') this.stylePresent = false; },
    cloneNode(deep) {
      assert.equal(deep, true);
      this.cloneCount++;
      return makeShell({ loading });
    },
    replaceWith(next) { this.replacedWith = next; },
  };
  return shell;
}

{
  const provisional = makeShell({ loading: true });
  let current = provisional;
  provisional.replaceWith = next => { provisional.replacedWith = next; current = next; };
  const root = { document: { getElementById: id => id === 'kelo-studio-live' ? current : null } };
  assert.equal(releaseWorldStudioViewport(root), true);
  assert.equal(provisional.cloneCount, 1, 'loading shell must be cloned exactly once to drop provisional listeners');
  assert.notEqual(current, provisional, 'loading shell must be replaced');
  assert.equal(current.stylePresent, false, 'replacement must expose the game viewport');
}

{
  const finalShell = makeShell({ loading: false });
  const root = { document: { getElementById: id => id === 'kelo-studio-live' ? finalShell : null } };
  assert.equal(releaseWorldStudioViewport(root), true);
  assert.equal(finalShell.cloneCount, 0, 'interactive shell must keep its real event listeners');
  assert.equal(finalShell.stylePresent, false, 'interactive shell must not retain the opaque launch style');
}

console.log('world-studio provisional shell audit: ok');

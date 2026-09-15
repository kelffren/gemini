/* KELO-INDEX
 * area: TEST / STUDIO BUILD TOOLS / DOM FEEDBACK
 * owner: BUG-0003 A10 regression contract
 * purpose: prevent childList MutationObserver feedback loops from non-idempotent text writes in mobile build tools
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const quick=read('src/studio/tools/quick-build-tool.mjs');
const room=read('src/studio/tools/room-build-tool.mjs');
const material=read('src/studio/tools/room-material-tool.mjs');

test('Quick Build lifecycle observer uses idempotent text writes',()=>{
  assert.match(quick,/const setText=.*textContent!==next/);
  assert.match(quick,/setText\(launcher,active\?/);
  assert.match(quick,/setText\(s,dragPreviews/);
  assert.match(quick,/idempotent-dom/);
});

test('Room Build lifecycle observer uses idempotent text writes',()=>{
  assert.match(room,/const setText=.*textContent!==next/);
  assert.match(room,/setText\(button,label\)/);
  assert.match(room,/idempotent-dom/);
});

test('Room Material lifecycle observer uses idempotent text writes',()=>{
  assert.match(material,/const setText=.*textContent!==next/);
  assert.match(material,/setText\(button,/);
  assert.match(material,/idempotent-dom/);
});

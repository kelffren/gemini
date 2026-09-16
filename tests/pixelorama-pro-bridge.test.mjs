import assert from 'node:assert/strict';
import {PIXELORAMA_WEB_URL,installPixeloramaProBridge} from '../src/creators/ui/pixelorama-pro-bridge.mjs';

assert.equal(PIXELORAMA_WEB_URL,'https://orama-interactive.github.io/Pixelorama/');
assert.equal(typeof installPixeloramaProBridge,'function');

console.log('pixelorama-pro-bridge.test.mjs: OK');

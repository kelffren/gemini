import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');

assert.match(source,/const HOLD_DELAY_MS=320;/,'mobile nudge hold must wait before repeating');
assert.match(source,/const HOLD_REPEAT_MS=90;/,'mobile nudge repeat cadence must stay responsive');
assert.match(source,/pad\.addEventListener\('pointerdown',onPadPointerDown\)/,'mobile nudge must start on pointerdown');
assert.match(source,/pad\.addEventListener\('pointerup',stopHold\)/,'pointerup must stop mobile nudge repeat');
assert.match(source,/pad\.addEventListener\('pointercancel',stopHold\)/,'pointercancel must stop mobile nudge repeat');
assert.match(source,/pad\.addEventListener\('lostpointercapture',stopHold\)/,'lost pointer capture must stop mobile nudge repeat');
assert.match(source,/triggerMobileNudge\(dir\);holdTimeout=later/,'held nudge must move immediately before the repeat delay');
assert.match(source,/holdInterval=every\(\(\)=>\{if\(holdDir&&canTouchNudge\(\)\)triggerMobileNudge\(holdDir\);\},HOLD_REPEAT_MS\)/,'held nudge must repeat through the shared mobile nudge path');
assert.match(source,/if\(suppressDirectionClick\)\{suppressDirectionClick=false;return;\}/,'synthetic click after pointerdown must not double-nudge');
assert.match(source,/if\(!visible\)stopHold\(\)/,'hiding the mobile nudge pad must terminate hold repeat');
assert.match(source,/destroy\(\)\{destroyed=true;stopHold\(\);/,'Studio teardown must clear active nudge timers');
assert.match(source,/void nudge\(vector\[0\],vector\[1\],\{step:mobileStep\(\)\}\)/,'held movement must keep using the reversible nudge command path');
assert.match(source,/await kernel\.execute\(command\)/,'persistent movement must still pass through Kernel CommandBus');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'hold-repeat controller must not write authority directly');
assert.match(source,/studio-nudge-v1\.2\.0-mobile-hold-repeat/,'controller version must expose hold-repeat behavior');

console.log(JSON.stringify({ok:true,mobileSelectionHoldRepeat:true,holdDelayMs:320,repeatMs:90,immediateFirstNudge:true,syntheticClickSuppressed:true,commandBusPreserved:true,authorityDirectWrite:false,cleanup:true},null,2));

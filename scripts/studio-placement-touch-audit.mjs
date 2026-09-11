import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/studio/input/studio-placement-touch-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

assert.match(source,/createStudioPlacementTouchController/,'placement touch controller must expose a focused public factory');
assert.match(source,/data-place-dir="up"/,'mobile placement pad needs up');
assert.match(source,/data-place-dir="down"/,'mobile placement pad needs down');
assert.match(source,/data-place-dir="left"/,'mobile placement pad needs left');
assert.match(source,/data-place-dir="right"/,'mobile placement pad needs right');
assert.match(source,/COLOCAR AQUÍ/,'mobile placement must expose an explicit commit control');
assert.match(source,/await placement\.commit\(\)/,'explicit placement must reuse canonical placement commit');
assert.match(source,/prefabId:String\(preview\.prefabId\|\|''\)/,'continuous placement must capture the active prefab before commit clears the ghost');
assert.match(source,/rotation:Number\(preview\.transform\?\.rotation\)\|\|0/,'continuous placement must preserve preview rotation');
assert.match(source,/components:\{\.\.\.\(preview\.components\|\|\{\}\)\}/,'continuous placement must preserve component overrides');
assert.match(source,/placement\.start\(current\.prefabId,\{rotation:current\.rotation,overrides:\{components:current\.components\}\}\)/,'successful touch placement must restart the same asset through the canonical placement tool');
assert.match(source,/placement\.move\(current\.x,current\.y,\{snap:1\}\)/,'restarted placement must keep the confirmed position for immediate repeated stamping');
assert.match(source,/if\(!destroyed&&current\.prefabId&&placement\.start\)/,'controller must not resurrect placement after teardown');
assert.match(source,/placement\.move\(x,y,\{snap:1\}\)/,'precision pad must move the existing ghost instead of inventing a second placement document path');
assert.match(source,/placement\.rotate\?\.\(90\)/,'rotation must delegate to placement tool');
assert.match(source,/placement\.cancel\?\.\(\)/,'cancel must delegate to placement tool');
assert.match(source,/mode==='fine'\?1:mode==='coarse'\?snapStep\(\)\*4:snapStep\(\)/,'pad must provide snap, 1px and coarse movement');
assert.match(source,/min-width:46px;min-height:46px/,'touch targets must exceed 44px');
assert.match(source,/env\(safe-area-inset-bottom\)/,'pad must respect iPhone safe area');
assert.match(source,/Number\(root\.innerWidth\|\|9999\)>MOBILE_MAX/,'desktop must not mount the mobile placement pad');
assert.match(source,/unsubscribe\?\.\(\)/,'destroy must release placement preview subscription');
assert.match(source,/studio-placement-touch-v1\.1\.0-continuous/,'controller version must expose continuous-placement behavior');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'touch layer must not write authority directly');
assert.doesNotMatch(source,/kernel\.execute/,'touch layer must not bypass placement tool / CommandBus');

assert.match(entry,/import \{ createStudioPlacementTouchController \}/,'Studio entry must import placement touch integration');
assert.match(entry,/createStudioPlacementTouchController\(\{root,placement:tools\.placement\}\)/,'Studio entry must reuse the registered canonical placement tool');
assert.match(entry,/placementTouchController/,'Studio session must retain the placement touch controller');
assert.match(entry,/placementTouchController\.destroy\(\)/,'Studio close must release placement touch UI');

console.log(JSON.stringify({ok:true,mobilePlacementPad:true,directions:4,explicitCommit:true,continuousStamping:true,preservesRotation:true,preservesOverrides:true,stepModes:['snap','1px','4x'],canonicalPlacement:true,commandBusPreserved:true,touchTargetPx:46,safeArea:true,cleanup:true,versionIndependentIntegration:true},null,2));

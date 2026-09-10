import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contextInspectorFields } from '../src/studio/ui/studio-context-inspector.mjs';

const fields=contextInspectorFields({transform:{x:12.5,y:-8,rotation:45,scale:1.25}});
assert.deepEqual(fields,{x:12.5,y:-8,rotation:45,scalePercent:125},'context inspector fields must reflect transform values');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-context-inspector.mjs',import.meta.url),'utf8');
assert.match(source,/ks-context-inspector-on \.ks-selection-float\{display:none!important\}/,'new inspector must replace the older floating HUD rather than stack on top of it');
assert.match(source,/data-context-prop="x"/,'context card must expose X');
assert.match(source,/data-context-prop="y"/,'context card must expose Y');
assert.match(source,/data-context-prop="rotation"/,'context card must expose rotation');
assert.match(source,/data-context-prop="scalePercent"/,'context card must expose scale');
assert.match(source,/\.ks-right \.ks-properties/,'property edits must proxy the existing Properties UI');
assert.match(source,/dispatchEvent\(new EventCtor\('change'/,'property edits must delegate through the existing change pipeline');
assert.match(source,/\['select','move'\]\.includes/,'card must remain contextual to object editing modes');
assert.match(source,/paintCopies\?\.state\?\.\(\)\.enabled/,'card must hide while Paint Copies owns the canvas');
assert.match(source,/document\.activeElement!==input/,'live refresh must not overwrite a field while the user is typing');
assert.match(source,/data-context-close/,'user must be able to hide the contextual inspector without deselecting the object');
assert.match(source,/data-context-toggle/,'user must be able to collapse the contextual inspector');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioContextInspector/,'Studio entry must install the contextual inspector');
assert.match(entry,/contextInspector\.destroy\(\)/,'Studio close must clean up the contextual inspector');
assert.match(entry,/kelo-studio-foundation-v1\.8\.0/,'Studio foundation version must include contextual inspector release');

console.log(JSON.stringify({ok:true,contextFields:true,propertyProxy:true,cleanHudReplacement:true,modeAware:true,collapsible:true},null,2));

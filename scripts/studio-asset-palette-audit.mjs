import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assetPaletteCategories, filterAssetPaletteRows } from '../src/studio/ui/studio-asset-palette.mjs';

const rows=[
  {id:'tree:oak',label:'Oak Tree',category:'nature'},
  {id:'tree:palm',label:'Palm Tree',category:'nature'},
  {id:'wall:gold',label:'Gold Wall',category:'architecture'},
  {id:'shop:kiosk',label:'Market Kiosk',category:'shops'}
];

assert.deepEqual(assetPaletteCategories(rows,7),[
  {id:'nature',count:2},{id:'architecture',count:1},{id:'shops',count:1}
],'categories must prioritize the most useful groups without changing catalog data');
assert.deepEqual(filterAssetPaletteRows(rows,{query:'oak'}).map(x=>x.id),['tree:oak'],'search must match human labels');
assert.deepEqual(filterAssetPaletteRows(rows,{category:'architecture'}).map(x=>x.id),['wall:gold'],'category filter must reduce visual noise');
assert.deepEqual(filterAssetPaletteRows(rows,{category:'recent',recentIds:['shop:kiosk','tree:oak']}).map(x=>x.id),['shop:kiosk','tree:oak'],'recent assets must preserve most-recent-first order');
assert.equal(filterAssetPaletteRows(rows,{limit:2}).length,2,'palette must cap rendered cards for a light workspace');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-asset-palette.mjs',import.meta.url),'utf8');
assert.match(source,/\[data-clean-action="assets"\],\[data-act="edit-assets"\]/,'clean Assets and legacy EDIT must route to the floating palette');
assert.match(source,/stopImmediatePropagation/,'palette interception must prevent the old heavy browser opening at the same time');
assert.match(source,/selectThroughShell/,'asset choice must delegate to the existing shell placement flow');
assert.match(source,/\.ks-asset-search/,'placement proxy must reuse the existing searchable asset bridge');
assert.match(source,/BIBLIOTECA COMPLETA/,'advanced creator prefabs must remain reachable through the legacy full library');
assert.match(source,/recentIds/,'palette must keep a session-local recent list for repeated construction');
assert.match(source,/grid-template-columns:repeat\(3/,'mobile palette must use a compact touch-friendly grid');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioAssetPalette/,'Studio boot must install the floating asset palette');
assert.match(entry,/assetPalette\.destroy\(\)/,'Studio close must clean up the palette');
assert.match(entry,/assetPalette\.refresh\(\)/,'world import must refresh palette data');
assert.match(entry,/kelo-studio-foundation-v1\.9\.0/,'Studio version must include the asset palette release');

console.log(JSON.stringify({ok:true,search:true,categories:true,recent:true,renderCap:true,legacyPlacementProxy:true,fullLibraryFallback:true,mobileGrid:true},null,2));

import fs from 'node:fs';
const launcher=fs.readFileSync('src/ui/asset-library-launcher.js','utf8');
const bridge=fs.readFileSync('src/studio/integration/library-build-bridge.mjs','utf8');
const checks=[
  ['launcher imports infinite palette bridge',/library-build-bridge\.mjs\?v=6-infinite-palette/.test(launcher)],
  ['launcher detects active semantic brush',/libraryPaletteBrush/.test(launcher)&&/state\?\.\(\)\.active/.test(launcher)],
  ['launcher refreshes instead of restarting',/refreshPersonalAssetPalette/.test(launcher)&&/startPersonalAssetPalette/.test(launcher)],
  ['bridge preserves palette on insufficient variants',/unchanged:true/.test(bridge)&&/INSUFFICIENT_VARIANTS/.test(bridge)]
];
let failed=0;
for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed++;}
if(failed)process.exit(1);

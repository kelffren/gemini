import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const checks=[
  ['creator hub complete',()=>{const t=read('src/creators/ui/creator-hub.mjs');return t.length>15000&&/export (?:async )?function openCreatorHub/.test(t)&&/worldEditorReady/.test(t)&&/scene-kit/.test(t)}],
  ['asset vault complete',()=>{const t=read('asset-vault.html');return t.length>10000&&/Biblioteca Universal/.test(t)&&!/^(SEE_LOCAL|PLACEHOLDER)\s*$/.test(t.trim())}],
  ['property graph complete',()=>{const a=read('src/core/feature-registry.js'),b=read('src/core/module-loader.js'),w=read('src/creators/workspaces/world-workspace.mjs');return a.includes("'property-core'")&&a.includes("instance-system.js?v=1")&&b.includes("'property-core'")&&w.includes("loader.ensure('property-core')")}],
  ['mobile more sheet sync',()=>read('src/studio/ui/studio-mobile-ui-polish.mjs').includes('function advancedToolsOpen')],
  ['runtime atlas urls versioned',()=>{const a=read('src/environment/tile-registry.js'),b=read('src/environment/prop-contract.js');return /pn-233db909\.png\?/.test(a)&&/prt-fc9790cb\.png\?/.test(b)&&/pf-f5ba82df\.png\?/.test(b)}]
];
let failed=0;for(const [name,fn] of checks){let ok=false;try{ok=!!fn()}catch{}console.log(ok?'PASS':'FAIL',name);if(!ok)failed++;}if(failed)process.exit(1);
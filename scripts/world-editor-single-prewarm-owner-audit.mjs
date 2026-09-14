import fs from 'node:fs';

const workspace=fs.readFileSync('src/creators/workspaces/world-workspace.mjs','utf8');
const bridge=fs.readFileSync('src/studio/integration/world-studio-bridge.mjs','utf8');

const openStart=workspace.indexOf('async open({root=globalThis');
const openEnd=workspace.indexOf('\n    }\n  });',openStart);
if(openStart<0||openEnd<0)throw new Error('World workspace open path not found');
const openPath=workspace.slice(openStart,openEnd);
if(openPath.includes('preloadPhoneStudioRuntime(root)'))throw new Error('World open path must not run the legacy broad Studio prewarm');
if(!workspace.includes("const WORLD_BUILD='world-bridge-20260914-12'"))throw new Error('World workspace must cache-bust to the current bridge build');
if(!bridge.includes('await prewarmIphoneStudioRuntime(root)'))throw new Error('Studio bridge must remain the single iPhone prewarm owner');
if(!bridge.includes('for(let i=0;i<roots.length;i++)'))throw new Error('Bridge iPhone prewarm must remain serialized');

console.log('world-editor-single-prewarm-owner-audit: PASS');

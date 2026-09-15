/* KELO-INDEX
 * area: QA / CREATOR OS
 * owner: Creator OS static audit
 * keys: CREATOR LIBRARY AUDIT TYPES ROUTES DOCS LAZY
 * purpose: fail fast when Creator Library loses required types, documented owners, lazy entry wiring or catalog registration
 * public-api: CLI only — node scripts/creator-os-library-audit.mjs
 * consumes: creator-content-types + repository text/docs
 * state-owned: none
 * do-not: does not replace Playwright, iPhone or LIVE validation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CREATOR_CONTENT_TYPES,getCreatorContentType} from '../src/creators/library/creator-content-types.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const requiredTypes=['character','skin','weapon','armor','item','prop','furniture','environment','prefab','world','map','vfx','animation','ui-art','mount','npc','ability','sprite-ability','audio','cinematic','seasonal-pack'];
const knownWorkspaces=new Set(['avatar','appearance','item','asset-forge','environment','prefab','world','map-forge','vfx','animation','mount','npc','ability','sprite-ability','audio','cinematic','content-studio']);
const failures=[];
const assert=(condition,message)=>{if(!condition)failures.push(message);};
const read=relative=>fs.readFile(path.join(root,relative),'utf8');

const ids=CREATOR_CONTENT_TYPES.map(row=>row.id);
assert(new Set(ids).size===ids.length,'content type ids must be unique');
for(const id of requiredTypes)assert(!!getCreatorContentType(id),`missing required content type: ${id}`);
for(const row of CREATOR_CONTENT_TYPES){assert(knownWorkspaces.has(row.workspaceId),`unknown workspace route ${row.id} -> ${row.workspaceId}`);assert(row.label&&row.group&&row.runtimeOwner,`incomplete content type metadata: ${row.id}`);}

const entry=await read('src/creators/creator-entry.mjs');
assert(entry.includes('registerCreatorLibraryWorkspace(workspaces)'), 'creator-entry must register Creator Library');
assert(entry.includes('registerImageLabWorkspace(workspaces)'), 'creator-entry must register Image Lab');
assert(entry.includes('workspaces,dependencies'), 'Creator workspace context must expose registry to router UIs');

const lazy=await read('src/core/creators-lazy-gate.js');
assert(lazy.includes("platform.openWorkspace('creator-library')"), 'lazy gate must route direct Creator Library entry');
assert(!lazy.includes('await loadAssetCatalog();const platform=await loadPlatform()'), 'Creator Library must not require full asset catalog before open');

const catalog=JSON.parse(await read('docs/system-catalog.json'));
assert(catalog.systems?.some(row=>row.id==='creator-os-library'&&row.technicalDoc==='docs/systems/CREATOR_OS_LIBRARY.md'),'system catalog missing Creator OS Library');
for(const relative of ['docs/systems/CREATOR_OS_LIBRARY.md','docs/IMPLEMENTATION_LEDGER.md','src/creators/ui/creator-library-workspace.mjs','src/creators/workspaces/creator-library-workspace.mjs','src/creators/workspaces/image-lab-workspace.mjs']){
  try{await fs.access(path.join(root,relative));}catch{failures.push(`missing required file: ${relative}`);}
}

if(failures.length){console.error(`Creator OS audit failed (${failures.length})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else{
  console.log(`Creator OS audit OK · ${CREATOR_CONTENT_TYPES.length} content types · lazy routing/docs contracts present`);
}

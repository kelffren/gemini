/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: AVATAR AUTODETECT GRID NORMALIZE OWNER
 * purpose: contrato estático de Avatar Auto-Detect V2
 * online: valida que persistencia/selección sigan detrás del repository/service
 */
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const checks=[];const ok=(name,cond)=>checks.push({name,ok:!!cond});
const runtime=read('src/characters/creator-avatar-runtime.mjs');
const analyzer=read('src/creators/avatar/avatar-spritesheet-analyzer.mjs');
const service=read('src/creators/avatar/avatar-quick-import-service.mjs');
const ui=read('src/creators/ui/avatar-workspace.mjs');
const entry=read('src/creators/creator-entry.mjs');
const repo=read('src/creators/content/supabase-content-repository.mjs');
const registry=read('src/creators/content/runtime-content-registry.mjs');
const migration=read('supabase/migrations/20260910040057_avatar_quick_import_selection.sql');
ok('runtime reuses KeloAvatar middleware',runtime.includes("KeloAvatar.use('creator-avatar-runtime'")&&!runtime.includes('renderAvatar='));
ok('runtime selection restores locally',runtime.includes('kelo.creator.avatar.selection.v1')&&runtime.includes('localStorage'));
ok('analyzer has component segmentation',analyzer.includes('connectedComponents')&&analyzer.includes('componentGrid')&&analyzer.includes('sourceRects'));
ok('analyzer clusters variable grid instead of hardcoding only 4x4',analyzer.includes('clusterAxis')&&analyzer.includes("mode:'components'")&&analyzer.includes('columns=xs.length'));
ok('analyzer infers directions visually with confidence',analyzer.includes('inferDirections')&&analyzer.includes('headShift')&&analyzer.includes('directionConfidence'));
ok('runtime compiler normalizes irregular source rectangles',analyzer.includes('normalizeRuntime')&&analyzer.includes('drawImage(sourceCanvas,r.x,r.y,r.w,r.h'));
ok('background removal is edge-connected, not global white-key',analyzer.includes('removeConnectedBackground')&&analyzer.includes('queue=new Int32Array'));
ok('quick service persists auto-detect metadata',service.includes('autoDetect')&&service.includes("creator-spritesheet-v2")&&service.includes('normalized:!!compiled.normalized'));
ok('quick service uses universal content service',service.includes('contentService.importJob')&&service.includes("contentType:'character'"));
ok('runtime delivery uses public avatars bucket',service.includes("upload('avatars'")&&service.includes("bucket:'avatars'"));
ok('selection persists per character',service.includes('setActiveCharacterAvatar')&&migration.includes('active_avatar_content_id'));
ok('selection RPC verifies character content ownership',migration.includes('AVATAR_CONTENT_NOT_OWNED_OR_INVALID')&&migration.includes("d.content_type = 'character'"));
ok('UI keeps two-click normal path',ui.includes('+ SUBIR AVATAR')&&ui.includes('USAR COMO AVATAR')&&ui.includes('Sube. Mira. Usa.'));
ok('UI exposes confidence but hides corrections under advanced',ui.includes('AUTO ${pct(analysis.confidenceScore)}')&&ui.includes('Ajustes avanzados · solo si algo se ve mal')&&ui.includes('details.open=!!uncertain'));
ok('UI can correct grid and row map only as fallback',ui.includes('FRENTE · FILA')&&ui.includes('IZQUIERDA · FILA')&&ui.includes('DERECHA · FILA')&&ui.includes('ESPALDA · FILA'));
ok('Creator composition registers Avatar workspace',entry.includes('registerAvatarWorkspace(workspaces)')&&entry.includes('avatarQuick'));
ok('repository exposes avatar APIs',repo.includes('setActiveCharacterAvatar')&&repo.includes('getAvatarManifest')&&repo.includes('listMyCharacters'));
ok('character content routes to existing adapter',registry.includes("type==='character'")&&registry.includes('KeloCreatorAvatars'));
ok('no parallel avatar renderer owner',!runtime.includes('setBase(')&&!service.includes('KeloAvatar.setBase'));
for(const row of checks)console.log(`${row.ok?'✓':'✗'} ${row.name}`);
const failed=checks.filter(x=>!x.ok);if(failed.length){console.error(`Avatar Auto-Detect V2 audit failed: ${failed.length}`);process.exit(1);}console.log(`Avatar Auto-Detect V2 audit passed: ${checks.length}/${checks.length}`);

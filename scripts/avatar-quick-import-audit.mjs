/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: AVATAR UNIVERSAL COMPILER SELF-HEAL VALIDATE CANONICAL-RIG OWNER
 * purpose: static architecture contract for Kelo Universal Asset Compiler V5
 * online: validates that persistence/selection remain behind repository/service
 */
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const checks=[];const ok=(name,cond)=>checks.push({name,ok:!!cond});
const runtime=read('src/characters/creator-avatar-runtime.mjs');
const analyzer=read('src/creators/avatar/avatar-spritesheet-analyzer.mjs');
const compiler=read('src/creators/avatar/kelo-universal-asset-compiler.mjs');
const service=read('src/creators/avatar/avatar-quick-import-service.mjs');
const ui=read('src/creators/ui/avatar-workspace.mjs');
const entry=read('src/creators/creator-entry.mjs');
const repo=read('src/creators/content/supabase-content-repository.mjs');
const registry=read('src/creators/content/runtime-content-registry.mjs');
const migration=read('supabase/migrations/20260910040057_avatar_quick_import_selection.sql');
ok('runtime reuses KeloAvatar middleware',runtime.includes("KeloAvatar.use('creator-avatar-runtime'")&&!runtime.includes('renderAvatar='));
ok('runtime selection restores locally',runtime.includes('kelo.creator.avatar.selection.v1')&&runtime.includes('localStorage'));
ok('V4 remains available as deterministic strategy',analyzer.includes('connectedComponents')&&analyzer.includes('adaptiveCuts')&&analyzer.includes('sourceRects'));
ok('universal compiler wraps V4 instead of duplicating renderer ownership',compiler.includes("from './avatar-spritesheet-analyzer.mjs'")&&compiler.includes('analyzeAvatarSpriteSheet')&&compiler.includes('compileAvatarRuntime'));
ok('compiler generates competing hypotheses',compiler.includes('buildHypotheses')&&compiler.includes('grid-candidate')&&compiler.includes('horizontal-strip')&&compiler.includes('single-character'));
ok('compiler validates compiled frames before acceptance',compiler.includes('validateCompiled')&&compiler.includes('sizeConsistency')&&compiler.includes('bottomConsistency')&&compiler.includes('edgeSafety'));
ok('compiler self-heals weak background interpretation',compiler.includes("best.validation.health<.82")&&compiler.includes("[.72,1.22]")&&compiler.includes('selfHealed'));
ok('compiler emits canonical four-direction Kelo rig',compiler.includes("faces=['down','left','right','up']")&&compiler.includes('rows:4')&&compiler.includes('canonicalRig:true'));
ok('compiler mirrors missing side direction only as fallback',compiler.includes("face==='left'")&&compiler.includes('map.left===map.right'));
ok('manual corrections bypass hypothesis tournament but still canonicalize',compiler.includes("config?.detectionMode==='manual'")&&compiler.includes("strategy:'manual'"));
ok('quick service persists universal compiler metadata',service.includes('compilerVersion')&&service.includes('canonicalRig')&&service.includes('selfHealed')&&service.includes('validation'));
ok('quick service uses universal compiler',service.includes('compileUniversalAvatarRuntime')&&service.includes("source:'kelo-universal-asset-compiler-v5'"));
ok('quick service uses universal content service',service.includes('contentService.importJob')&&service.includes("contentType:'character'"));
ok('runtime delivery uses public avatars bucket',service.includes("upload('avatars'")&&service.includes("bucket:'avatars'"));
ok('selection persists per character',service.includes('setActiveCharacterAvatar')&&migration.includes('active_avatar_content_id'));
ok('selection RPC verifies character content ownership',migration.includes('AVATAR_CONTENT_NOT_OWNED_OR_INVALID')&&migration.includes("d.content_type = 'character'"));
ok('UI keeps two-click normal path',ui.includes('+ SUBIR AVATAR')&&ui.includes('USAR COMO AVATAR')&&ui.includes('Sube. Detecta. Repara. Usa.'));
ok('UI previews canonical compiled output',ui.includes('previewCompiled')&&ui.includes('compileUniversalAvatarRuntime')&&ui.includes('RIG KELO 4D'));
ok('UI exposes health/confidence while keeping corrections advanced',ui.includes('SALUD ${pct(compiled.validation.health)}')&&ui.includes('Ajustes avanzados · solo si algo se ve mal')&&ui.includes('details.open=!!uncertain'));
ok('UI can correct grid and row map only as fallback',ui.includes('FRENTE · FILA')&&ui.includes('IZQUIERDA · FILA')&&ui.includes('DERECHA · FILA')&&ui.includes('ESPALDA · FILA'));
ok('Creator composition registers Avatar workspace',entry.includes('registerAvatarWorkspace(workspaces)')&&entry.includes('avatarQuick'));
ok('repository exposes avatar APIs',repo.includes('setActiveCharacterAvatar')&&repo.includes('getAvatarManifest')&&repo.includes('listMyCharacters'));
ok('character content routes to existing adapter',registry.includes("type==='character'")&&registry.includes('KeloCreatorAvatars'));
ok('no parallel avatar renderer owner',!compiler.includes('KeloAvatar.use(')&&!service.includes('KeloAvatar.setBase'));
for(const row of checks)console.log(`${row.ok?'✓':'✗'} ${row.name}`);
const failed=checks.filter(x=>!x.ok);if(failed.length){console.error(`Universal Asset Compiler V5 audit failed: ${failed.length}`);process.exit(1);}console.log(`Universal Asset Compiler V5 audit passed: ${checks.length}/${checks.length}`);

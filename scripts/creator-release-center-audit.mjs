/* KELO-INDEX
 * area: QA / CREATORS RELEASE
 * owner: Creator Release Center static audit
 * keys: CREATOR RELEASE REVIEW PUBLICATION SERVICE ROLE RLS OWNER FILTER
 * purpose: fail if Creator release UI bypasses review authority or loses owner scoping
 * online: static contract audit only; does not replace Supabase/LIVE verification
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const checks=[];
const check=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});

const service=read('src/creators/release/creator-release-service.mjs');
const repo=read('src/creators/content/supabase-content-repository.mjs');
const ui=read('src/creators/ui/content-studio-workspace.mjs');
const migration=read('supabase/migrations/20260910024046_universal_content_registry.sql');
const doc=read('docs/systems/UNIVERSAL_CONTENT_STUDIO.md');
const ledger=read('docs/IMPLEMENTATION_LEDGER.md');

check('release service reads reviews',service.includes('listMyReviews'));
check('release service reads publications',service.includes('listActivePublicationsForRevisions'));
check('release service delegates review submission',service.includes('submitContentRevision'));
check('release service never calls publish RPC',!service.includes('publish_content_revision'));
check('repository owner-filters listMyContent',repo.includes('owner_user_id=eq.${encodeURIComponent(uid)}'));
check('repository exposes review reads',repo.includes('listMyReviews'));
check('repository exposes active publication reads',repo.includes('listActivePublicationsForRevisions'));
check('repository has no client publish helper',!repo.includes("publishContentRevision")&&!repo.includes("rpc('publish_content_revision'"));
check('release center UI exists',ui.includes('5 · RELEASE CENTER'));
check('release UI presents submit review',ui.includes('SUBMIT REVIEW'));
check('release UI has no publish action',!ui.includes("text:'PUBLISH'")&&!ui.includes('publish_content_revision'));
check('database review states canonical',migration.includes("status in ('pending','approved','rejected','cancelled')"));
check('authenticated clients cannot execute publish RPC',migration.includes('revoke all on function public.publish_content_revision(uuid,text,uuid) from public, anon, authenticated'));
check('only service role receives publish RPC',migration.includes('grant execute on function public.publish_content_revision(uuid,text,uuid) to service_role'));
check('technical doc records release center',doc.includes('Release Center'));
check('implementation ledger records release pass',ledger.includes('IMP-2026-09-15-CREATOR-RELEASE-002'));

const failed=checks.filter(row=>!row.ok);
for(const row of checks)console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` · ${row.detail}`:''}`);
if(failed.length){console.error(`\nCreator Release Center audit failed: ${failed.length}/${checks.length}`);process.exitCode=1;}else console.log(`\nCreator Release Center audit passed: ${checks.length}/${checks.length}`);

/* KELO-INDEX
 * area: BUILD / EVERGREEN QA
 * owner: existing Foundation CI discipline
 * keys: EVERGREEN CONTRACT MIGRATION LOCKFILE SBOM DEPRECATION TEN-YEAR AUDIT
 * purpose: verify the long-horizon compatibility policy without adding a runtime manager or touching gameplay
 * public-api: CLI only
 * consumes: config/evergreen-*.json + existing owner source files + content migration primitive
 * online: N/A; CI/build audit
 * do-not: NO production mutation, NO network, NO package installation
 */
import {access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createContractRegistry} from '../src/core/evergreen-contracts.mjs';
import {CURRENT_CONTENT_SCHEMA_VERSION,createContentSchemaMigrationRegistry} from '../src/creators/content/content-schema-migrations.mjs';

const ROOT=resolve(new URL('..',import.meta.url).pathname);
const readJson=async path=>JSON.parse(await readFile(resolve(ROOT,path),'utf8'));
const exists=async path=>{try{await access(resolve(ROOT,path));return true;}catch{return false;}};
const fail=[];const ok=[];
function check(condition,message){(condition?ok:fail).push(message);}

const policy=await readJson('config/evergreen-policy.json');
const contractsDoc=await readJson(policy.contracts.catalog);
const deprecationsDoc=await readJson(policy.contracts.deprecations);
const rootPkg=await readJson('package.json');
const serverPkg=await readJson('server/package.json');
const nodeVersion=String(await readFile(resolve(ROOT,policy.runtime.nodeFile),'utf8')).trim();

check(policy.targetHorizonYears>=10,'policy targets at least 10 years');
check(Number(nodeVersion.split('.')[0])===policy.runtime.nodeMajor,'root runtime major matches evergreen policy');
check(String(serverPkg.engines?.node||'').includes(String(policy.runtime.nodeMajor)),'server Node engine matches evergreen runtime major');
check(Array.isArray(contractsDoc.contracts)&&contractsDoc.contracts.length>=5,'critical contract catalog exists');
check(Array.isArray(deprecationsDoc.deprecations),'deprecation ledger is structured');
check(CURRENT_CONTENT_SCHEMA_VERSION===policy.content.currentSchemaVersion,'content migration runtime matches policy schema version');

for(const path of Object.values(policy.reuseExistingOwners))check(await exists(path),`reused owner exists: ${path}`);
check(await exists(policy.dependencies.updateAutomation),'Dependabot automation exists');
check(await exists(policy.content.migrationModule),'content migration module exists');
check(await exists(policy.ci.workflow),'evergreen CI workflow exists');

const contractRegistry=createContractRegistry();
for(const row of contractsDoc.contracts)contractRegistry.register(row);
check(contractRegistry.size===contractsDoc.contracts.length,'all evergreen contracts parse and register');
for(const row of contractsDoc.contracts)check(contractRegistry.canConsume(row.id,row.version),`contract reads its own version: ${row.id}`);

const mock=createContentSchemaMigrationRegistry({currentVersion:3});
mock.register({from:1,migrate:row=>({...row,payload:{...(row.payload||{}),m1:true}})});
mock.register({from:2,migrate:row=>({...row,payload:{...(row.payload||{}),m2:true}})});
const original={schemaVersion:1,contentId:'evergreen.test',stableKey:'evergreen.test',payload:{value:1}};
const migrated=mock.migrate(original);
check(migrated.schemaVersion===3&&migrated.payload.m1&&migrated.payload.m2,'content migration chain reaches current version');
check(original.schemaVersion===1&&!original.payload.m1,'content migration never mutates source record');
let identityProtected=false;try{
  const bad=createContentSchemaMigrationRegistry({currentVersion:2});
  bad.register({from:1,migrate:row=>({...row,contentId:'changed'})});
  bad.migrate(original);
}catch(error){identityProtected=String(error?.message||error).includes('IDENTITY_CHANGED');}
check(identityProtected,'content migration protects stable identity');

for(const item of deprecationsDoc.deprecations){
  const announced=Date.parse(item.announcedAt),remove=Date.parse(item.removeAfter);
  check(Number.isFinite(announced)&&Number.isFinite(remove),`deprecation dates parse: ${item.id}`);
  if(Number.isFinite(announced)&&Number.isFinite(remove))check((remove-announced)/86400000>=policy.deprecation.minimumNoticeDays,`deprecation notice >= ${policy.deprecation.minimumNoticeDays}d: ${item.id}`);
  if(policy.deprecation.requireReplacementForPublicContract)check(Boolean(item.replacement),`deprecation replacement declared: ${item.id}`);
}

const lockRoot=await exists(policy.dependencies.rootLockfile);
const lockServer=await exists(policy.dependencies.serverLockfile);
check(!policy.dependencies.lockfilesRequired||lockRoot,'root package-lock exists');
check(!policy.dependencies.lockfilesRequired||lockServer,'server package-lock exists');
check(Boolean(rootPkg.scripts),'root package scripts remain readable');

console.log(`EVERGREEN FOUNDATION AUDIT · ${ok.length} pass · ${fail.length} fail`);
for(const message of ok)console.log(`PASS ${message}`);
for(const message of fail)console.error(`FAIL ${message}`);
if(fail.length)process.exitCode=1;

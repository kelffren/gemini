/* KELO-INDEX
 * area: BUILD / EVERGREEN QA
 * owner: evergreen quality gate
 * keys: ESLINT TYPESCRIPT KNIP AUDIT ENGINE PINNED TOOLCHAIN STATIC HYGIENE
 * purpose: verify the incremental evergreen static-analysis toolchain is reproducible and aligned with the production runtime
 * public-api: CLI only
 * online: N/A; deterministic CI audit
 * do-not: NO runtime mutation, NO gameplay ownership, NO network
 */
import {access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const ROOT=resolve(new URL('..',import.meta.url).pathname);
const readJson=async path=>JSON.parse(await readFile(resolve(ROOT,path),'utf8'));
const exists=async path=>{try{await access(resolve(ROOT,path));return true;}catch{return false;}};
const failures=[];
const passes=[];
const check=(condition,message)=>(condition?passes:failures).push(message);

const root=await readJson('package.json');
const server=await readJson('server/package.json');
const lock=await readJson('package-lock.json');
const nvm=String(await readFile(resolve(ROOT,'.nvmrc'),'utf8')).trim();

const requiredTools=Object.freeze({
  '@eslint/js':'10.0.1',
  '@types/node':'24.13.5',
  eslint:'10.10.0',
  globals:'17.12.0',
  knip:'6.36.0',
  typescript:'7.0.2'
});
const requiredScripts=[
  'lint:evergreen',
  'typecheck:evergreen',
  'deps:evergreen',
  'audit:security:root',
  'audit:security:server',
  'audit:evergreen-quality'
];
const requiredFiles=[
  'eslint.config.mjs',
  'jsconfig.evergreen.json',
  'knip.evergreen.json',
  '.github/workflows/evergreen-quality.yml'
];

check(root.engines?.node==='>=24.20.0 <25','root Node engine is explicitly bounded to Node 24 LTS');
check(server.engines?.node===root.engines?.node,'root and server Node engine contracts match');
check(Number(nvm.split('.')[0])===24,'nvm runtime remains on Node 24');
check(lock.packages?.['']?.engines?.node===root.engines?.node,'root lockfile records the Node engine contract');

for(const [name,version] of Object.entries(requiredTools)){
  check(root.devDependencies?.[name]===version,`${name} is exactly pinned at ${version}`);
  check(lock.packages?.['']?.devDependencies?.[name]===version,`${name} lockfile root metadata matches ${version}`);
}
for(const script of requiredScripts)check(Boolean(root.scripts?.[script]),`quality script exists: ${script}`);
for(const path of requiredFiles)check(await exists(path),`quality config exists: ${path}`);

check(!root.devDependencies?.['audit-ci'],'security gate reuses native npm audit instead of adding audit-ci');
check(!root.dependencies?.['audit-ci'],'audit-ci is not a runtime dependency');

console.log(`EVERGREEN QUALITY AUDIT · ${passes.length} pass · ${failures.length} fail`);
for(const message of passes)console.log(`PASS ${message}`);
for(const message of failures)console.error(`FAIL ${message}`);
if(failures.length)process.exitCode=1;

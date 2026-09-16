/* KELO-INDEX
 * area: QA / BUILD
 * owner: reproducible build contract
 * purpose: evita deploys que resuelvan dependencias fuera de los lockfiles declarados
 */
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const failures=[];
function need(source,text,message){if(!source.includes(text))failures.push(message);}
function forbid(source,text,message){if(source.includes(text))failures.push(message);}

const rootPkg=JSON.parse(read('package.json'));
const rootLock=JSON.parse(read('package-lock.json'));
const serverPkg=JSON.parse(read('server/package.json'));
const serverLock=JSON.parse(read('server/package-lock.json'));
const netlify=read('netlify.toml');
const render=read('render.yaml');

if(rootLock.lockfileVersion!==3)failures.push('root package-lock must be lockfileVersion 3');
if(serverLock.lockfileVersion!==3)failures.push('server package-lock must be lockfileVersion 3');
if(rootPkg.engines?.node!=='22.x')failures.push('root Node engine must stay pinned to 22.x during this migration');
if(serverPkg.engines?.node!=='>=24.20.0 <25')failures.push('server Node engine drifted from deployed runtime');
for(const [name,version] of Object.entries(rootPkg.devDependencies||{})){
  if(/[~^*xX]/.test(String(version)))failures.push('root devDependency must be exact: '+name+'='+version);
}
for(const [name,version] of Object.entries(serverPkg.dependencies||{})){
  if(/[~^*xX]/.test(String(version)))failures.push('server dependency must be exact: '+name+'='+version);
}
need(netlify,'npm ci --ignore-scripts --no-audit --no-fund','Netlify must use npm ci from root lockfile');
forbid(netlify,'npm install --no-save','Netlify must not install ad-hoc build dependencies');
need(render,'npm ci --omit=dev --ignore-scripts --no-audit --no-fund','Render must use npm ci from server lockfile');
forbid(render,'buildCommand: npm install','Render must not resolve server dependencies during deploy');

if(failures.length){for(const failure of failures)console.error('REPRO_BUILD_FAIL:',failure);process.exit(1);}
console.log('REPRODUCIBLE BUILD PASS');

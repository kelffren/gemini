/* KELO-INDEX
 * area: QA / PWA
 * owner: KeloUpdater service worker cache contract
 * purpose: evita volver a borrar Cache Storage completo durante activate
 */
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const failures=[];
function requireText(text,message){if(!source.includes(text))failures.push(message);}
function forbidText(text,message){if(source.includes(text))failures.push(message);}

requireText('function isKeloOwnedCache','missing owned-cache predicate');
requireText('async function cleanupOwnedCaches','missing scoped cleanup');
requireText("new Set([ASSET_CACHE_NAME, META_CACHE_NAME])",'assets/meta caches must be retained');
requireText('!keep.has(name)','cleanup must preserve keep-list caches');
forbidText('keys.map((k) => caches.delete(k))','activate must never delete every cache indiscriminately');
forbidText('keys.map(k => caches.delete(k))','activate must never delete every cache indiscriminately');

if(failures.length){
  for(const failure of failures)console.error('SW_CACHE_FAIL:',failure);
  process.exit(1);
}
console.log('SW CACHE OWNERSHIP PASS');

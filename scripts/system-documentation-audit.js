/* KELO-INDEX
 * area: QA / DOCS / X-FOUNDATION
 * owner: FOUNDATION CI
 * keys: DOCUMENTATION SYSTEM CATALOG SYSTEM CONTRACT AUTHORITY MATRIX DOC IDENTITY
 * purpose: valida catálogo, documentos técnicos, contratos críticos machine-readable y autoridad canónica
 * public-api: CLI
 * consumes: docs/system-catalog.json, docs/system-contracts.json, docs/authority-matrix.json
 * state-owned: ninguno
 * extension-points: ampliar rollout de identidad documental y contratos críticos
 * reuse: Foundation CI / Main Stability Gate
 * legacy: N/A
 * do-not: no inferir authority desde UI ni aceptar documentos JSON accidentalmente renombrados .md
 */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const catalogPath=path.join(root,'docs/system-catalog.json');
const contractsPath=path.join(root,'docs/system-contracts.json');
const authorityPath=path.join(root,'docs/authority-matrix.json');
function fail(msg){console.error('SYSTEM_DOC_FAIL:',msg);process.exitCode=1;}
function exists(rel){return fs.existsSync(path.join(root,rel));}
function readText(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function readJson(rel,label){
  try{return JSON.parse(readText(rel));}
  catch(error){fail((label||rel)+' is not valid JSON: '+error.message);return null;}
}
function parseDocMeta(rel){
  const text=readText(rel);
  if(/^\s*\{/.test(text)){
    fail(rel+' looks like JSON, not a technical Markdown document');
    return {text,meta:null};
  }
  const match=text.match(/<!--\s*KELO-SYSTEM-DOC\s*([\s\S]*?)-->/i);
  if(!match)return {text,meta:null};
  const meta={};
  for(const rawLine of match[1].split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line)continue;
    const pair=line.match(/^([a-z0-9-]+):\s*(.+)$/i);
    if(pair)meta[pair[1].toLowerCase()]=pair[2].trim();
  }
  return {text,meta};
}
function requiredString(obj,key,label){if(!String(obj?.[key]||'').trim())fail(label+' missing '+key);}
function requiredArray(obj,key,label){if(!Array.isArray(obj?.[key]))fail(label+' '+key+' must be an array');}
function validateDocIdentity(id,contract,getDoc){
  const doc=getDoc(contract.technicalDoc);
  if(!doc.meta){fail(id+' requires KELO-SYSTEM-DOC metadata');return;}
  if(doc.meta['system-id']!==id)fail(id+' metadata system-id mismatch');
  if(doc.meta.owner!==contract.owner)fail(id+' metadata owner mismatch');
  if(doc.meta.source!==contract.source)fail(id+' metadata source mismatch');
  if(!/^\d+$/.test(String(doc.meta['contract-version']||'')))fail(id+' metadata contract-version missing/invalid');
}

if(!exists('docs/SYSTEM_DOCUMENTATION_STANDARD.md'))fail('missing documentation standard');
if(!fs.existsSync(catalogPath)){fail('missing docs/system-catalog.json');process.exit();}
if(!fs.existsSync(contractsPath))fail('missing docs/system-contracts.json');
if(!fs.existsSync(authorityPath))fail('missing docs/authority-matrix.json');

const catalog=readJson('docs/system-catalog.json','system catalog');
if(!catalog)process.exit();
const systems=Array.isArray(catalog.systems)?catalog.systems:[];
if(!systems.length)fail('catalog must register at least one system');
const ids=new Set();
const catalogById=new Map();
const guide=exists('guide.html')?readText('guide.html'):'';
const docCache=new Map();
function getDoc(rel){
  if(!docCache.has(rel))docCache.set(rel,parseDocMeta(rel));
  return docCache.get(rel);
}

systems.forEach(function(system,index){
  const label='systems['+index+']';
  if(!system||typeof system!=='object'){fail(label+' invalid');return;}
  ['id','owner','source','technicalDoc','status'].forEach(function(key){requiredString(system,key,label);});
  if(ids.has(system.id))fail('duplicate system id '+system.id);else ids.add(system.id);
  catalogById.set(system.id,system);
  if(system.source&&!exists(system.source))fail(system.id+' source missing: '+system.source);
  if(system.technicalDoc&&!exists(system.technicalDoc))fail(system.id+' technical doc missing: '+system.technicalDoc);
  else if(system.technicalDoc){
    const doc=getDoc(system.technicalDoc);
    if(doc.meta){
      const declared=String(doc.meta['system-id']||'').trim();
      const declaredOwner=String(doc.meta.owner||'').trim();
      const declaredSource=String(doc.meta.source||'').trim();
      if(declared&&declared!==system.id){
        const other=catalogById.get(declared);
        if(!other||other.technicalDoc!==system.technicalDoc)fail(system.id+' technical doc declares different system-id: '+declared);
      }
      if(declared===system.id&&declaredOwner&&declaredOwner!==system.owner)fail(system.id+' doc owner mismatch: '+declaredOwner+' != '+system.owner);
      if(declared===system.id&&declaredSource&&declaredSource!==system.source)fail(system.id+' doc source mismatch: '+declaredSource+' != '+system.source);
    }
  }
  if(system.playerVisible===true){
    const anchor=String(system.playerGuideAnchor||'').trim();
    if(!anchor)fail(system.id+' playerVisible requires playerGuideAnchor');
    else if(!guide.includes('id="'+anchor+'"')&&!guide.includes("id='"+anchor+"'"))fail(system.id+' guide anchor missing: '+anchor);
  }
});

const contracts=readJson('docs/system-contracts.json','system contracts');
const contractRows=Array.isArray(contracts?.systems)?contracts.systems:[];
if(!contractRows.length)fail('system contracts must register at least one critical system');
const contractIds=new Set();
for(const [index,contract] of contractRows.entries()){
  const label='contracts['+index+']';
  ['id','owner','source','technicalDoc','authority','failurePolicy','resourceClass'].forEach(key=>requiredString(contract,key,label));
  ['stateOwned','stateForbidden','consumes','lifecycle','requiredTests'].forEach(key=>requiredArray(contract,key,label));
  if(!Number.isInteger(contract?.apiVersion)||contract.apiVersion<1)fail(label+' apiVersion must be an integer >= 1');
  if(contractIds.has(contract.id))fail('duplicate system contract id '+contract.id);else contractIds.add(contract.id);
  const system=catalogById.get(contract.id);
  if(!system){fail(contract.id+' contract has no catalog entry');continue;}
  for(const key of ['owner','source','technicalDoc'])if(String(contract[key])!==String(system[key]))fail(contract.id+' contract '+key+' mismatch with catalog');
  if(!contract.requiredTests.length)fail(contract.id+' contract requiredTests must not be empty');
  if(!exists(contract.source))fail(contract.id+' contract source missing: '+contract.source);
  if(!exists(contract.technicalDoc))fail(contract.id+' contract technical doc missing: '+contract.technicalDoc);
}

for(const critical of ['simulation-extensions','creator-exclusive-runtime']){
  const contract=contractRows.find(row=>row.id===critical);
  if(!contract)fail('critical contract missing: '+critical);
  else validateDocIdentity(critical,contract,getDoc);
}

const authority=readJson('docs/authority-matrix.json','authority matrix');
const authorityRows=Array.isArray(authority?.states)?authority.states:[];
if(!authorityRows.length)fail('authority matrix must register at least one state');
const authorityIds=new Set();
for(const [index,row] of authorityRows.entries()){
  const label='authority['+index+']';
  ['id','currentAuthority','requiredAuthority','persistence','clientRole','onlinePolicy','status'].forEach(key=>requiredString(row,key,label));
  if(authorityIds.has(row.id))fail('duplicate authority state '+row.id);else authorityIds.add(row.id);
}
for(const critical of [
  'pvp.hit-damage','arena.result','arena.rating','economy.wallet','commerce.market-settlement',
  'world.publication','creator.asset-publication','guardian.kc-settlement',
  'kelo-evolution.objective-score','kelo-evolution.merge-deploy'
])if(!authorityIds.has(critical))fail('critical authority state missing: '+critical);

if(!process.exitCode)console.log('SYSTEM_DOC_OK:',systems.length,'catalog systems,',contractRows.length,'critical contracts,',authorityRows.length,'authority states validated');

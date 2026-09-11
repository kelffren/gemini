/* KELO-INDEX
 * area: CREATORS / EVOLUTION / CODE PATCH
 * owner: KeloEvolution code-patch candidate contract
 * purpose: represent source-code changes as bounded, reviewable candidates before sandbox evaluation
 * public-api: createCodePatchPolicy, createCodePatchCandidate, validateCodePatchCandidate
 * consumes: serializable full-text replacements proposed by an authorized external agent
 * state-owned: none
 * online: authority-neutral; Git/CI/server remain external apply authorities
 * do-not: no filesystem, Git, network, arbitrary commands, secret paths or direct deployment
 */
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const text=value=>String(value??'').trim();
const bytes=value=>new TextEncoder().encode(String(value??'')).length;
const DEFAULT_PREFIXES=Object.freeze(['src/world/map-forge/','src/creators/evolution/','scripts/','tests/','docs/systems/']);
const DEFAULT_DENY=Object.freeze(['.env','node_modules/','.git/','supabase/','server/','secrets','credential','private-key','service-role']);
function safePath(path){const value=text(path).replaceAll('\\','/');return value&&!value.startsWith('/')&&!value.includes('../')&&!value.includes('/..')&&!value.includes('\0');}

export function createCodePatchPolicy({allowedPrefixes=DEFAULT_PREFIXES,denyFragments=DEFAULT_DENY,maxFiles=8,maxBytes=120000,requireBeforeHash=true}={}){
  const prefixes=[...new Set((allowedPrefixes||[]).map(text).filter(Boolean))],deny=[...new Set((denyFragments||[]).map(value=>text(value).toLowerCase()).filter(Boolean))];
  if(!prefixes.length)throw new Error('CODE_PATCH_ALLOWLIST_REQUIRED');
  return freeze({allowedPrefixes:prefixes,denyFragments:deny,maxFiles:Math.max(1,Math.min(50,Math.floor(Number(maxFiles)||8))),maxBytes:Math.max(1024,Math.min(2_000_000,Math.floor(Number(maxBytes)||120000))),requireBeforeHash:requireBeforeHash!==false});
}

export function createCodePatchCandidate({id,baseSha,objective='',changes=[],tests=[]}={}){
  const candidate={schema:'kelo-code-patch-v1',id:text(id),baseSha:text(baseSha),objective:text(objective),changes:(changes||[]).map(row=>({path:text(row?.path),beforeHash:text(row?.beforeHash),afterContent:String(row?.afterContent??'')})),tests:[...new Set((tests||[]).map(text).filter(Boolean))]};
  return freeze(candidate);
}

export function validateCodePatchCandidate(candidateInput,policyInput={}){
  const candidate=createCodePatchCandidate(candidateInput||{}),policy=createCodePatchPolicy(policyInput),errors=[],paths=new Set();let totalBytes=0;
  if(!candidate.id)errors.push('candidate_id_missing');
  if(!candidate.baseSha)errors.push('base_sha_missing');
  if(!candidate.changes.length)errors.push('changes_missing');
  if(candidate.changes.length>policy.maxFiles)errors.push(`too_many_files:${candidate.changes.length}>${policy.maxFiles}`);
  for(const change of candidate.changes){
    const lower=change.path.toLowerCase();
    if(!safePath(change.path))errors.push(`path_unsafe:${change.path}`);
    if(paths.has(change.path))errors.push(`path_duplicate:${change.path}`);paths.add(change.path);
    if(!policy.allowedPrefixes.some(prefix=>change.path.startsWith(prefix)))errors.push(`path_not_allowlisted:${change.path}`);
    if(policy.denyFragments.some(fragment=>lower.includes(fragment)))errors.push(`path_denied:${change.path}`);
    if(policy.requireBeforeHash&&!change.beforeHash)errors.push(`before_hash_missing:${change.path}`);
    totalBytes+=bytes(change.afterContent);
  }
  if(totalBytes>policy.maxBytes)errors.push(`patch_too_large:${totalBytes}>${policy.maxBytes}`);
  return freeze({valid:errors.length===0,errors:[...new Set(errors)],candidate:copy(candidate),policy,totalBytes,fileCount:candidate.changes.length});
}

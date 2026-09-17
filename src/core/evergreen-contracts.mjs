/* KELO-INDEX
 * area: FOUNDATION / EVERGREEN
 * owner: Evergreen contract primitives (build-time/shared)
 * keys: CONTRACT VERSION COMPATIBILITY DEPRECATION SEMVER TEN-YEAR
 * purpose: provide dependency-free primitives to declare and verify long-lived public contracts without owning domain behavior
 * public-api: parseVersion, compareVersions, createContractRegistry
 * state-owned: in-memory contract definitions supplied by caller only
 * online: N/A; pure shared/build primitive, no network or persistence authority
 * do-not: NO feature activation, NO gameplay mutation, NO provider calls, NO timers
 */

const VERSION_RE=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(value){
  const raw=String(value??'').trim();
  const match=VERSION_RE.exec(raw);
  if(!match)throw new Error(`INVALID_SEMVER:${raw}`);
  return Object.freeze({raw,major:Number(match[1]),minor:Number(match[2]),patch:Number(match[3]),pre:match[4]||null});
}

export function compareVersions(a,b){
  const x=typeof a==='string'?parseVersion(a):a;
  const y=typeof b==='string'?parseVersion(b):b;
  for(const key of ['major','minor','patch']){
    if(x[key]!==y[key])return x[key]<y[key]?-1:1;
  }
  if(x.pre===y.pre)return 0;
  if(x.pre==null)return 1;
  if(y.pre==null)return -1;
  return x.pre<y.pre?-1:(x.pre>y.pre?1:0);
}

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function freezeRow(row){return Object.freeze({...row,compatibility:Object.freeze({...row.compatibility}),deprecation:row.deprecation?Object.freeze({...row.deprecation}):null});}

export function createContractRegistry({clock=()=>Date.now()}={}){
  const rows=new Map();

  function register(spec){
    if(!spec||typeof spec!=='object')throw new TypeError('CONTRACT_SPEC_REQUIRED');
    const id=String(spec.id||'').trim();
    if(!id)throw new Error('CONTRACT_ID_REQUIRED');
    if(rows.has(id))throw new Error(`CONTRACT_ALREADY_REGISTERED:${id}`);
    const version=parseVersion(spec.version);
    const minReader=parseVersion(spec.compatibility?.minReader||`${version.major}.0.0`);
    const maxReader=spec.compatibility?.maxReader?parseVersion(spec.compatibility.maxReader):null;
    if(minReader.major>version.major)throw new Error(`CONTRACT_MIN_READER_AHEAD:${id}`);
    if(maxReader&&compareVersions(maxReader,minReader)<0)throw new Error(`CONTRACT_READER_RANGE_INVALID:${id}`);
    const deprecation=spec.deprecation?{
      announcedAt:String(spec.deprecation.announcedAt||''),
      removeAfter:String(spec.deprecation.removeAfter||''),
      replacement:spec.deprecation.replacement?String(spec.deprecation.replacement):null,
      reason:String(spec.deprecation.reason||'')
    }:null;
    const row=freezeRow({
      id,
      owner:String(spec.owner||'unknown'),
      version:version.raw,
      compatibility:{minReader:minReader.raw,maxReader:maxReader?.raw||null,backwardRead:spec.compatibility?.backwardRead!==false},
      deprecation,
      source:spec.source?String(spec.source):null,
      notes:spec.notes?String(spec.notes):null
    });
    rows.set(id,row);
    return row;
  }

  function get(id){return rows.get(String(id))||null;}
  function list(){return [...rows.values()];}
  function canConsume(id,readerVersion){
    const row=get(id);if(!row)return false;
    const reader=parseVersion(readerVersion);
    const min=parseVersion(row.compatibility.minReader);
    const max=row.compatibility.maxReader?parseVersion(row.compatibility.maxReader):null;
    if(compareVersions(reader,min)<0)return false;
    if(max&&compareVersions(reader,max)>0)return false;
    return true;
  }
  function deprecationStatus(id,now=clock()){
    const row=get(id);if(!row?.deprecation)return Object.freeze({deprecated:false,removable:false});
    const removeAt=Date.parse(row.deprecation.removeAfter);
    return Object.freeze({deprecated:true,removable:Number.isFinite(removeAt)&&Number(now)>=removeAt,removeAfter:row.deprecation.removeAfter,replacement:row.deprecation.replacement});
  }
  function snapshot(){return Object.freeze(list().map(row=>freezeRow(clone(row))));}

  return Object.freeze({register,get,list,snapshot,canConsume,deprecationStatus,get size(){return rows.size;}});
}

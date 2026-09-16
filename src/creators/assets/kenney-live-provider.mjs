/* KELO-INDEX
 * area: CREATORS / EXTERNAL ASSET PROVIDERS / KENNEY
 * owner: Kelo Creator Asset Bridge
 * keys: KENNEY CC0 LAZY INDEX SEARCH REMOTE PNG PAGINATION
 * purpose: Search Kenney's remote metadata on demand; never preload asset binaries.
 */

const INDEX_URL='https://raw.githubusercontent.com/shorepine/kenney/main/index.tsv';
const RAW_BASE='https://raw.githubusercontent.com/shorepine/kenney/main/';
const SOURCE_BASE='https://github.com/shorepine/kenney/blob/main/';
const ALLOWED_PREFIXES=['2d/','ui/','icons/'];
const MAX_PAGE_SIZE=320;
let indexPromise=null;

const text=v=>String(v??'').trim();
const lower=v=>text(v).toLowerCase();
const encodePath=path=>path.split('/').map(encodeURIComponent).join('/');
function hashPath(value){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}
function humanName(path,description){
  if(text(description))return text(description);
  const file=path.split('/').pop()||path;
  return file.replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
function packName(path){const parts=path.split('/');return parts.length>2?parts[1]:(parts[0]||'Kenney');}
function supportedPath(path){return ALLOWED_PREFIXES.some(prefix=>path.startsWith(prefix))&&/\.(png|webp|jpe?g)$/i.test(path);}
function matchScore(line,q){
  const hay=lower(line);
  if(!q){
    let score=0;
    for(const hint of ['rpg','fantasy','character','dungeon','town','weapon','nature','pixel','tile','ui'])if(hay.includes(hint))score+=4;
    if(hay.startsWith('2d/'))score+=3;
    return {matched:true,score};
  }
  const tokens=q.split(/\s+/).filter(Boolean);
  let hits=0,score=hay.includes(q)?120:0;
  for(const token of tokens){if(hay.includes(token)){hits++;score+=22;}}
  const matched=hits===tokens.length||(!tokens.length&&hay.includes(q));
  if(hay.startsWith('2d/'))score+=3;
  return {matched,score};
}

async function loadIndex(){
  if(indexPromise)return indexPromise;
  indexPromise=fetch(INDEX_URL,{mode:'cors',cache:'force-cache'}).then(async response=>{
    if(!response.ok)throw new Error('KENNEY_INDEX_'+response.status);
    const body=await response.text();
    if(body.length<1000)throw new Error('KENNEY_INDEX_TOO_SMALL');
    return body;
  }).catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}

function toAsset(columns){
  const path=text(columns[0]),description=text(columns[1]),dimensions=text(columns[2]),bytes=Number(columns[3]||0)||0;
  const encoded=encodePath(path),pack=packName(path),kind=path.startsWith('ui/')?'ui':path.startsWith('icons/')?'icons':'2d';
  return {
    id:`kenney:${hashPath(path)}`,
    provider:'kenney',externalId:path,name:humanName(path,description),category:kind,
    tags:[kind,pack,'cc0','kenney'].filter(Boolean),description:description||`${pack} · ${dimensions||'image'}`,
    previewUrl:RAW_BASE+encoded,downloadUrl:RAW_BASE+encoded,sourceUrl:SOURCE_BASE+encoded,
    license:'CC0',author:'Kenney',attributionRequired:false,ownership:'discovered',
    downloadable:true,integrationReady:true,bytesHint:bytes,dimensions,pack,path
  };
}

export async function searchKenneyAssets(query='',options={}){
  const body=await loadIndex();
  const q=lower(query),limit=Math.max(24,Math.min(Number(options.limit)||80,MAX_PAGE_SIZE)),offset=Math.max(0,Number(options.offset)||0);
  const ranked=[];
  for(const rawLine of body.split('\n')){
    const line=rawLine.trim();if(!line)continue;
    const columns=line.split('\t'),path=text(columns[0]);
    if(!supportedPath(path)||/^path$/i.test(path))continue;
    const match=matchScore(line,q);if(!match.matched)continue;
    ranked.push({score:match.score,columns});
  }
  ranked.sort((a,b)=>b.score-a.score||String(a.columns[0]).localeCompare(String(b.columns[0])));
  return ranked.slice(offset,offset+limit).map(row=>toAsset(row.columns));
}

export function clearKenneyCache(){indexPromise=null;}
export const KENNEY_LIVE_PROVIDER=Object.freeze({search:searchKenneyAssets,clearCache:clearKenneyCache,indexUrl:INDEX_URL});

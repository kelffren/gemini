/* KELO-INDEX
 * area: CREATORS / EXTERNAL ASSET PROVIDERS / KENNEY WORKER
 * owner: Kelo Universal Content Bridge
 * keys: KENNEY 10K 48K WORKER SEARCH PAGINATION LRU METADATA MOBILE
 * purpose: Keep the full Kenney metadata index and expensive search/ranking off the main UI thread. Only requested page rows cross back to the library.
 */
const INDEX_URL='https://raw.githubusercontent.com/shorepine/kenney/main/index.tsv';
const ALLOWED_PREFIXES=['2d/','ui/','icons/'];
const MAX_QUERY_CACHE=8;
let rows=null,defaultOrder=null,indexBytes=0;
const queryCache=new Map();
const text=v=>String(v??'').trim();
const lower=v=>text(v).toLowerCase();
function supportedPath(path){return ALLOWED_PREFIXES.some(prefix=>path.startsWith(prefix))&&/\.(png|webp|jpe?g)$/i.test(path);}
function defaultScore(hay,path){let score=0;for(const hint of ['rpg','fantasy','character','dungeon','town','weapon','nature','pixel','tile','ui'])if(hay.includes(hint))score+=4;if(path.startsWith('2d/'))score+=3;return score;}
function queryScore(hay,q,tokens,path){let hits=0,score=hay.includes(q)?120:0;for(const token of tokens){if(hay.includes(token)){hits++;score+=22;}}if(path.startsWith('2d/'))score+=3;return hits===tokens.length?score:null;}
function touchCache(key,value){queryCache.delete(key);queryCache.set(key,value);while(queryCache.size>MAX_QUERY_CACHE)queryCache.delete(queryCache.keys().next().value);}
async function loadRows(){if(rows)return rows;const response=await fetch(INDEX_URL,{mode:'cors',cache:'force-cache'});if(!response.ok)throw new Error('KENNEY_INDEX_'+response.status);const body=await response.text();indexBytes=body.length;if(body.length<1000)throw new Error('KENNEY_INDEX_TOO_SMALL');const parsed=[];for(const rawLine of body.split('\n')){const line=rawLine.trim();if(!line)continue;const columns=line.split('\t'),path=text(columns[0]);if(!supportedPath(path)||/^path$/i.test(path))continue;const description=text(columns[1]),dimensions=text(columns[2]),bytes=Number(columns[3]||0)||0,hay=lower(`${path} ${description} ${dimensions}`);parsed.push([path,description,dimensions,bytes,hay]);}rows=parsed;return rows;}
async function getDefaultOrder(){await loadRows();if(defaultOrder)return defaultOrder;defaultOrder=rows.map((row,index)=>({index,score:defaultScore(row[4],row[0])})).sort((a,b)=>b.score-a.score||rows[a.index][0].localeCompare(rows[b.index][0])).map(x=>x.index);return defaultOrder;}
async function getQueryOrder(query){const q=lower(query);if(!q)return getDefaultOrder();if(queryCache.has(q)){const cached=queryCache.get(q);touchCache(q,cached);return cached;}await loadRows();const tokens=q.split(/\s+/).filter(Boolean),ranked=[];for(let i=0;i<rows.length;i++){const row=rows[i],score=queryScore(row[4],q,tokens,row[0]);if(score!==null)ranked.push({index:i,score});}ranked.sort((a,b)=>b.score-a.score||rows[a.index][0].localeCompare(rows[b.index][0]));const order=ranked.map(x=>x.index);touchCache(q,order);return order;}
async function search(query,offset,limit){const order=await getQueryOrder(query),start=Math.max(0,Number(offset)||0),size=Math.max(1,Math.min(Number(limit)||80,320)),slice=order.slice(start,start+size),result=slice.map(i=>rows[i].slice(0,4));return{rows:result,total:order.length,offset:start,limit:size,hasMore:start+result.length<order.length};}
self.onmessage=async event=>{const message=event.data||{},id=message.id;try{if(message.type==='search'){const result=await search(message.query,message.offset,message.limit);self.postMessage({id,ok:true,result});return;}if(message.type==='stats'){await loadRows();self.postMessage({id,ok:true,result:{assets:rows.length,indexBytes,queryCache:queryCache.size}});return;}if(message.type==='clear'){rows=null;defaultOrder=null;indexBytes=0;queryCache.clear();self.postMessage({id,ok:true,result:true});return;}throw new Error('KENNEY_WORKER_UNKNOWN_MESSAGE');}catch(error){self.postMessage({id,ok:false,error:String(error?.message||error)});}};

/* KELO-INDEX
 * area: CREATORS / ASSET DISCOVERY
 * owner: KeloAssetDiscovery
 * keys: ASSET SEARCH SEMANTIC DUNGEON KIT ROOM COMPATIBLE SNAP BUILD-WITH-THIS MOBILE
 * purpose: rankea y clasifica metadata de assets para que Studio encuentre piezas/rooms/kits compatibles sin descargar binarios.
 * public-api: classifyAsset, parseIntent, rankAssets, compatibleAssets, buildWithThisPlan, snapCompatibility, dungeonDNA, styleCompatibility, groupSearchResults, continueBuilding
 * consumes: metadata del catálogo/proveedores; no descarga previews ni assets originales
 * state-owned: ninguno; funciones puras y planes efímeros
 * online: la misma API acepta resultados/metadata de autoridad server sin cambiar consumidores
 */
const TYPE_RULES=Object.freeze({
 dungeon:['dungeon','crypt','catacomb','cave','temple','ruins'],
 room:['room','chamber','arena','hall','corridor','entrance','boss','treasure','puzzle','trap'],
 kit:['kit','modular','tileset','tile set','pack'],
 module:['wall','floor','door','stairs','pillar','column','arch','corner','window','bridge'],
 prop:['torch','barrel','crate','bones','chain','debris','rock','tree','statue']
});
const INTENT_RULES=Object.freeze({
 dungeon:['dungeon','crypt','catacomb','cave','temple'],
 dark:['dark','gloom','shadow','night'],
 medieval:['medieval','castle','stone','crypt'],
 boss:['boss','arena'],
 treasure:['treasure','loot','chest'],
 puzzle:['puzzle','riddle'],
 trap:['trap','spike','hazard'],
 corridor:['corridor','hallway','passage'],
 lowpoly:['low poly','low-poly','lowpoly'],
 mobile:['mobile','optimized','performance','lite']
});
const ROLE_RULES=Object.freeze({
 entrance:['entrance','gate','entry'],boss:['boss','arena'],treasure:['treasure','loot','chest'],puzzle:['puzzle','riddle'],trap:['trap','hazard','spike'],corridor:['corridor','hallway','passage'],combat:['combat','battle'],secret:['secret','hidden'],exit:['exit','escape']
});
const CONNECTION_ALIASES=Object.freeze({wall:['wall','corner','door','arch','pillar'],corner:['wall','corner'],door:['wall','arch','corridor','room'],corridor:['door','room','stairs','corridor'],room:['door','corridor','stairs','room'],stairs:['corridor','room','stairs']});
function words(value){return String(value||'').toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9áéíóúñ ]+/g,' ').split(/\s+/).filter(Boolean)}
function textOf(a){return [a.id,a.name,a.title,a.description,a.category,a.type,...(a.tags||[]),...(a.themes||[]),...(a.styles||[])].filter(Boolean).join(' ').toLowerCase()}
function hasPhrase(text,arr){return arr.some(x=>text.includes(x))}
export function classifyAsset(asset={}){
 const t=textOf(asset); let type=String(asset.type||'').toLowerCase();
 if(!type||type==='asset'){const roomSignal=hasPhrase(t,TYPE_RULES.room), dungeonSignal=hasPhrase(t,TYPE_RULES.dungeon);if(roomSignal)type='room';else if(dungeonSignal)type='dungeon';else for(const [k,v] of Object.entries(TYPE_RULES)){if(k!=='room'&&k!=='dungeon'&&hasPhrase(t,v)){type=k;break}}}
 if(!type||type==='asset')type='prop';
 const gameplay=[]; for(const k of ['boss','treasure','puzzle','trap'])if(t.includes(k))gameplay.push(k);
 return Object.freeze({...asset,type,gameplay:Object.freeze(gameplay)});
}
export function parseIntent(query=''){
 const q=String(query).toLowerCase(), tokens=words(q), facets={};
 for(const [k,v] of Object.entries(INTENT_RULES))if(hasPhrase(q,v))facets[k]=true;
 const type=facets.dungeon?'dungeon':facets.boss||facets.treasure||facets.puzzle||facets.trap||facets.corridor?'room':null;
 return Object.freeze({query:String(query),tokens:Object.freeze(tokens),facets:Object.freeze(facets),type});
}
function overlap(tokens,text){if(!tokens.length)return 0;let n=0;for(const token of tokens)if(text.includes(token))n++;return n/tokens.length}
function perfScore(a){const p=a.performance||{};if(p.mobileReady===true)return 1;const tris=Number(p.triangles||a.triangles||0), bytes=Number(p.previewBytes||a.previewBytes||0);let s=.5;if(tris&&tris<=50000)s+=.25;if(bytes&&bytes<=750000)s+=.25;return Math.min(1,s)}
export function rankAssets(assets=[],query='',context={}){
 const intent=parseIntent(query), style=new Set((context.styles||[]).map(x=>String(x).toLowerCase())), used=new Set(context.usedAssetIds||[]);
 return assets.map(raw=>{const a=classifyAsset(raw),t=textOf(a);let score=overlap(intent.tokens,t)*55;
 if(intent.type&&a.type===intent.type)score+=18;
 for(const f of Object.keys(intent.facets))if(t.includes(f)||a.gameplay.includes(f))score+=5;
 if(style.size){const ast=new Set([...(a.styles||[]),...(a.tags||[])].map(x=>String(x).toLowerCase()));let hit=0;style.forEach(x=>{if(ast.has(x)||t.includes(x))hit++});score+=Math.min(12,hit*4)}
 score+=perfScore(a)*10;if(used.has(a.id))score+=3;
 return {asset:a,score:Math.round(score*100)/100,reasons:{intent:intent.type,performance:perfScore(a),alreadyUsed:used.has(a.id)}}}).sort((a,b)=>b.score-a.score||String(a.asset.name||a.asset.id).localeCompare(String(b.asset.name||b.asset.id)));
}
export function snapCompatibility(source={},candidate={}){
 const a=classifyAsset(source),b=classifyAsset(candidate), explicit=(source.connections||[]).map(x=>String(x).toLowerCase());
 const target=String(b.snapType||b.type||'').toLowerCase(), sourceType=String(a.snapType||a.type||'').toLowerCase();
 const allowed=new Set([...explicit,...(CONNECTION_ALIASES[sourceType]||[])]);
 const compatible=allowed.has(target)||Boolean((candidate.connections||[]).map(x=>String(x).toLowerCase()).includes(sourceType));
 return Object.freeze({compatible,sourceType,targetType:target,confidence:compatible?(explicit.includes(target)?1:.82):0});
}
export function compatibleAssets(source,assets=[],context={}){
 return assets.map(asset=>({asset,compat:snapCompatibility(source,asset)})).filter(x=>x.compat.compatible).map(x=>({...x,rank:rankAssets([x.asset],'',context)[0]?.score||0})).sort((a,b)=>b.compat.confidence-a.compat.confidence||b.rank-a.rank);
}
export function styleCompatibility(asset={},context={}){
 const wanted=new Set((context.styles||[]).map(x=>String(x).toLowerCase())), t=textOf(asset);
 if(!wanted.size)return Object.freeze({score:1,matches:[],conflicts:[]});
 const matches=[],conflicts=[];wanted.forEach(x=>{if(t.includes(x))matches.push(x);else conflicts.push(x)});
 return Object.freeze({score:matches.length/wanted.size,matches:Object.freeze(matches),conflicts:Object.freeze(conflicts)});
}
export function dungeonDNA(asset={}){
 const a=classifyAsset(asset),t=textOf(a),roles=[];for(const [role,keys] of Object.entries(ROLE_RULES))if(hasPhrase(t,keys)||a.gameplay.includes(role))roles.push(role);
 const topo=asset.topology||{},rooms=Number(topo.rooms||asset.roomCount||0),branches=Number(topo.branches||0),deadEnds=Number(topo.deadEnds||0);
 return Object.freeze({theme:(a.themes||[])[0]||null,style:(a.styles||[])[0]||null,roles:Object.freeze(roles),rooms,branches,deadEnds,verticality:topo.verticality||asset.verticality||'unknown',density:topo.density||asset.density||'unknown',playtimeMinutes:topo.playtimeMinutes||asset.playtimeMinutes||null});
}
export function groupSearchResults(ranked=[]){
 const out={scenes:[],dungeons:[],kits:[],rooms:[],modules:[],props:[]};
 for(const row of ranked){const t=classifyAsset(row.asset||row).type,key=t==='dungeon'?'dungeons':t==='kit'?'kits':t==='room'?'rooms':t==='module'?'modules':t==='scene'?'scenes':'props';out[key].push(row)}
 return Object.freeze(out);
}
export function continueBuilding(placed=[],assets=[],context={}){
 const recent=placed.slice(-8),wanted=new Map();
 for(const source of recent)for(const item of compatibleAssets(source,assets,context).slice(0,12)){const id=item.asset.id;if(!id)continue;const prev=wanted.get(id)||{asset:item.asset,score:0,reasons:0};prev.score+=item.compat.confidence*10+(item.rank||0);prev.reasons++;wanted.set(id,prev)}
 return [...wanted.values()].map(x=>({...x,score:Math.round(x.score*100)/100,style:styleCompatibility(x.asset,context)})).sort((a,b)=>(b.score+b.style.score*10)-(a.score+a.style.score*10)).slice(0,24);
}
export function buildWithThisPlan(seed={},assets=[],context={}){
 const root=classifyAsset(seed), compatible=compatibleAssets(root,assets,context).slice(0,24);
 const groups={walls:[],doors:[],rooms:[],stairs:[],props:[]};
 for(const item of compatible){const t=classifyAsset(item.asset).type;(groups[t==='module'?(textOf(item.asset).includes('door')?'doors':textOf(item.asset).includes('stair')?'stairs':'walls'):t==='room'?'rooms':'props']||groups.props).push(item.asset)}
 return Object.freeze({version:2,seedId:root.id||null,mode:'context-build',styleLock:Object.freeze([...(context.styles||root.styles||[])]),dungeonDNA:dungeonDNA(root),groups:Object.freeze(groups),suggestions:Object.freeze(compatible.map(x=>x.asset.id).filter(Boolean))});
}
export default Object.freeze({classifyAsset,parseIntent,rankAssets,compatibleAssets,buildWithThisPlan,snapCompatibility,dungeonDNA,styleCompatibility,groupSearchResults,continueBuilding});

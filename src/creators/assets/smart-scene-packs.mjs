/* KELO-INDEX
 * area: CREATORS / SMART SCENE PACKS
 * keys: COMPLETE SCENE PACKS LOCAL NEIGHBORHOOD COMPLEMENTARY ASSETS
 * purpose: turn the active Scene Match profile into bounded complementary asset searches.
 */
const uniq=a=>[...new Set((a||[]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean))];
const RULES=Object.freeze({
 nature:['tree','bush','rock','flower','grass','path','fence'],
 forest:['tree','bush','rock','mushroom','flower','path','log'],
 medieval:['barrel','crate','cart','lamp','fence','market','stone'],
 village:['house','fence','lamp','barrel','crate','tree','path'],
 dungeon:['torch','stone','pillar','chest','door','rubble','trap'],
 town:['lamp','bench','sign','fence','tree','crate','market'],
 water:['dock','boat','rock','reeds','bridge','barrel','fish']
});
function concepts(profile={}){const present=uniq([...(profile.localCategories||[]),...(profile.localStyles||[]),profile.category,...(profile.styleTags||[])]);let wanted=[];for(const [key,list] of Object.entries(RULES))if(present.some(x=>x.includes(key)||key.includes(x)))wanted.push(...list);if(!wanted.length)wanted=['tree','rock','lamp','bench','fence','crate'];return uniq(wanted).filter(x=>!present.some(p=>p===x||p.includes(x))).slice(0,6);}
export async function completeScene({profile,search,perConcept=8,maxAssets=24}={}){if(typeof search!=='function')throw new Error('SMART_PACK_SEARCH_REQUIRED');const wanted=concepts(profile),groups=[];for(const query of wanted){const result=await search(query,{includeLazy:true,limit:perConcept,sceneProfile:profile});const assets=(result?.assets||[]).filter(a=>a.previewUrl&&a.supportsRemotePreview!==false).slice(0,3);if(assets.length)groups.push({query,assets});if(groups.reduce((n,g)=>n+g.assets.length,0)>=maxAssets)break;}return{version:1,profile,wanted,groups,assets:groups.flatMap(g=>g.assets).slice(0,maxAssets)};}
export const SMART_SCENE_PACKS=Object.freeze({version:'smart-scene-packs-v1',concepts,completeScene});

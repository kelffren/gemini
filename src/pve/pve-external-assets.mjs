/* KELO-INDEX
 * area: PVE / EXTERNAL ASSET BINDING
 * owner: Kelo PvE + Universal Content Bridge
 * purpose: resolve Greenwild enemy art through the external Asset Library provider and ranking pipeline
 */
import {searchOpenGameArtAssets} from '../creators/assets/opengameart-live-provider.mjs';
import {rankAssets} from '../creators/assets/asset-quality-ranker.mjs';

const F=Object.freeze;
const QUERIES=F({beast:'wolf',bandit:'bandit'});
export async function resolveGreenwildEnemyAsset(family,{limit=12}={}){
  const query=QUERIES[String(family)]||String(family||'enemy');
  const rows=await searchOpenGameArtAssets(query,{limit});
  const ranked=rankAssets(rows,{query,sceneProfile:{category:'enemy',contentKind:'sprite',perspective:'top-down',environment:'greenwild',styleTags:['fantasy','rpg','pixel-art'],targetSize:32}});
  const winner=ranked.find(x=>x.downloadable&&x.integrationReady)||null;
  return winner?F({asset:winner,query,source:'external-library-ranked'}):null;
}
export async function preloadGreenwildEnemyAssets(){
  const [wolf,bandit]=await Promise.all([resolveGreenwildEnemyAsset('beast'),resolveGreenwildEnemyAsset('bandit')]);
  return F({beast:wolf,bandit});
}

/* KELO-INDEX
 * area: WORLD / MAP FORGE / AUTHORED CITY
 * owner: KeloMapForge authored composition content
 * purpose: impose a hand-authored playable capital quarter over Map Forge structural data
 * public-api: applyAuthoredCapitalQuarter()
 * consumes: Map Forge candidate parts + existing Property Catalog semantic/explicit asset ids
 * state-owned: none; immutable base-world content only
 * online: authored base composition is deterministic content; server/player deltas remain separate
 * do-not: no RNG, DOM, renderer, collision writes or persistence
 */
const P=(id,assetId,x,y,rotation=0,district='central')=>Object.freeze({
  id,assetId,family:'authored_city',district,x,y,rotation,authored:true
});
const L=(id,type,x,y,w,h,facing='south',district='central')=>Object.freeze({
  id,type,role:id==='fountain'?'primary_anchor':'district_anchor',district,region:'center',
  keepClearRadius:Math.max(w,h)*.58,footprint:{w,h},facing,hero:true,
  position:{x,y},bounds:{x:x-w/2,y:y-h/2,w,h},clearance:{radius:Math.max(w,h)*.58},
  frontage:{facing,source:'authored'},roadConnection:true,authored:true
});
const road=(id,points,width=96)=>Object.freeze({
  id,from:'authored',to:'authored',class:'arterial',width,material:'royal_stone',priority:5,
  polyline:Object.freeze(points.map(([x,y])=>Object.freeze({x,y}))),source:'authored'
});

// This is level-design data, not generation. Every coordinate below is deliberate.
export const KELO_AUTHORED_CAPITAL_QUARTER=Object.freeze({
  version:'authored-capital-quarter-v1',
  bounds:Object.freeze({x:1080,y:720,w:1440,h:1760}),
  spawn:Object.freeze({id:'spawn:primary',type:'player',x:1800,y:2220,district:'central',facing:'north',authored:true}),
  roads:Object.freeze([
    road('road:authored:royal-axis',[[1800,2320],[1800,2060],[1800,1810],[1800,1540],[1800,1260],[1800,930]],112),
    road('road:authored:market-cross',[[1220,1650],[1450,1650],[1800,1650],[2150,1650],[2380,1650]],88),
    road('road:authored:garden-west',[[1450,1650],[1390,1450],[1410,1230],[1530,1050]],64),
    road('road:authored:artisan-east',[[2150,1650],[2210,1450],[2190,1230],[2070,1050]],64)
  ]),
  landmarks:Object.freeze([
    L('fountain','central_fountain',1800,1650,190,190),
    L('castle','castle',1800,930,320,180,'south','royal'),
    L('main_market','main_market',2220,1540,250,170,'west','commerce'),
    L('ancient_tree','ancient_tree',1400,1450,180,200,'southeast','dark_forest')
  ]),
  // Existing compiled Forest Plaza pieces are deliberately composed into facades,
  // civic edges, market furniture and vegetation. No Math.random / seed decides placement.
  placements:Object.freeze([
    P('city:north:stairs','forest-plaza:asset-027',1740,1010),
    P('city:north:pillar-l','forest-plaza:asset-036',1640,930),
    P('city:north:pillar-r','forest-plaza:asset-046',1960,930),
    P('city:north:banner-l','forest-plaza:asset-033',1580,990),
    P('city:north:banner-r','forest-plaza:asset-038',2020,990),
    P('city:west:facade-1','forest-plaza:asset-024',1320,1210),
    P('city:west:facade-2','forest-plaza:asset-037',1270,1310),
    P('city:west:facade-3','forest-plaza:asset-039',1430,1310),
    P('city:east:facade-1','forest-plaza:asset-024',2180,1210),
    P('city:east:facade-2','forest-plaza:asset-037',2130,1310),
    P('city:east:facade-3','forest-plaza:asset-039',2290,1310),
    P('city:market:cart-a','forest-plaza:asset-092',2150,1510),
    P('city:market:cart-b','forest-plaza:asset-092',2300,1590,2),
    P('city:market:barrel-a','forest-plaza:asset-117',2110,1580),
    P('city:market:crate-a','forest-plaza:asset-118',2350,1510),
    P('city:market:lamp-a','forest-plaza:asset-091',2070,1430),
    P('city:market:lamp-b','forest-plaza:asset-091',2370,1430),
    P('city:plaza:fountain','forest-plaza:asset-062',1760,1610),
    P('city:plaza:planter-nw','forest-plaza:asset-054',1590,1470),
    P('city:plaza:planter-ne','forest-plaza:asset-057',1970,1470),
    P('city:plaza:planter-sw','forest-plaza:asset-058',1590,1830),
    P('city:plaza:planter-se','forest-plaza:asset-069',1970,1830),
    P('city:plaza:column-w','forest-plaza:asset-036',1510,1650),
    P('city:plaza:column-e','forest-plaza:asset-046',2090,1650),
    P('city:garden:tree-a','forest-plaza:asset-120',1260,1420),
    P('city:garden:tree-b','forest-plaza:asset-123',1460,1370),
    P('city:garden:tree-c','forest-plaza:asset-122',1300,1570),
    P('city:garden:bush-a','forest-plaza:asset-121',1510,1510),
    P('city:south:tree-a','forest-plaza:asset-120',1470,2050),
    P('city:south:tree-b','forest-plaza:asset-123',2130,2050),
    P('city:south:lamp-l','forest-plaza:asset-091',1660,2070),
    P('city:south:lamp-r','forest-plaza:asset-091',1940,2070)
  ])
});

export function applyAuthoredCapitalQuarter(parts,recipe){
  if(recipe?.id!=='KELO_ROYAL_CAPITAL_V1')return parts;
  const a=KELO_AUTHORED_CAPITAL_QUARTER;
  const otherLandmarks=(parts.landmarks||[]).filter(row=>!['fountain','castle','main_market'].includes(row.id));
  return {
    ...parts,
    roads:[...(parts.roads||[]).filter(row=>String(row.id).startsWith('road:exit:')), ...a.roads],
    landmarks:[...otherLandmarks,...a.landmarks],
    spawnPoints:[a.spawn],
    prefabPlacements:[...(parts.prefabPlacements||[]),...a.placements.map(row=>({
      placementId:row.id,assetId:row.assetId,position:{x:row.x,y:row.y},rotation:row.rotation,layer:'property',authored:true
    }))],
    authoredComposition:{id:'kelo-capital-quarter',version:a.version,bounds:a.bounds,placementCount:a.placements.length,roadCount:a.roads.length},
    generationStats:{...(parts.generationStats||{}),authoredCityPlacementCount:a.placements.length,authoredCityRoadCount:a.roads.length}
  };
}

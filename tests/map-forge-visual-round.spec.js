/* KELO-INDEX
 * area: TEST / MAP FORGE / VISUAL ROUND
 * owner: Map Forge visual convergence CI
 * purpose: capture deterministic fixed-seed preview + real exterior evidence and validate representative seeds
 * public-api: Playwright test
 * consumes: Map Forge workspace, World Builder preview/runtime, golden seeds
 * state-owned: test-results evidence only
 * do-not: no publish or LIVE mutation
 */
const {test,expect}=require('@playwright/test');
const fs=require('fs');

const MAIN_SEED=81746291;
const VALIDATION_SEEDS=[81746291,12345,424242,29011987];
const STAGE=process.env.KELO_VISUAL_STAGE==='after'?'after':'before';
const URBAN_KINDS=new Set(['plaza','royal','commerce']);

test.use({viewport:{width:1440,height:900}});
test.setTimeout(60000);

function pointSegmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
  return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
}
function nearestRoadDistance(p,roads){
  let best=Infinity;
  for(const road of roads||[])for(let i=1;i<(road.polyline||[]).length;i++)best=Math.min(best,pointSegmentDistance(p,road.polyline[i-1],road.polyline[i]));
  return best;
}
function mapMetrics(map){
  const districtById=new Map((map.districts||[]).map(d=>[d.id,d]));
  const urban=(map.decorations||[]).filter(d=>URBAN_KINDS.has(districtById.get(d.district)?.kind));
  const roadDistances=urban.map(d=>nearestRoadDistance(d,map.roads));
  const streetscape=roadDistances.filter(distance=>distance>=35&&distance<=190).length;
  const familyCounts={};for(const d of map.decorations||[])familyCounts[d.family]=(familyCounts[d.family]||0)+1;
  return{
    seed:map.metadata?.seed,
    layoutHash:map.metadata?.layoutHash,
    valid:!!map.validation?.valid,
    errors:map.validation?.errors||[],
    roadCount:(map.roads||[]).length,
    blockCount:(map.blocks||[]).length,
    decorationCount:(map.decorations||[]).length,
    urbanDecorationCount:urban.length,
    urbanStreetscapeCount:streetscape,
    urbanStreetscapeRatio:urban.length?Number((streetscape/urban.length).toFixed(4)):1,
    familyCounts
  };
}

async function bootForge(page){
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  const response=await page.goto('/?mapEditor=1&offline=1',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>!!(window.KELO_WORLD_BUILDER?.renderSnapshotPreview&&window.KELO_PROPERTY_SYSTEM?.drawPlacements&&window.KELO_PROPERTY_CATALOG&&window.KeloCamera?.focus&&window.KELO_ADMIN_KEYS?.can?.('world.edit')),null,{timeout:15000});
  await page.evaluate(async()=>{const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');const platform=await bootKeloCreators({root:window});await platform.openWorkspace('map-forge');});
  const forge=page.locator('#kelo-map-forge');await expect(forge).toBeVisible();
  return{forge,pageErrors};
}

async function generateSelected(page,forge,seed){
  await page.getByRole('spinbutton',{name:/Seed/}).fill(String(seed));
  await page.getByRole('combobox',{name:'Candidatos'}).selectOption({label:'Best of 4'});
  await page.getByRole('button',{name:'GENERAR'}).click();
  await expect(forge.getByText(/4\/4 válidos/)).toBeVisible({timeout:15000});
  await forge.getByRole('button').filter({hasText:`Seed ${seed}`}).first().click();
  await page.waitForFunction(async expected=>{const {getMapForgeWorkspace}=await import('./src/creators/ui/map-forge-workspace.mjs');return getMapForgeWorkspace()?.selected?.metadata?.seed===expected;},seed,{timeout:5000});
  return page.evaluate(async()=>{const {getMapForgeWorkspace}=await import('./src/creators/ui/map-forge-workspace.mjs');const map=getMapForgeWorkspace().selected;return JSON.parse(JSON.stringify(map));});
}

test(`Map Forge ${STAGE} fixed-seed preview/runtime visual evidence`,async({page})=>{
  fs.mkdirSync('test-results',{recursive:true});
  const {forge,pageErrors}=await bootForge(page);
  const mainMap=await generateSelected(page,forge,MAIN_SEED);
  const mainMetrics=mapMetrics(mainMap);
  expect(mainMetrics.valid).toBe(true);expect(mainMetrics.errors).toEqual([]);
  if(STAGE==='after'){expect(mainMetrics.urbanStreetscapeRatio).toBe(1);expect(mainMetrics.decorationCount).toBeGreaterThanOrEqual(200);}
  await page.screenshot({path:`test-results/screenshot_preview_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VER EN MAPA EXTERIOR'}).click();
  await expect(forge).toHaveCount(0,{timeout:1000});
  await expect(page.getByRole('button',{name:'VOLVER A MAP FORGE'})).toBeVisible({timeout:15000});
  const runtime=await page.evaluate(()=>{const snapshot=window.KELO_WORLD_BUILDER.snapshot(),placements=window.KELO_PROPERTY_SYSTEM.getPlacements('parcel:world:editor')||[];return{viewKind:snapshot?.view?.kind||null,cellCount:Object.keys(snapshot?.cells||{}).length,placementCount:placements.length};});
  expect(runtime.viewKind).toBe('preview');expect(runtime.cellCount).toBeGreaterThan(5000);expect(runtime.placementCount).toBeGreaterThan(0);
  await page.screenshot({path:`test-results/screenshot_runtime_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VOLVER A MAP FORGE'}).click();
  await expect(page.locator('#kelo-map-forge')).toBeVisible({timeout:15000});
  const validation=[];
  for(const seed of VALIDATION_SEEDS){
    const map=await generateSelected(page,page.locator('#kelo-map-forge'),seed),metrics=mapMetrics(map);
    expect(metrics.valid).toBe(true);expect(metrics.errors).toEqual([]);
    if(STAGE==='after'){expect(metrics.urbanStreetscapeRatio).toBe(1);expect(metrics.decorationCount).toBeGreaterThanOrEqual(200);}
    validation.push(metrics);
  }
  const evidence={stage:STAGE,mainSeed:MAIN_SEED,validationSeeds:VALIDATION_SEEDS,main:mainMetrics,runtime,validation,pageErrors};
  fs.writeFileSync(`test-results/map-forge-visual-metrics-${STAGE}.json`,JSON.stringify(evidence,null,2));
  expect(pageErrors).toEqual([]);
});

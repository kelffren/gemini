/* KELO-INDEX
 * area: TEST / MAP FORGE / VISUAL COMPOSITION
 * owner: Map Forge visual convergence CI
 * purpose: prevent regression of approved hero-landmark breathing room in Royal Capital
 * public-api: Playwright test
 * consumes: effective Map Forge recipe data
 * state-owned: none
 * do-not: no runtime mutation or alternate generator
 */
const {test,expect}=require('@playwright/test');

test('Royal Capital keeps hero landmarks readable with protected breathing room',async()=>{
  const {getMapForgeRecipe}=await import('../src/world/map-forge/map-forge-recipes.mjs');
  const recipe=getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1');
  const fountain=recipe.landmarks.find(item=>item.id==='fountain');
  const market=recipe.landmarks.find(item=>item.id==='main_market');
  expect(recipe.version).toContain('-evo.4');
  expect(fountain).toBeTruthy();
  expect(fountain.keepClearRadius).toBe(210);
  expect(fountain.keepClearRadius).toBeGreaterThan(fountain.footprint.w/2);
  expect(market).toBeTruthy();
  expect(market.keepClearRadius).toBe(150);
  expect(market.keepClearRadius).toBeGreaterThan(market.footprint.w/2);
});

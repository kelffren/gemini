/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION / CHAMPION
 * owner: KeloMapForge champion data registry
 * purpose: store only evolution overrides that have passed golden-seed gates and review
 * public-api: MAP_FORGE_CHAMPION_OVERRIDES
 * consumes: Map Forge recipe ids
 * state-owned: immutable approved override data
 * online: base-world recipe data only; server/runtime deltas remain separate
 * do-not: no generator logic, runtime writes or auto-merge authority
 */
export const MAP_FORGE_CHAMPION_OVERRIDES=Object.freeze({
  KELO_ROYAL_CAPITAL_V1:Object.freeze({
    revision:4,
    genes:Object.freeze({
      'road.curvature':0.34,
      'style.decoration':0.64,
      'landmark.fountain.keepClearRadius':210,
      'landmark.harbor_gate.keepClearRadius':135
    })
  })
});

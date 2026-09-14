/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION / CHAMPION
 * owner: KeloMapForge champion data registry
 * purpose: store only evolution overrides that passed search + unseen holdout + paired-seed gates and GitHub review
 * public-api: MAP_FORGE_CHAMPION_OVERRIDES
 * consumes: Map Forge recipe ids
 * state-owned: immutable approved override data
 * online: base-world recipe data only; server/runtime deltas remain separate
 * do-not: no generator logic, runtime writes or auto-merge authority
 */
export const MAP_FORGE_CHAMPION_OVERRIDES=Object.freeze({
  "KELO_ROYAL_CAPITAL_V1": {
    "revision": 24,
    "sourceSha": "95fd218fbb982e422abeec203f362a777f911b2b",
    "score": 94.997,
    "holdoutScore": 96.128,
    "evidenceFingerprint": "mf-evidence-34c78e99f00b",
    "evaluatorVersion": "map-forge-evolution-v3",
    "genes": {
      "style.monumentality": 0.94,
      "style.organicRoads": 0.48,
      "style.density": 0.7367,
      "style.vegetation": 0.68,
      "style.exploration": 0.74,
      "style.decoration": 0.6,
      "road.loopRatio": 0.34,
      "road.curvature": 0.34,
      "district.central.weight": 1.22,
      "district.royal.weight": 1.05,
      "district.commerce.weight": 1,
      "district.residential.weight": 1,
      "district.harbor.weight": 0.92,
      "district.dark_forest.weight": 0.95,
      "district.farms.weight": 1.02,
      "district.mining.weight": 0.96,
      "landmark.fountain.keepClearRadius": 210,
      "landmark.castle.keepClearRadius": 210,
      "landmark.main_market.keepClearRadius": 130,
      "landmark.harbor_gate.keepClearRadius": 120,
      "landmark.ancient_tree.keepClearRadius": 120,
      "landmark.windmill.keepClearRadius": 100,
      "landmark.mine_gate.keepClearRadius": 110
    }
  },
  "KELO_VILLAGE_V1": {
    "revision": 1,
    "sourceSha": "95fd218fbb982e422abeec203f362a777f911b2b",
    "score": 94.957,
    "holdoutScore": 94.847,
    "evidenceFingerprint": "mf-evidence-837e522103fc",
    "evaluatorVersion": "map-forge-evolution-v3",
    "genes": {
      "style.monumentality": 0.48,
      "style.organicRoads": 0.72,
      "style.density": 0.42,
      "style.vegetation": 0.78,
      "style.exploration": 0.68,
      "style.decoration": 0.66,
      "road.loopRatio": 0.24,
      "road.curvature": 0.7,
      "district.central.weight": 1.1,
      "district.homes.weight": 1.12,
      "district.shops.weight": 0.85,
      "district.farms.weight": 1.18,
      "district.woods.weight": 1.05,
      "landmark.village_tree.keepClearRadius": 150.2149,
      "landmark.village_market.keepClearRadius": 90,
      "landmark.village_barn.keepClearRadius": 95
    }
  },
  "KELO_FOREST_V1": {
    "revision": 1,
    "sourceSha": "95fd218fbb982e422abeec203f362a777f911b2b",
    "score": 88.662,
    "holdoutScore": 89.02,
    "evidenceFingerprint": "mf-evidence-22df2b5c75b4",
    "evaluatorVersion": "map-forge-evolution-v3",
    "genes": {
      "style.monumentality": 0.34,
      "style.organicRoads": 0.92,
      "style.density": 0.54,
      "style.vegetation": 0.96,
      "style.exploration": 0.94,
      "style.decoration": 0.6895,
      "road.loopRatio": 0.38,
      "road.curvature": 0.9,
      "district.central.weight": 0.88,
      "district.grove.weight": 1.18,
      "district.ruins.weight": 0.8,
      "district.stream.weight": 0.72,
      "district.deepwood.weight": 1.25,
      "landmark.ancient_tree.keepClearRadius": 145,
      "landmark.ruin_tower.keepClearRadius": 120
    }
  }
});

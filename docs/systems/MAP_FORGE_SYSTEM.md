# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` genera **Base Generated Worlds** deterministas para Kelo World. El core sigue siendo data-only: no posee renderer, cámara, colisión runtime, Property ni autoridad de publicación.

```text
Map Forge Candidate
→ mapDefinitionToWorldDraftSnapshot()
→ World Draft Snapshot
   ├─ KELO_WORLD_BUILDER.renderSnapshotPreview() [read-only]
   └─ KELO_WORLD_EDIT world:draft:import
      → world:preview:enter
      → World Builder / Property
      → KeloCamera.focus()
```

## Estado actual

**CREATOR ACTIVE / DRAFT PREVIEW LIVE / EVOLUTION V3 HOLDOUT-GATED / ONLINE-FIRST.**

Map Forge sigue reutilizando el mismo generator/scorer, World Builder, Property y KeloCamera. `KeloEvolution` es únicamente una capa externa de búsqueda/aceptación; no se convierte en un segundo map engine ni puede publicar o mergear por sí mismo.

## Owners y archivos

- Core procedural: `src/world/map-forge/map-forge-core.mjs`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
- Validator/scorer: `src/world/map-forge/map-forge-quality.mjs`.
- Builder: `src/world/map-forge/map-forge-builder.mjs`.
- Evolution adapter: `src/world/map-forge/map-forge-evolution.mjs`.
- Golden seeds: `src/world/map-forge/map-forge-golden-seeds.mjs`.
- Champion data: `src/world/map-forge/map-forge-champion-overrides.mjs`.
- Worker: `map-forge-worker.mjs` + `map-forge-worker-client.mjs`.
- Creator UI: `src/creators/ui/map-forge-workspace.mjs`.
- Workspace routing: `src/creators/workspaces/map-forge-workspace.mjs`.
- Importer: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Draft authority: `KELO_WORLD_EDIT`.
- Preview renderer: `src/environment/world-builder-system.js`.
- Placements: `src/property/property-system.js` + `property-asset-catalog.js`.
- Camera: `KeloCamera`.
- Evolution memory: `docs/evolution/map-forge-memory.json`.
- Autopilot: `scripts/map-forge-evolution-autopilot.mjs`.

## Determinismo

La identidad del Base Generated World usa `mapId`, `seed`, `generatorVersion`, `recipeId`, `recipeVersion`, `assetCatalogVersion` y `layoutHash`. No hay `Math.random()` ni tiempos de pared dentro del `MapDefinition`.

Champion overrides aprobados cambian la recipe efectiva a `recipeVersion-evo.<revision>`, preservando reproducibilidad.

## Pipeline procedural

```text
Map Intent
→ Semantic Graph
→ district anchors + relaxation
→ weighted power-Voronoi field
→ landmarks
→ Delaunay candidates
→ MST
→ loops
→ curved road polylines
→ blocks/parcels
→ terrain/paving
→ decoration placement
→ scenic vistas
→ navigation graph
→ chunk index
→ validator
→ scorer
→ best-of-N
→ MapDefinition
```

## Evolution V3

El genoma permitido continúa limitado a recipe parameters:

```text
style.monumentality / organicRoads / density / vegetation / exploration / decoration
road.loopRatio / road.curvature
district.<id>.weight
landmark.<id>.keepClearRadius
```

### Search separado de holdout

Search combina golden seeds fijas + validation seeds derivadas. Los challengers compiten solo allí. Después de elegir al mejor provisional se genera un holdout bank determinista bajo otro namespace y se excluyen explícitamente todas las search seeds. Esto reduce overfitting al corpus que decide el ranking.

### Paired seed regression gate

Baseline y challenger se ejecutan con exactamente las mismas holdout seeds. `compareMapForgePairedEvaluations()` reporta wins/losses/ties, win rate, mean/median delta y worst regression sobre una utilidad que combina quality, visual, navigation y complexity. Un promedio agregado alto no puede esconder libremente una caída severa en una seed concreta.

### Pareto frontier

La selección prioriza challengers no dominados en meanQuality, worstQuality, meanVisual, navigationFloor y complexitySafety. El score ponderado sigue resolviendo magnitud y hard gates siguen siendo autoridad absoluta.

### Novelty y fingerprints

Cada genoma tiene fingerprint determinista. La distancia se normaliza por el rango permitido de cada gen. El proposer evita duplicados exactos, cambios por debajo del novelty floor, candidatos casi idénticos entre sí y fingerprints ya registrados en experiment memory.

### Mutation bandit memory

La memoria registra intentos/accepted/delta por gen. `mutationPriority()` combina historial de éxito con exploration bonus. Las mutaciones que funcionan reciben más presupuesto, pero genes poco explorados no quedan bloqueados permanentemente.

### Escape de estancamiento

Si dos generaciones seguidas no promocionan un challenger y el caller no fijó focus, Evolution rota temporalmente a un scope (`style`, `roads`, `districts`, `landmarks`) y amplía el step de forma acotada. El resultado sigue obligado a pasar search, holdout y paired gate.

### Winner minimization

Después de encontrar un champion válido, `minimizeMapForgeWinner()` intenta revertir genes cambiados al baseline. Solo conserva una reversión cuando el genoma simplificado sigue superando search minimum improvement, holdout minimum improvement y paired regression policy. Así el override final tiende al cambio mínimo suficiente.

### Evidencia reproducible

Cada resultado V3 incluye `evaluatorVersion`, `searchSeedFingerprint`, `holdoutSeedFingerprint`, `baselineFingerprint`, `championFingerprint`, scores search/holdout y `evidenceFingerprint`. El autopilot persiste el evidence fingerprint en su artifact y, si promociona, en metadata del override/memory.

## Score estructural

Se conserva el perfil multidimensional:

| Métrica | Peso | Gate |
|---|---:|---|
| meanQuality | 4.0 | — |
| worstQuality | 2.5 | — |
| meanVisual | 2.0 | — |
| worstVisual | 1.25 | — |
| navigationFloor | 1.5 | >=60 |
| complexitySafety | 1.0 | >=55 |
| stability | 1.0 | — |
| validRate | 2.0 | 100% |

`generationMs` y preview render time son telemetría; wall-clock de runner no entra al score determinista.

## Golden seeds y holdout

`map-forge-golden-seeds.mjs` conserva un corpus fijo por recipe. Golden seeds participan en search; holdout usa seeds distintas para validar generalización. `validRate` permanece hard gate 100 % en ambos bancos.

## Evolución parcial

`lockedGenes`, `focusScopes` y `focusGenes` permiten congelar zonas lógicas ya buenas y trabajar solo en roads/districts/landmarks/style. Esto restringe **qué cambia**, no el costo computacional: el procedural core todavía reconstruye el candidato completo.

## Champion overrides

Solo data que llega a `main` se vuelve recipe efectiva. El runtime consume `revision` y `genes`; campos V3 como `holdoutScore`, `evidenceFingerprint` o `evaluatorVersion` son metadata de auditoría y no alteran gameplay/runtime.

## Autopilot V3

```text
main
→ audit:evolution
→ challengers en search
→ Pareto + score
→ ganador provisional
→ unseen holdout
→ paired gate
→ minimización
→ si no mejora: no diff
→ si mejora: champion + memory + evidence
→ map-forge-core + evolution + docs
→ branch + PR
→ STOP
```

Nunca auto-mergea.

## Preview / World Editor

Map Forge reutiliza `KELO_WORLD_BUILDER.renderSnapshotPreview()`; no existe renderer especial de Evolution. Playwright captura baseline/champion por la misma ruta real de World Builder/Property. `VER EN MAPA EXTERIOR` sigue siendo preview reversible, no Publish; `ABRIR EN WORLD EDITOR` importa un draft separado y abre Studio.

El importer resuelve assets semánticos mediante el catálogo real. Cuando una familia declara varias alternativas aprobadas, selecciona una variante de forma determinista a partir de la identidad y posición final del elemento. Esto evita que árboles, farolas, fuentes y jardineras repitan siempre el primer asset del catálogo sin introducir aleatoriedad, alterar el `MapDefinition` ni crear otro renderer.

La colocación natural reutiliza el Poisson owner existente con propuestas mixtas: bosque y granja combinan muestras globales con microagrupaciones alrededor de puntos ya válidos. Cada propuesta agrupada vuelve a pasar exactamente las mismas fronteras, carreteras, bloques, clearance de landmarks y separación mínima. El resultado conserva densidad y seguridad, pero introduce grupos y claros reproducibles en vez de una dispersión uniformemente independiente.

## Online-first

```text
Base Generated World
+ Server / Runtime Deltas
```

Map Forge no posee deltas valiosos. UI pide mutaciones por `KELO_WORLD_EDIT.request()`, reemplazable por autoridad remota. Evolution no obtiene autoridad gameplay/publish.

## Invariantes

1. No `Math.random()` en procedural core.
2. No DOM/Canvas en core.
3. No writes directos a `obstacles`/`KELO_COLLISION` desde Map Forge/importer.
4. Camera solo mediante `KeloCamera`.
5. Same inputs ⇒ same layoutHash/serialización.
6. Candidato inválido no entra en handoff ni champion.
7. Evolution no duplica generator/scorer.
8. Search winner debe pasar holdout antes de promoción.
9. Holdout bank no comparte seeds con search bank.
10. Paired gate protege regresiones por caso.
11. Winner minimization no relaja gates.
12. Autopilot nunca mergea su propio PR.

## Tests y CI

- `node scripts/map-forge-core-audit.mjs` — determinismo/recipes/conectividad/quality/best-of.
- `node scripts/map-forge-studio-handoff-audit.mjs` — proyección/handoff/owners.
- `npm run audit:evolution` — V3 search/holdout, paired, Pareto, novelty, memory, determinismo, evidence y minimización.
- `npm run audit:evolution:sandbox` — code-patch worktree aislado.
- `tests/map-forge-mobile-preview.spec.js` — preview/handoff móvil.
- `tests/map-forge-evolution-visual.spec.js` — screenshots baseline/champion + telemetry.

## Deuda pendiente real

- WFC local con budget/retry/fallback;
- regeneración física parcial de chunks/distritos;
- atlas/path authored activo para roads/marble;
- más templates para semantic landmark families;
- benchmark FPS del runtime jugable;
- visual judge semántico como métrica secundaria;
- validación online contra autoridad remota cuando exista server correspondiente.

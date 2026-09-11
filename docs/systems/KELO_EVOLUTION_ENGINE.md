# Kelo Evolution Engine — System Contract

## Propósito

`KeloEvolution` es la capacidad interna de Kelo World para ejecutar el ciclo **champion → challengers → sandbox → evaluación → keep/revert**. Permite que parámetros, recipes y parches de código puedan tratarse como candidatos medibles sin convertir el runtime del juego en autoridad de Git, deploy o producción.

```text
champion baseline
→ proposer genera challengers
→ prepare crea sandbox opcional
→ evaluator ejecuta métricas / tests
→ hard gates + score + mejora mínima
→ ranking champion/challenger
→ apply opcional
→ rollback si apply falla
→ experiment record
```

No es un segundo game engine. No modifica gameplay por sí mismo y no concede credenciales ni acceso irrestricto al repositorio.

## Estado actual

**V2 / INTERNAL CREATOR CAPABILITY / ACTIVE / HEADLESS / GATED CODE-CANDIDATE READY.**

V2 añade diez capacidades sobre V1:

1. candidatos de parche de código completos y serializables;
2. sandbox aislado en Git worktree;
3. evidencia visual Playwright baseline/champion con screenshots reales;
4. golden seed bank Map Forge;
5. genoma Map Forge ampliado a estilo, carreteras, distritos y landmarks;
6. evolución parcial mediante locks, scopes y genes focales;
7. memoria de experimentos y penalización de mutaciones fallidas;
8. champion/challenger tournament genérico;
9. score multidimensional + telemetría de generación/render;
10. autopilot GitHub que crea rama/commit/PR únicamente tras gates y nunca hace auto-merge.

## Owner y archivos

- Gate genérico: `src/creators/evolution/evolution-engine.mjs`.
- Memoria pura: `src/creators/evolution/evolution-memory.mjs`.
- Contrato de code-patch: `src/creators/evolution/code-patch-candidate.mjs`.
- Sandbox Git externo: `scripts/kelo-code-evolution-sandbox.mjs`.
- Sandbox audit: `scripts/kelo-evolution-sandbox-audit.mjs`.
- Map Forge adapter V2: `src/world/map-forge/map-forge-evolution.mjs`.
- Golden seeds: `src/world/map-forge/map-forge-golden-seeds.mjs`.
- Champion overrides: `src/world/map-forge/map-forge-champion-overrides.mjs`.
- Memoria persistible actual: `docs/evolution/map-forge-memory.json`.
- Autopilot runner: `scripts/map-forge-evolution-autopilot.mjs`.
- CI normal: `.github/workflows/kelo-evolution-ci.yml`.
- Autopilot: `.github/workflows/kelo-evolution-autopilot.yml`.
- Evidencia visual: `tests/map-forge-evolution-visual.spec.js`.

## Estado que posee

El core `KeloEvolution` no posee estado persistente. Cada llamada devuelve estructuras inmutables.

La memoria es también funcional: `recordEvolutionExperiment()` devuelve un snapshot nuevo. El lugar que invoque el engine decide si esa memoria vive en un artifact, archivo Git o almacenamiento remoto.

GitHub Actions posee temporalmente worktrees, commits y ramas de candidatos. El runtime del navegador nunca recibe esa autoridad.

## Estado que NO posee

- gameplay o economía;
- mundo LIVE;
- renderer/cámara/colisión;
- Map Forge procedural core;
- credenciales GitHub;
- merge authority;
- deploy;
- secretos;
- server authority gameplay.

## API genérica

### `createEvolutionMetricProfile()` / `scoreEvolutionMetrics()`

Define métricas ponderadas `maximize|minimize`, normalización y hard gates `hardMin` / `hardMax`.

### `compareEvolutionEvaluations()`

Un challenger solo gana si es válido, supera `minScore` y mejora al champion al menos `minImprovement`.

### `selectEvolutionCandidate()`

Devuelve evaluación completa, ranking y mejor challenger aceptable. Empates preservan orden determinista.

### `runEvolutionCycle()`

V2 admite:

```js
await runEvolutionCycle({
  baseline,
  propose,
  prepare,   // sandbox opcional
  evaluate,
  cleanup,   // obligatorio para callers con sandbox
  policy: { minImprovement: 0.5 },
  apply,
  rollback,
  onExperiment
});
```

`prepare` también se aplica al baseline para que champion y challengers se midan bajo la misma frontera. Un error de preparación/evaluación invalida el candidato. Un error de cleanup también lo invalida. `apply` nunca ocurre antes del gate.

### `runChampionChallengerTournament()`

Compara un champion con varios challengers y devuelve `championBefore`, `championAfter`, `ranking` y `changed`. No aplica cambios por sí solo.

## Code Patch Candidate V1

`createCodePatchCandidate()` representa un cambio como reemplazos de texto completos:

```text
id
baseSha
objective
changes[] = path + beforeHash + afterContent
tests[] = IDs registrados
```

`validateCodePatchCandidate()` aplica límites de cantidad/tamaño, path traversal, allowlist y denylist. Por defecto quedan fuera `.env`, `.git`, `node_modules`, `server`, `supabase`, secretos/credenciales y otras rutas sensibles.

El candidato **no puede incluir comandos shell arbitrarios**. Solo puede pedir IDs de tests que el sandbox ya conozca.

## Sandbox de código

`scripts/kelo-code-evolution-sandbox.mjs`:

1. valida contrato/allowlist;
2. verifica que `baseSha` coincide con el checkout;
3. crea un `git worktree --detach` temporal;
4. verifica SHA-256 del contenido previo de cada archivo;
5. aplica el candidate únicamente al worktree;
6. ejecuta `node --check` y tests registrados;
7. captura diff/reporte;
8. elimina el worktree incluso cuando falla.

El sandbox no empuja ramas, no hace merge y no despliega.

## Memoria de experimentos

`evolution-memory.mjs` conserva records de candidato, score, delta, métricas, fallos, mutaciones y artifacts. `mutationFailureCount()` permite que un proposer reduzca la probabilidad de repetir genes que ya han fallado.

V2 no convierte memoria histórica en verdad absoluta: una mutación penalizada puede volver a probarse; solamente recibe menor prioridad.

## Map Forge Genome V2

El adapter ya no evoluciona solo seis sliders. `createMapForgeGeneCatalog()` expone genes de:

- `style.*`: monumentalidad, organic roads, density, vegetation, exploration, decoration;
- `road.loopRatio` y `road.curvature`;
- `district.<id>.weight` para cada distrito;
- `landmark.<id>.keepClearRadius` para cada landmark.

`applyMapForgeGenome()` deriva una recipe candidata sin mutar la recipe original.

### Evolución parcial

`proposeMapForgeGenomeMutations()` acepta:

- `lockedGenes`: nunca tocar genes concretos/prefijos;
- `focusScopes`: limitar búsqueda a `style`, `roads`, `districts` o `landmarks`;
- `focusGenes`: limitar a un distrito/landmark/gen concreto.

Ejemplos conceptuales:

```text
lockedGenes: ['district.central.*']
focusScopes: ['roads']
focusGenes: ['district.harbor.*']
```

Esto permite preservar partes que funcionan y concentrar la búsqueda sin reescribir el generator core.

## Golden seeds

`map-forge-golden-seeds.mjs` contiene un corpus fijo por recipe. La evaluación V2 mezcla golden seeds con validation seeds derivadas de un seed del experimento.

Un challenger no puede ganar porque tuvo suerte en una sola seed. `validRate` mantiene hard gate de 100 % sobre el banco ejecutado.

## Score multidimensional Map Forge V2

| Métrica | Peso | Gate |
|---|---:|---|
| `meanQuality` | 4.0 | — |
| `worstQuality` | 2.5 | — |
| `meanVisual` | 2.0 | — |
| `worstVisual` | 1.25 | — |
| `navigationFloor` | 1.5 | `>=60` |
| `complexitySafety` | 1.0 | `>=55` |
| `stability` | 1.0 | — |
| `validRate` | 2.0 | `100%` |

`generationMs` se registra como telemetría de rendimiento pero deliberadamente no entra todavía al score determinista: el tiempo de runner puede variar aunque el algoritmo no cambie. La evidencia Playwright registra además tiempo de render de preview.

## Evidencia visual real

`tests/map-forge-evolution-visual.spec.js` abre el checkout servido en Chromium, reutiliza `KELO_WORLD_BUILDER.renderSnapshotPreview()` y `mapDefinitionToWorldDraftSnapshot()`, renderiza baseline y resultado a Canvas y guarda:

- `map-forge-evolution-baseline.png`;
- `map-forge-evolution-champion.png`;
- `map-forge-evolution-side-by-side.png`;
- JSON con métricas de píxeles, scores y tiempos de generación/render.

Las métricas de píxeles prueban que los renders no están vacíos; el scorer estructural sigue siendo la autoridad de aceptación. Un visual judge futuro puede añadirse como métrica adicional, no como sustituto de validez/navegación.

## Champion overrides

`map-forge-champion-overrides.mjs` empieza vacío. `map-forge-recipes.mjs` solo aplica entries que ya hayan llegado a `main` mediante revisión/CI. Cuando hay override, la recipe efectiva incorpora `-evo.<revision>` en su versión para que identidad/serialización no oculten el cambio.

## Autopilot GitHub

`.github/workflows/kelo-evolution-autopilot.yml` corre por `workflow_dispatch` y una vez al día.

Flujo:

```text
checkout main
→ audit:evolution
→ champion vs challengers
→ golden seed gate
→ si no mejora: cero cambios
→ si mejora: escribir champion + memory
→ map-forge core audit + evolution audit + docs audit
→ crear branch
→ commit
→ push branch
→ abrir PR
→ STOP
```

El workflow **no tiene paso de merge**. Normal CI/revisión sigue siendo la autoridad de promoción a `main`.

## Invariantes

1. Ningún challenger se aplica antes de evaluación.
2. Hard gate fallido gana sobre promedio alto.
3. `minImprovement` evita churn por diferencias insignificantes.
4. `apply` fallido intenta rollback.
5. Sandbox no escribe el checkout principal.
6. Code candidate no puede ejecutar comandos arbitrarios.
7. Paths sensibles se rechazan antes de materializar.
8. Golden seeds se mantienen fijas y validation seeds complementan el corpus.
9. Performance wall-clock es telemetría, no score determinista V2.
10. Autopilot crea PR; nunca auto-merge.
11. Runtime/browser no posee GitHub authority.
12. Map Forge scorer/generator siguen siendo sus owners; Evolution orquesta, no duplica.

## Tests / CI

`npm run audit:evolution` cubre scoring, hard gates, sandbox hooks, champion/challenger, rollback, memory, path guard, golden seeds, locks/focus y determinismo Map Forge.

`npm run audit:evolution:sandbox` crea un parche sintético sobre el checkout, lo ejecuta en un worktree aislado, comprueba el diff y prueba que `.env` es rechazado.

`Kelo Evolution Engine CI` ejecuta además Playwright y sube evidencia visual.

## Online-first

La API separa proposición, evaluación, aplicación y persistencia. Un runner remoto futuro puede reemplazar GitHub Actions conservando candidate IDs, hashes, métricas, memoria y decisiones. Nada del contrato obliga a que autoridad crítica viva en el navegador.

## Deuda pendiente

- visual judge semántico/vision como métrica secundaria;
- ejecutar benchmarks de FPS del runtime jugable, no solo preview render;
- adapter de code-patch que reciba propuestas de un agente externo y traduzca resultados de CI a score compuesto;
- partial regeneration físico de chunks/distritos sin regenerar el mapa completo; V2 ya restringe **qué genes pueden cambiar**, pero el procedural core todavía reconstruye el candidato completo;
- server/object storage opcional para memoria extensa si supera lo razonable para Git artifacts.

## Cómo extender sin duplicar owner

- Nueva métrica: `createEvolutionMetricProfile()`.
- Nuevo dominio: adapter pequeño + `runEvolutionCycle()`.
- Nuevo code candidate: `kelo-code-patch-v1` + sandbox; no filesystem/Git dentro del engine.
- Map Forge: extender gene catalog/evaluator; no duplicar `map-forge-quality.mjs`.
- Persistencia: adaptar el snapshot de memory; no meter storage dentro del core.

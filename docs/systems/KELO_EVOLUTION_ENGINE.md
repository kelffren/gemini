# Kelo Evolution Engine — System Contract

## Propósito

`KeloEvolution` es la capacidad interna de Kelo World para ejecutar un ciclo de mejora medible y reversible:

```text
champion
→ generar challengers diversos
→ search evaluation
→ hard gates + Pareto + score
→ ganador provisional
→ holdout no visto
→ paired regression gate
→ minimizar el cambio ganador
→ sandbox/apply externo
→ keep / rollback
→ memoria + evidencia reproducible
```

No es un segundo game engine. No posee gameplay, renderer, mundo LIVE, Git, secretos, deploy ni merge authority.

## Estado actual

**V3 / INTERNAL CREATOR CAPABILITY / ACTIVE / HEADLESS / HOLDOUT-GATED / CODE-CANDIDATE READY.**

V3 conserva las diez capacidades de V2 (code candidates, worktree sandbox, Playwright evidence, golden seeds, genoma estructural, locks/focus, memoria, tournament, score multidimensional y PR-only autopilot) y añade diez mejoras acumulativas:

1. **Search vs holdout**: los challengers se eligen con un banco de búsqueda y solo el ganador provisional ve seeds holdout separadas.
2. **Paired seed gate**: champion y challenger se comparan seed por seed para impedir que un promedio oculte regresiones fuertes.
3. **Pareto frontier**: candidatos dominados en métricas críticas pierden prioridad antes del desempate por score escalar.
4. **Fingerprint + novelty**: dedupe determinista, distancia mínima de genoma y rechazo de fingerprints ya probados.
5. **Mutation bandit memory**: cada gen aprende intentos, aceptación y delta medio; el selector equilibra explotación y exploración.
6. **Stagnation escape**: tras varias generaciones sin avance, Map Forge rota scope y amplía el paso de mutación bajo límites.
7. **Winner minimization**: un ganador se poda revirtiendo genes innecesarios y conservando solo los cambios que siguen pasando search + holdout + paired gates.
8. **Code patch V2 risk/coverage**: fingerprint, objetivo obligatorio, tests mínimos inferidos por ruta y presupuesto de riesgo.
9. **Code patch evaluator**: sandbox, syntax, tests, riesgo, compactness y objetivo se traducen al contrato común de score.
10. **Evidence manifest**: evaluator version, fingerprints de seed banks/genomas y un evidence fingerprint reproducible acompañan cada propuesta.

## Owner y archivos

- Gate genérico: `src/creators/evolution/evolution-engine.mjs`.
- Memoria pura: `src/creators/evolution/evolution-memory.mjs`.
- Contrato code patch: `src/creators/evolution/code-patch-candidate.mjs`.
- Evaluador code patch: `src/creators/evolution/code-patch-evaluator.mjs`.
- Sandbox Git externo: `scripts/kelo-code-evolution-sandbox.mjs`.
- Sandbox audit: `scripts/kelo-evolution-sandbox-audit.mjs`.
- Map Forge adapter: `src/world/map-forge/map-forge-evolution.mjs`.
- Golden seeds: `src/world/map-forge/map-forge-golden-seeds.mjs`.
- Champion overrides: `src/world/map-forge/map-forge-champion-overrides.mjs`.
- Memoria persistible actual: `docs/evolution/map-forge-memory.json`.
- Autopilot: `scripts/map-forge-evolution-autopilot.mjs` + `.github/workflows/kelo-evolution-autopilot.yml`.
- CI: `.github/workflows/kelo-evolution-ci.yml`.
- Evidencia visual: `tests/map-forge-evolution-visual.spec.js`.

## Estado que posee

El core no posee estado persistente. Toda API devuelve objetos inmutables. La memoria también es funcional: el caller decide si el snapshot se guarda en Git artifact, archivo versionado o storage remoto. GitHub Actions puede poseer temporalmente worktrees/branches de candidato; el browser nunca recibe esa autoridad.

## Estado que NO posee

- gameplay/economía/HP/inventario;
- Map Forge generator/scorer;
- renderer/cámara/colisión/Property;
- publish del mundo;
- Git credentials o filesystem del runtime;
- merge/deploy;
- secretos;
- server gameplay authority.

## API genérica V3

### `createEvolutionMetricProfile()` / `scoreEvolutionMetrics()`

Métricas ponderadas `maximize|minimize`, normalización y hard gates `hardMin|hardMax`.

### `compareEvolutionEvaluations()`

Un challenger solo pasa si es válido, supera `minScore` y mejora al baseline al menos `minImprovement`.

### `evolutionFingerprint(value)`

Huella determinista de una estructura serializable. El orden de claves no altera el fingerprint.

### `computeEvolutionParetoFrontier(rows, objectives)`

Clasifica candidatos no dominados. Un candidato está dominado si otro es igual o mejor en todos los objetivos y estrictamente mejor en al menos uno.

### `selectEvolutionCandidate()`

Aplica hard gates/score y, cuando `policy.paretoObjectives` existe, prioriza el Pareto frontier entre challengers aceptables.

### `runEvolutionCycle()`

```js
await runEvolutionCycle({
  baseline,
  propose,
  evaluate,
  fingerprintCandidate,
  holdoutEvaluate,
  holdoutPolicy,
  prepare,
  cleanup,
  policy,
  apply,
  rollback,
  onExperiment
});
```

El baseline y challengers atraviesan la misma frontera de `prepare/evaluate/cleanup`. Si hay holdout, solo el ganador provisional se compara contra baseline en esa segunda fase. `apply` nunca corre antes de ambos gates.

### `runChampionChallengerTournament()`

Devuelve champion antes/después, ranking, Pareto frontier, duplicados, holdout y `rejectedStage` (`search`, `holdout` o `apply`).

## Memoria V2 del contrato de experimentos

`createEvolutionMemory()` normaliza snapshots a `kelo-evolution-memory-v2` y conserva compatibilidad de datos previos. Los records pueden guardar candidate ID + fingerprint, accepted/rejected stage, baseline/candidate score, holdout evidence, mutations, metrics/failures y artifacts/evidence fingerprints.

`mutationPerformance()` calcula intentos, accepted/rejected, acceptance rate y delta medio por gen. `mutationPriority()` añade exploración decreciente para que genes poco estudiados sigan teniendo oportunidad. `candidateSeenCount()` evita gastar presupuesto en el mismo candidato histórico.

## Code Patch Candidate V2

`kelo-code-patch-v2` mantiene `baseSha`, `beforeHash`, full-text replacements y test IDs registrados, y añade fingerprint estable, `objective` obligatorio por defecto, tests requeridos según rutas tocadas y `risk.score` con `maxRiskScore` configurable.

Reglas por defecto relevantes:

```text
src/creators/evolution/* → evolution
src/world/map-forge/*    → evolution + map-forge-core
docs/systems/*           → docs
tests/map-forge/*        → evolution + map-forge-handoff
```

Los paths sensibles (`.env`, `.git`, `server/`, `supabase/`, secrets/credentials, etc.) siguen rechazándose antes de materializar.

## Evaluador de code patches

`evaluateCodePatchSandboxReport()` convierte evidencia objetiva en métricas Evolution: validationSafety, syntaxPassRate, testPassRate, riskSafety, compactness del diff y objectiveScore opcional/obligatorio según caller. Validation, syntax y tests tienen hard gate 100 %. El evaluador es puro: no ejecuta Git/shell ni aplica cambios.

## Sandbox

`scripts/kelo-code-evolution-sandbox.mjs` conserva el contrato V2: valida candidate/policy/risk/test coverage, verifica `baseSha`, crea `git worktree --detach`, verifica SHA-256 previo, aplica solo dentro del worktree, corre syntax + test IDs registrados, captura diff/report y limpia siempre. No ejecuta comandos arbitrarios del candidato y no hace push/merge/deploy.

## Map Forge Evolution V3

El genoma sigue expresando:

```text
style.monumentality / organicRoads / density / vegetation / exploration / decoration
road.loopRatio / road.curvature
district.<id>.weight
landmark.<id>.keepClearRadius
```

### Search bank y holdout bank

El search bank combina golden seeds + validation seeds. El holdout bank se deriva de un namespace distinto y excluye explícitamente todas las search seeds. Los challengers compiten solo en search; el ganador provisional debe sobrevivir después al holdout.

### Paired regression gate

`compareMapForgePairedEvaluations()` compara la misma seed en baseline y challenger usando una utilidad compuesta de quality/visual/navigation/complexity. Reporta wins/losses/ties, winRate, mean/median delta y worst regression. Defaults:

```text
winRate >= 50%
meanDelta >= 0
medianDelta >= -0.1
worst regression <= 5 points
```

El autopilot usa un máximo de regresión todavía más estricto.

### Pareto

Antes del score final se consideran meanQuality, worstQuality, meanVisual, navigationFloor y complexitySafety. Esto reduce la posibilidad de que un challenger gane sacrificando una dimensión crítica para inflar otra.

### Novelty + dedupe

`mapForgeGenomeFingerprint()` identifica el genoma. `mapForgeGenomeDistance()` normaliza distancia por rango de cada gen. El proposer rechaza duplicados, candidatos demasiado cercanos al champion, variantes demasiado cercanas entre sí y fingerprints ya vistos en memoria.

### Bandit de mutaciones

El picker usa `mutationPriority()` en lugar de contar únicamente fallos. Genes con buen historial reciben más probabilidad, pero un exploration bonus evita cerrar la búsqueda demasiado pronto.

### Escape de estancamiento

Dos generaciones fallidas habilitan una estrategia de escape si el caller no fijó focus explícito: se selecciona un scope (`style`, `roads`, `districts`, `landmarks`) y se aumenta de forma acotada el mutation step. Cualquier variante resultante sigue pasando todos los gates normales.

### Winner minimization

`minimizeMapForgeWinner()` intenta revertir genes del challenger al baseline. Una reversión se conserva únicamente si el candidato reducido sigue pasando search improvement, holdout improvement y paired gate. El objetivo es promover el cambio mínimo suficiente.

### Evidencia reproducible

Cada resultado V3 incluye evaluatorVersion, searchSeedFingerprint, holdoutSeedFingerprint, baseline/champion genome fingerprint, scores search/holdout y evidence fingerprint. El autopilot guarda estos datos en su JSON artifact y en metadata del champion/memory.

## Autopilot GitHub

```text
checkout main
→ audit:evolution V3
→ search champion/challengers
→ unseen holdout + paired regression gate
→ winner minimization
→ si no mejora: cero cambios
→ si mejora: champion + memory + evidence manifest
→ Map Forge core + Evolution + docs
→ branch + commit + PR
→ STOP
```

No existe auto-merge. El PR normal y sus checks siguen siendo la autoridad de promoción.

## Invariantes

1. Ningún challenger se aplica antes de search gate.
2. Un search winner no se aplica antes del holdout gate cuando este existe.
3. Hard gate siempre prevalece sobre score alto.
4. Duplicate fingerprints no consumen evaluación innecesaria.
5. Pareto no sustituye los hard gates; solo ordena candidatos válidos.
6. Holdout no se usa para escoger entre toda la población.
7. Map Forge promotion exige comparación seed-pareada además de score agregado.
8. Winner minimization nunca puede debilitar gates para reducir el patch/genome.
9. Apply fallido intenta rollback.
10. Sandbox nunca escribe el checkout principal.
11. Code candidates no incluyen shell commands arbitrarios.
12. Tests mínimos y risk budget se validan antes del worktree.
13. Browser/runtime no posee Git authority.
14. Autopilot crea PR y nunca se auto-mergea.
15. Map Forge generator/scorer siguen siendo sus owners.

## Tests / CI

- `npm run audit:evolution`: weighted/hard gates, fingerprints, dedupe, Pareto, generic holdout, rollback, memory bandit, code patch risk/coverage/evaluator, Map Forge novelty, holdout separation, paired gates, determinismo, evidence manifest y minimización.
- `npm run audit:evolution:sandbox`: detached worktree + beforeHash + mandatory tests + denied paths.
- `Kelo Evolution Engine CI`: syntax, ambos audits, docs y Playwright baseline/champion evidence.
- Map Forge workflows existentes continúan protegiendo generator/handoff.

## Online-first

Proposición, evaluación, aplicación y persistencia siguen desacopladas. Un runner remoto puede reemplazar GitHub Actions manteniendo IDs, fingerprints, policies, seed manifests, métricas y decisions. Nada obliga a colocar autoridad crítica en el browser.

## Deuda pendiente real

- visual judge semántico/vision como métrica secundaria, nunca sustituto de validez estructural;
- benchmark de FPS del runtime jugable, no solo preview render/generation telemetry;
- adapter externo que **genere** propuestas de source code automáticamente; V3 ya evalúa su evidencia pero no inventa patches por sí mismo;
- regeneración física parcial de chunks/distritos; el focus V3 limita genes, no el costo procedural de recalcular el candidato completo;
- storage remoto/object storage si la memoria supera un tamaño razonable para Git artifacts;
- protección de `main` sigue siendo una configuración de repo separada de KeloEvolution.

## Cómo extender sin duplicar owner

- Nueva métrica: ampliar profile del owner.
- Nuevo dominio: adapter pequeño + `runEvolutionCycle()`.
- Nuevo code candidate: extender `kelo-code-patch-v2`; no meter filesystem/Git dentro del core.
- Nueva policy de tests/riesgo: `createCodePatchPolicy()`.
- Map Forge: extender gene catalog/evaluator; no duplicar `map-forge-quality.mjs`.
- Persistencia: adaptar snapshots de memory; no meter storage en el core.

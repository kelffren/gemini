# Kelo Evolution Engine — System Contract

## Propósito

`KeloEvolution` es una capacidad interna para que Kelo World pueda probar variantes y conservar únicamente cambios que demuestran una mejora medible frente a un baseline.

No es un segundo game engine y no permite que código de producción se reescriba sin control. Su responsabilidad termina en el ciclo:

```text
baseline
→ proposer produce candidatos
→ evaluator mide baseline y candidatos
→ hard gates + score + mejora mínima
→ seleccionar mejor candidato aceptable
→ apply opcional
→ rollback si apply falla
```

El tipo de candidato es genérico. Hoy el primer consumidor real es Map Forge, donde los candidatos son perfiles de estilo. En el futuro un agente autorizado puede representar un parche de código como candidato y usar exactamente el mismo gate, siempre que proporcione tests/evaluación y una operación segura de apply/rollback.

## Estado actual

**INTERNAL CREATOR CAPABILITY / ACTIVE / HEADLESS / ONLINE-NEUTRAL.**

La implementación es ESM pura, sin DOM, Canvas, gameplay state, persistencia ni red. El caller inyecta propuesta, evaluación, apply y rollback.

## Owner y archivos

- Owner de aceptación genérica: `src/creators/evolution/evolution-engine.mjs` / `KeloEvolution` conceptualmente.
- Primer adapter: `src/world/map-forge/map-forge-evolution.mjs`.
- Scorer real de mapas reutilizado: `src/world/map-forge/map-forge-quality.mjs`.
- Generator reutilizado: `src/world/map-forge/map-forge-core.mjs`.
- Audit determinista: `scripts/kelo-evolution-audit.mjs`.
- CI: `.github/workflows/kelo-evolution-ci.yml`.

## Estado que posee

Ningún estado runtime persistente.

Cada ciclo devuelve un reporte inmutable con:

- evaluación del baseline;
- candidatos evaluados;
- ganador aceptado, si existe;
- delta contra baseline;
- resultado aplicado o baseline conservado;
- estado de rollback cuando apply falla.

## Estado que NO posee

- gameplay;
- mundo LIVE;
- Map Forge procedural core;
- repositorio Git/GitHub;
- deploy;
- server authority;
- persistencia;
- UI;
- publicación de mapas/assets;
- definición de qué métricas pertenecen a cada subsistema.

## API pública

### `createEvolutionMetricProfile(definitions)`

Crea un perfil validado de métricas. Cada métrica puede declarar:

- `id`;
- `weight`;
- `min` / `max` para normalización;
- `direction: maximize | minimize`;
- `required`;
- `hardMin`;
- `hardMax`.

### `scoreEvolutionMetrics(profile, measurements)`

Normaliza métricas a 0–100, calcula score ponderado y falla cerrado cuando una métrica requerida falta o viola un hard gate.

### `compareEvolutionEvaluations(baseline, candidate, policy)`

Acepta solo si:

1. el candidato es válido;
2. supera `minScore`;
3. mejora al baseline al menos `minImprovement`.

### `selectEvolutionCandidate(...)`

Entre candidatos aceptables elige el score más alto. Empates conservan orden determinista.

### `runEvolutionCycle(...)`

Ejecuta un ciclo completo con callbacks inyectados:

```js
await runEvolutionCycle({
  baseline,
  propose,
  evaluate,
  policy: { minImprovement: 0.5 },
  apply,
  rollback
});
```

`apply` nunca se llama antes de que el candidato gane evaluación. Si `apply` lanza error, se intenta `rollback(baseline)` y el resultado lógico vuelve al baseline.

## Adapter Map Forge V1

`map-forge-evolution.mjs` convierte la capacidad genérica en autoajuste real del generador sin cambiar ownership del procedural core.

Parámetros evolvables actuales:

- `monumentality`;
- `organicRoads`;
- `density`;
- `vegetation`;
- `exploration`;
- `decoration`.

El adapter genera mutaciones deterministas con PRNG seeded, no `Math.random()`.

### Evaluación multi-seed

Una variante no se juzga por un solo mapa. `evaluateMapForgeStyle()` ejecuta el mismo perfil sobre un banco determinista de validation seeds y reutiliza `generateBestOf()`.

Métricas V1:

| Métrica | Peso | Regla |
|---|---:|---|
| `meanQuality` | 4.5 | score medio real de Map Forge |
| `worstQuality` | 2.5 | protege contra una seed mala |
| `meanVisual` | 2.0 | composición/landmarks/variedad/espacio/vistas/coherencia |
| `stability` | 1.0 | penaliza dispersión entre seeds |
| `validRate` | 1.5 | hard gate = 100% de runs evaluadas válidas |

El resultado de `evolveMapForgeStyle()` nunca sustituye el baseline por una variante con score inferior. Si ninguna mutación supera la mejora mínima, devuelve el estilo original.

## Flujo Map Forge

```text
recipe.style / style actual
→ baseline evaluado en las mismas validation seeds
→ N mutaciones seeded
→ cada mutación genera best-of-N mapas
→ validator Map Forge elimina mapas inválidos
→ scorer Map Forge calcula quality real
→ KeloEvolution agrega calidad + robustez
→ candidato ganador debe superar minImprovement
→ nuevo baseline para la siguiente generación
→ si no mejora, baseline permanece intacto y el step se reduce
```

Esto es hill-climbing controlado con validación multi-seed, no aprendizaje de pesos neuronales.

## Invariantes

1. Ningún candidato se aplica antes de ser evaluado.
2. Un hard gate fallido invalida el candidato aunque el promedio sea alto.
3. Un candidato que no supera `minImprovement` no reemplaza baseline.
4. Fallo en `apply` intenta rollback explícito.
5. Sin candidato aceptado, `result === baseline` lógicamente.
6. Map Forge conserva determinismo: mismos inputs ⇒ mismas propuestas, evaluaciones y estilo final.
7. Map Forge Evolution no modifica renderer, Property, collision, camera ni publish.
8. El adapter reutiliza `generateBestOf()` y el scorer owner; no crea un segundo quality engine.

## Online-first

`KeloEvolution` no decide autoridad. El contrato separa evaluación de aplicación.

Hoy un caller local puede evaluar parámetros sin persistir nada. Para cambios valiosos/compartidos, el futuro server/CI puede ser quien ejecute o autorice `apply`. El candidato, sus métricas y la decisión de aceptación pueden serializarse sin cambiar el algoritmo de comparación.

Para evolución de código, Git/CI/deploy siguen siendo capas externas. El engine solo puede aceptar un candidato que un agente externo le presente; no obtiene por sí mismo credenciales ni permisos de repositorio.

## Tests / CI

`npm run audit:evolution` prueba:

- scoring ponderado maximize/minimize;
- hard gate real;
- rechazo de regresiones y mejoras demasiado pequeñas;
- selección del mejor candidato;
- rollback tras fallo de apply;
- evolución Map Forge determinista en las recipes registradas;
- garantía de no-regresión del estilo final contra baseline.

`.github/workflows/kelo-evolution-ci.yml` ejecuta syntax check, `audit:evolution` y `audit:docs`.

## Observabilidad

Cada `evolveMapForgeStyle()` devuelve `history[]` con:

- generation;
- baselineScore;
- candidateScore;
- delta;
- candidateCount;
- mutation step;
- mutaciones del candidato ganador;
- aceptación/rechazo.

No existe telemetría persistente en V1.

## Deuda / siguientes extensiones

- Conectar el adapter a una acción explícita de Map Forge UI/Worker para que el autor pueda lanzar evolución desde el editor sin bloquear el main thread.
- Añadir golden seed suites separadas de las validation seeds cuando se quiera promover cambios de recipe por CI.
- Añadir visual judge externo solo como métrica adicional, nunca sustituyendo validación estructural.
- Crear adapter de code-patch candidate únicamente cuando exista sandbox/CI/apply/rollback seguro; no dar acceso directo del browser al repositorio.

## Cómo extender sin duplicar owner

- Nueva métrica genérica: usar `createEvolutionMetricProfile()`.
- Nuevo consumidor: crear un adapter pequeño que produzca candidatos y evaluator; reutilizar `runEvolutionCycle()`.
- Map Forge: extender `map-forge-evolution.mjs`; no duplicar `map-forge-quality.mjs`.
- Código generado por IA: representar patch + metadata como candidato y conectar tests/CI como evaluator externo.
- Nunca crear otro bus, renderer, Map Forge core, scorer o persistence owner para implementar evolución.

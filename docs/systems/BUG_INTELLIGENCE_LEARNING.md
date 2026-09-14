# Kelo World — Bug Intelligence Self-Learning

## Propósito

Extiende Bug Coordination con aprendizaje medible para que el sistema no solo recuerde defectos, sino que use el historial para prevenir regresiones futuras.

```text
BUGS + REPORTS + ATTEMPTS + RESULTADOS
→ ejemplos cronológicos
→ KeloEvolution champion/challenger
→ holdout
→ policy champion acotada
→ hotspots + prevention gaps
→ bug:risk aprendido
→ auditorías preventivas del siguiente cambio
→ nuevos resultados
→ volver a aprender
```

## OWNER

- Motor de evolución, selección, holdout y memoria: **KeloEvolution**.
- Evidencia canónica de defectos: `/bugs`.
- Adapter de aprendizaje: `scripts/bug-learning-autopilot.mjs`.
- Predictor de diff: `scripts/bug-risk.mjs`.
- Runner preventivo: `scripts/bug-prevention.mjs`.
- Contrato de memoria: `bugs/learning/STATE.json`.

No existe un segundo motor de IA/evolución.

## Estado que posee

El adapter solo puede persistir:

`bugs/learning/STATE.json`

Ese estado contiene:

- policy champion de multiplicadores para reglas existentes de `RISK_MAP`;
- memoria de experimentos KeloEvolution;
- métricas search/holdout;
- hotspots históricos de archivos;
- prevention gaps;
- fingerprints/evidence fingerprints;
- safety bounds.

## Estado que NO posee

No posee autoridad para:

- cambiar lifecycle de `BUG-*`;
- declarar causa raíz;
- declarar `PASS`, `VERIFIED` o `CLOSED`;
- modificar source code;
- cambiar gameplay;
- merge/deploy;
- modificar server/Supabase/secrets;
- inventar pruebas de dispositivo.

## Aprendizaje

`bug-learning-autopilot.mjs` convierte evidencia histórica en ejemplos con target de riesgo según:

- severidad;
- resultado de intentos (`PASS/FAIL/PARTIAL/BLOCKED`);
- reincidencias/reportes;
- estado `REOPENED`;
- recencia relativa a la evidencia más nueva.

Los challengers solo ajustan multiplicadores de reglas ya existentes y están limitados a `0.75..1.75`.

Con al menos ocho ejemplos se reserva el bloque cronológico final como holdout. Una policy solo se promociona si mejora search y no pierde en holdout.

Con poca evidencia se pueden aprender hotspots/gaps, pero no promocionar una nueva policy.

## Prevención

`bug-risk.mjs` aplica una policy aprendida únicamente cuando el fingerprint del `RISK_MAP.json` actual coincide con el fingerprint con el que se entrenó el estado.

Además, exact matches contra hotspots pueden añadir un bonus de riesgo aprendido, limitado globalmente y por archivo.

`bug-prevention.mjs` convierte las recomendaciones de reglas/hotspots en dos grupos:

1. **Auditorías automáticas:** solo `npm run audit:*` que existan realmente en `package.json`.
2. **Obligaciones manuales:** iPhone, reload/reopen, smoke visual, etc. Se muestran pero nunca se falsifican como ejecutadas.

El runner nunca ejecuta comandos arbitrarios provenientes de la memoria aprendida.

## Automatización

### Self Learning

`.github/workflows/bug-self-learning.yml`

- corre cada hora;
- corre cuando cambia evidencia relevante;
- audita KeloEvolution + registry + reports antes de aprender;
- no escribe si el evidence fingerprint no cambió;
- refresca `main` antes de persistir para evitar aprender sobre evidencia sabidamente vieja;
- solo commitea `bugs/learning/STATE.json`.

### Prevention

`.github/workflows/bug-prevention.yml`

En cambios de source/build/assets:

1. audita bounds de memoria;
2. calcula riesgo estático + aprendido;
3. ejecuta auditorías preventivas permitidas;
4. calcula blast radius.

## Invariantes

1. KeloEvolution sigue siendo el único owner de champion/challenger/holdout.
2. El learner no escribe source code.
3. El único auto-write es `bugs/learning/STATE.json`.
4. Multiplicadores quedan entre `0.75` y `1.75`.
5. Hotspot bonus por archivo no supera `20`.
6. Policy nueva requiere holdout suficiente.
7. Estado stale no influye en `bug:risk`.
8. Auditorías aprendidas se ejecutan desde allowlist; nunca shell arbitrario.
9. Prueba manual nunca se transforma en PASS automático.
10. Aprender no equivale a arreglar ni cerrar.

## Rollback

La policy aprendida es datos. Rollback consiste en restaurar `bugs/learning/STATE.json` a un champion previo o reiniciar multiplicadores a baseline. `RISK_MAP.json` sigue siendo la base humana/auditada.

Si un nuevo champion empeora la verificación posterior, nueva evidencia entra al loop y KeloEvolution puede seleccionar otra policy; el historial anterior permanece en `memory.entries`.

## Seguridad

- No se persiste texto crudo de logs dentro de learning state.
- Los REPORTs deben pasar `bug-report-audit` antes de aprender.
- No se guardan tokens/cookies/JWT.
- `bug-learning-audit.mjs` bloquea ampliación del auto-write scope y cualquier bandera de auto-close/source-write.

## Tests / auditoría

- `node scripts/bug-learning-audit.mjs --strict`
- `node scripts/bug-learning-autopilot.mjs` para dry-run
- `node scripts/bug-prevention.mjs HEAD~1 HEAD --plan`
- `node scripts/kelo-evolution-audit.mjs`

## Online-first

Es infraestructura de repositorio/CI, no autoridad gameplay. Si la evidencia futura vive en backend, el adapter puede recibir snapshots serializables equivalentes sin cambiar el contrato de KeloEvolution ni poner Git authority en el cliente.

## Deuda conocida

- La calidad del aprendizaje depende de que agentes registren archivos/resultados reales en `attempt_history`.
- Con pocos bugs canónicos el learner depende más de intentos y reportes que de diversidad de defectos.
- No existe aún un judge de dispositivo real automático para iPhone; esas obligaciones siguen manuales cuando BrowserStack/infra no las puede ejecutar.
- Branch protection sigue siendo configuración externa al repo.

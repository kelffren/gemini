# KELO WORLD — Bug Intelligence

Este sistema convierte `/bugs` de un registro reactivo en una defensa progresiva contra regresiones.

## Ciclo

`CAMBIO -> RIESGO -> PRUEBAS DIRIGIDAS -> TELEMETRIA/MILESTONES -> DETECCION -> FINGERPRINT -> BUG/REPORT -> HIPOTESIS -> EXPERIMENTO -> FIX -> VERIFICACION -> REGRESSION TEST`

## Comandos

### Detectar / deduplicar un fallo desde logs

`npm run bug:scan -- path/al/log.txt`

Normaliza ruido variable, crea un fingerprint estable y compara el fallo contra bugs conocidos. Su resultado es una ayuda de triage: nunca crea ni cierra bugs automáticamente.

### Predecir riesgo antes de declarar seguro un cambio

`npm run bug:risk -- <base> <head>`

Combina:
- archivos modificados;
- `bugs/RISK_MAP.json`;
- archivos históricamente asociados a bugs;
- severidad de bugs relacionados.

Niveles: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

HIGH/CRITICAL obliga conceptualmente a ejecutar verificaciones dirigidas antes de afirmar que el cambio es seguro. El score no significa que exista un bug; significa que el coste/probabilidad de regresión merece más evidencia.

### Salud del sistema de bugs

`npm run bug:health`

Muestra estados, severidades, bugs con más intentos fallidos, hotspots históricos de archivos y fixes pendientes de verificación.

### Regresiones permanentes

`npm run audit:bug-regressions`

Un bug `VERIFIED` o `CLOSED` debe dejar evidencia de protección permanente: test/spec/script o un contrato `regression.test` / `regression.command` en el bug.

`FIXED_PENDING_VERIFY` sin protección permanente genera warning para que el test se cree antes del cierre.

## Runtime milestones

`src/core/bug-observability.mjs` permite registrar checkpoints ligeros por flujo sin depender de servicios externos.

Ejemplo conceptual:

```js
const obs=createBugObserver({flow:'world-open',bugId:'BUG-0003',version:'world-x'});
obs.mark('WORLD_TAP');
obs.mark('CONTROLLER_IMPORTED');
obs.mark('SHELL_READY');
obs.mark('TOOLS_READY');
```

Los últimos eventos quedan en `sessionStorage`. Si Safari/WebContent muere sin lanzar una excepción JavaScript, al volver a cargar puede inspeccionarse el último milestone completado y reducir el espacio de búsqueda.

También existe `installBugErrorCapture()` para convertir `window.error` y `unhandledrejection` en eventos del mismo timeline.

## Fingerprints

Un fingerprint identifica una **forma de fallo**, no una causa raíz. Dos errores con timestamps, IDs o números distintos pueden normalizarse al mismo fingerprint. Esto ayuda a detectar reincidencia y duplicados.

No almacenar secretos, cookies, JWT, access keys ni PII dentro de logs/fingerprints.

## Política de eliminación

Un bug serio no está eliminado porque desaparezca una vez.

Para llegar a `VERIFIED/CLOSED` debe existir:
1. reproducción original entendida;
2. fix identificable;
3. verificación independiente en el entorno aplicable;
4. protección de regresión permanente cuando sea automatizable;
5. si no es automatizable, contrato explícito de smoke/manual verification con razón documentada.

## Regla para agentes

Antes de cambios de alto riesgo:

1. `npm run bug:risk -- <base> <head>` cuando exista un diff aplicable;
2. leer briefs de los bugs relacionados;
3. ejecutar los tests sugeridos por el risk report;
4. no declarar seguro un HIGH/CRITICAL basándose solo en lint/unit tests si el fallo histórico era móvil/LIVE.

Después de un fix:

1. registrar el intento;
2. añadir/regenerar el regression test;
3. `npm run audit:bugs`;
4. `npm run audit:bug-regressions`;
5. verificar el flujo original.

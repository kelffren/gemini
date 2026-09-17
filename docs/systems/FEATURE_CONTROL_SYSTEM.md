# Kelo FuseBox — Feature Control & Failure Isolation

## Propósito

`KELO_FUSEBOX` contiene fallos de módulos opcionales para que una feature rota no derribe ni bloquee las demás. Reutiliza la identidad de `KELO_FEATURE_REGISTRY`, el kill switch persistente de `KELO_ASSET_REGISTRY` y la carga lazy de `KELO_MODULE_LOADER`; no crea un catálogo ni loader paralelo.

## Owner

- Global: `KELO_FUSEBOX`
- Fuente: `src/core/feature-control-system.js`
- Estado: Foundation reliability capability, cliente/session-local.

## Fuentes y dependencias

- `KELO_FEATURE_REGISTRY`: IDs, dependencias y archivos.
- `KELO_ASSET_REGISTRY`: interruptor manual persistente.
- `KELO_MODULE_LOADER`: único owner de carga lazy/secuencial.
- `sessionStorage`: solo health/circuit state automático de la sesión.

## Estado que posee

Por feature conocida: `mode` (`CLOSED | OPEN | HALF_OPEN`), `consecutiveFailures`, `totalFailures`, `openedAt`, `retryAt`, `lastFailure` sanitizada, `lastSuccessAt` y `probeInFlight`.

## Estado que NO posee

No posee definiciones de features, scripts/CSS, assets, gameplay, input, movement, render, simulation, PvP authority, economía ni el flag manual persistente.

## API pública

```js
KELO_FUSEBOX.canRun(featureId)
KELO_FUSEBOX.beginAttempt(featureId)
KELO_FUSEBOX.recordSuccess(featureId, detail?)
KELO_FUSEBOX.recordFailure(featureId, error, detail?)
KELO_FUSEBOX.cancelAttempt(featureId, reason?)
KELO_FUSEBOX.run(featureId, asyncOperation, options?)
KELO_FUSEBOX.explain(featureId)
KELO_FUSEBOX.snapshot(featureId)
KELO_FUSEBOX.getState()
KELO_FUSEBOX.resetCircuit(featureId, reason?)
KELO_FUSEBOX.resetAll(reason?)
KELO_FUSEBOX.setEnabled(featureId, boolean)
```

`setEnabled()` delega en `KELO_ASSET_REGISTRY.setEnabled()`; no guarda un segundo flag.

## Flujo

```text
UI / owner
  -> KELO_MODULE_LOADER.ensure(feature)
      -> manual switch (Asset Registry)
      -> FuseBox gate
      -> beginAttempt(feature)
      -> carga secuencial existente
          -> éxito completo: recordSuccess(feature)
          -> fallo del paquete: recordFailure(feature)
              -> threshold: OPEN

OPEN
  -> bloquea solo esa feature
  -> sin polling/watchdog
  -> al vencer cooldown, el siguiente uso obtiene un único HALF_OPEN probe
      -> éxito: CLOSED
      -> fallo: OPEN
```

## Defaults V1

- threshold: 3 fallos consecutivos.
- cooldown: 30 s.
- un solo probe concurrente en `HALF_OPEN`.
- el audit puede usar `__KELO_FUSEBOX_CONFIG__` para tiempos deterministas.

## Dependencias / bulkheads

Cada feature tiene circuito independiente. Un fallo de `world` no incrementa `bag`, `market`, `social`, etc. Las dependencias siguen perteneciendo a `KELO_FEATURE_REGISTRY`; FuseBox no las reinterpreta.

## Kill switch manual

La Biblioteca de Assets continúa siendo la UI/owner del switch manual mediante `KELO_ASSET_REGISTRY`. FuseBox lo expone como `MANUAL_OFF` y nunca lo cuenta como fallo.

## Core protegido

Solo se gestionan IDs conocidos por el registry/allow-list opcional. IDs core o desconocidos quedan `UNMANAGED`, por lo que FuseBox V1 no puede apagar canvas, movimiento, cámara, colisión, avatar base ni el boot mínimo.

## Eventos

- `kelo:fusebox-failure`
- `kelo:fusebox-trip`
- `kelo:fusebox-half-open`
- `kelo:fusebox-success`
- `kelo:fusebox-reset`
- `kelo:fusebox-state-changed`

Son eventos de observabilidad/coordinación; no transfieren ownership de gameplay.

## Integración runtime

`index.html` carga FuseBox después de `feature-registry.js` y `asset-registry.js`, y antes de `module-loader.js`.

El Module Loader adquiere un intento por feature completa. Los fallos de múltiples archivos de un mismo paquete cuentan como un solo fallo de feature; un éxito completo limpia los fallos consecutivos. Si el switch manual cambia durante la carga, el intento se cancela sin convertir esa acción del usuario en error.

## Runtime failures después de cargar

Owners con frontera segura pueden optar por:

```js
await KELO_FUSEBOX.run('market', () => marketOwner.refresh(), {
  operation: 'refresh',
  fallback: null,
  rethrow: false
});
```

No se instala `window.onerror` global para adivinar culpables por filename.

## Autoridad local vs online

El circuit breaker automático es protección local del cliente. El kill switch global futuro puede venir de policy server/control plane manteniendo la misma API de consulta. Ningún consumidor nuevo debe leer `localStorage` directamente para decidir si una feature corre.

## Persistencia

- manual switch: `KELO_ASSET_REGISTRY` (persistencia existente del prototipo).
- circuito automático: `sessionStorage`.
- policy global futura: autoridad server/control plane, sin cambiar la boca pública.

## Invariantes

1. Una feature = un circuito independiente.
2. Ningún fallo de una feature incrementa otra.
3. Manual OFF no es fallo.
4. No hay `setInterval`, polling ni watchdog.
5. `HALF_OPEN` admite un solo probe concurrente.
6. Éxito cierra y limpia fallos consecutivos.
7. Fallo en `HALF_OPEN` reabre inmediatamente.
8. Core/unknown no se apaga accidentalmente.
9. FuseBox no carga/descarga módulos.
10. FuseBox no duplica feature definitions ni flags manuales.

## Extension points

- owners opcionales pueden usar `run()` en operaciones con fallback seguro.
- admin/recovery puede leer `diagnostics()` y pedir `resetCircuit()` mediante el owner admin existente.
- policy server futura puede reemplazar la fuente del kill switch sin rehacer consumidores.

## Anti-patrones

No crear otro registry/loader, no mapear errores globales por heurística, no descargar JS ya ejecutado a ciegas, no usar timers para mantener correctness, no guardar stacks/tokens en session storage y no usar FuseBox para esconder bugs sin arreglarlos.

## Legacy / adapters

`KELO_ASSET_REGISTRY` y los aliases del Feature Registry continúan intactos. El fallback legacy del Module Loader se conserva para compatibilidad de deploy, pero las features nuevas deben registrarse en el owner moderno.

## Tests / CI

- `npm run audit:fusebox`
- `npm run audit:foundation`
- `npm run audit:docs`
- `main-stability-gate`
- smoke móvil Playwright por cambio de boot/runtime.

`feature-control-audit.mjs` valida kill switch, aislamiento, threshold, OPEN, cooldown lazy, HALF_OPEN single probe, recuperación, protección de core, orden de boot e integración con loader/Luxe.

## Observabilidad

`KELO_FUSEBOX.diagnostics()` devuelve snapshot por feature. `KELO_MODULE_LOADER.diagnostics()` incluye FuseBox para soporte/recovery. Mensajes de error persistidos se sanitizan y truncan; no se guardan stacks ni credenciales.

## Deuda

- policy server/global todavía pendiente.
- instrumentación runtime opt-in por owner, no global.
- UI admin de health/reset solo dentro del panel admin existente si se necesita.
- una feature ya cargada no se desmonta automáticamente; bloquear nuevas entradas y suspensión real son contratos separados.

## Ejemplo de reutilización

Una nueva feature opcional se registra en `KELO_FEATURE_REGISTRY`, mantiene su carga en `KELO_MODULE_LOADER` y hereda FuseBox sin crear código de circuit breaker propio. Si tiene una operación runtime crítica, reutiliza `KELO_FUSEBOX.run(featureId, operation)`.

## Checklist de extensión

1. Registrar feature y dependencias en `KELO_FEATURE_REGISTRY`.
2. Mantenerla lazy si aplica.
3. No crear otro flag manual.
4. Definir fallback seguro.
5. Reportar fallos bajo el mismo `featureId`.
6. Añadir `run()` solo en boundaries con ownership claro.
7. Ejecutar `audit:fusebox`, docs/foundation y mobile smoke.

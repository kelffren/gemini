# Kelo FuseBox — Feature Control & Failure Isolation

## Propósito

`KELO_FUSEBOX` contiene fallos de módulos opcionales para que una feature rota no derribe ni bloquee las demás. Combina el interruptor manual ya existente (`KELO_ASSET_REGISTRY`) con un circuit breaker local por feature.

No es un segundo catálogo ni un segundo loader:

- `KELO_FEATURE_REGISTRY` sigue siendo la fuente de verdad de **qué features existen** y sus dependencias.
- `KELO_ASSET_REGISTRY` sigue siendo el owner del **interruptor manual persistente** de paquetes opcionales.
- `KELO_MODULE_LOADER` sigue siendo el único owner de **carga lazy/secuencial**.
- `KELO_FUSEBOX` posee únicamente el **estado operativo de salud/circuito** por feature.

## Owner

- Global: `KELO_FUSEBOX`
- Fuente: `src/core/feature-control-system.js`
- Estado: Foundation reliability capability, cliente/session-local.

## Estado que posee

Por feature conocida:

- `mode`: `CLOSED | OPEN | HALF_OPEN`
- `consecutiveFailures`
- `totalFailures`
- `openedAt`
- `retryAt`
- `lastFailure` sanitizada (código/mensaje; nunca stack/tokens)
- `lastSuccessAt`
- `probeInFlight`

El estado automático se conserva en `sessionStorage` para sobrevivir recargas dentro de la misma sesión, pero no queda pegado indefinidamente entre sesiones.

## Estado que NO posee

FuseBox no posee:

- definiciones/dependencias/files de features;
- carga de scripts/CSS;
- assets;
- gameplay state;
- input/movement/render/simulation;
- autoridad server de PvP/economía;
- selección manual persistente de paquetes.

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

`setEnabled()` no guarda un segundo flag: delega en `KELO_ASSET_REGISTRY.setEnabled()`.

## Flujo

```text
UI / owner
  -> KELO_MODULE_LOADER.ensure(feature)
      -> manual switch (KELO_ASSET_REGISTRY)
      -> KELO_FUSEBOX.canRun(feature)
      -> KELO_FUSEBOX.beginAttempt(feature)
          -> carga secuencial existente
              -> éxito: recordSuccess(feature)
              -> fallo: recordFailure(feature)
                  -> threshold alcanzado: OPEN

OPEN
  -> rechaza solo esa feature
  -> las demás continúan
  -> no hay polling/watchdog
  -> al vencer cooldown, el siguiente intento obtiene un único HALF_OPEN probe
      -> éxito: CLOSED
      -> fallo: OPEN otra vez
```

## Defaults V1

- fallos consecutivos antes de abrir: `3`
- cooldown: `30 s`
- un único probe concurrente en `HALF_OPEN`

El audit puede inyectar `__KELO_FUSEBOX_CONFIG__` antes del boot para reducir estos tiempos en pruebas deterministas. Producción no necesita configuración externa.

## Dependencias y bulkheads

Cada feature tiene su propio circuito. Un `world` roto no incrementa ni abre `social`, `bag`, `market`, etc.

Las dependencias siguen perteneciendo a `KELO_FEATURE_REGISTRY`. Ejemplo: `pvp -> guardian`. Si Guardian no puede cargar, PvP no debe saltarse la dependencia, pero el fallo no apaga módulos ajenos.

## Kill switch manual

La Biblioteca de Assets ya implementa switches persistentes mediante `KELO_ASSET_REGISTRY`. FuseBox los respeta como `MANUAL_OFF`.

Regla:

```text
manual OFF > circuit health
```

Una feature manualmente apagada no inicia una carga ni consume un probe.

## Core protegido

FuseBox solo gestiona IDs conocidos por `KELO_FEATURE_REGISTRY` (o el allow-list existente durante fallback). IDs desconocidos/core se consideran `UNMANAGED` y quedan permitidos.

Por diseño, FuseBox V1 **no puede apagar** movimiento, canvas, cámara, colisión, avatar base ni el boot mínimo de plaza.

## Eventos

- `kelo:fusebox-failure`
- `kelo:fusebox-trip`
- `kelo:fusebox-half-open`
- `kelo:fusebox-success`
- `kelo:fusebox-reset`
- `kelo:fusebox-state-changed`

Los eventos son observabilidad/coordination; no transfieren ownership de gameplay.

## Integración runtime

`index.html` carga el owner después de `KELO_FEATURE_REGISTRY` + `KELO_ASSET_REGISTRY` y antes de `KELO_MODULE_LOADER`.

`KELO_MODULE_LOADER` consulta FuseBox antes de iniciar una feature y reporta el resultado completo de la carga. Los errores individuales de varios archivos dentro de un mismo intento cuentan como **un fallo de feature**, evitando disparar el circuito por el número de archivos del paquete.

## Runtime failures después de cargar

V1 protege inmediatamente el boundary de carga lazy. Para operaciones runtime opt-in, un owner puede usar:

```js
await KELO_FUSEBOX.run('market', () => marketOwner.refresh(), {
  operation: 'refresh',
  fallback: null,
  rethrow: false
});
```

No se instala un `window.onerror` global que intente adivinar qué feature causó un error; esa heurística podría culpar/apagar el módulo equivocado.

## Online-first

El circuit breaker automático es una protección local del cliente y puede seguir siéndolo online.

El kill switch global de producción deberá poder venir de policy server/control plane. Los consumidores no deben leer `localStorage` directamente: consultan FuseBox/Asset Registry. Así la fuente de policy puede sustituirse sin rehacer features ni UI.

## Persistencia

- interruptor manual: owner existente (`KELO_ASSET_REGISTRY`, `localStorage` actual del prototipo);
- circuito automático: `sessionStorage`;
- futuro policy global: server/control plane, manteniendo la misma boca de consulta.

## Invariantes

1. Una feature = un circuito independiente.
2. Ningún fallo de feature incrementa el contador de otra.
3. Manual OFF nunca se interpreta como fallo.
4. No hay `setInterval`, polling ni watchdog.
5. `HALF_OPEN` admite un solo probe concurrente.
6. Un éxito cierra y limpia fallos consecutivos.
7. Un fallo en `HALF_OPEN` reabre inmediatamente.
8. Core/unknown nunca se apaga accidentalmente.
9. FuseBox no carga ni descarga módulos.
10. FuseBox no duplica feature definitions ni manual flags.

## Anti-patrones

No hacer:

- otro `FeatureRegistry` mutable;
- otro loader;
- capturar todos los errores globales y mapearlos por nombre de archivo;
- usar temporizadores para reactivar continuamente módulos;
- descargar/desmontar a ciegas una feature ya ejecutada;
- guardar stack traces/tokens en session storage;
- usar FuseBox para esconder bugs sin registrarlos/arreglarlos.

## Tests / CI

- `npm run audit:fusebox`
- `npm run audit:foundation`
- `npm run audit:docs`
- `main-stability-gate`
- Playwright móvil obligatorio para cambios de boot/runtime antes de declarar el cambio verificado.

`feature-control-audit.mjs` prueba manual OFF, aislamiento entre features, threshold, OPEN, cooldown lazy, HALF_OPEN single probe, recuperación y protección de core.

## Observabilidad

`KELO_FUSEBOX.diagnostics()` devuelve snapshot por feature con modo, fallos, retry, última falla y estado manual compuesto. `KELO_MODULE_LOADER.diagnostics()` debe incluir el snapshot FuseBox para soporte/recovery.

## Deuda / siguientes extensiones

- conectar policy global a autoridad server cuando exista control plane remoto;
- instrumentar owners runtime de alto riesgo con `KELO_FUSEBOX.run()` donde haya frontera clara y fallback seguro;
- añadir UI administrativa de health/reset solo si se integra en el owner admin existente, no como dashboard paralelo;
- decidir por owner si una feature ya cargada soporta `suspend/disable` real; V1 bloquea nuevas entradas/cargas, no desmonta JS arbitrariamente.

## Checklist para añadir una feature protegida

1. Registrar la feature en `KELO_FEATURE_REGISTRY`.
2. Declarar dependencias allí.
3. Mantenerla lazy mediante `KELO_MODULE_LOADER` cuando aplique.
4. No crear otro flag manual.
5. Verificar que fallos de carga reportan al mismo `featureId`.
6. Si hay runtime operation crítica, envolver solo la frontera segura con `run()`.
7. Definir fallback/degradación explícita.
8. Ejecutar `audit:fusebox` + gates aplicables.

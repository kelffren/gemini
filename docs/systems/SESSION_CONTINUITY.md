# Kelo Session Continuity

## Objetivo

`KeloSessionContinuity` hace que una actualización verificada pueda recargar el runtime sin devolver al jugador al spawn. Captura un checkpoint compacto antes de `KeloUpdater.applyUpdate()`, deja que el updater haga su reload/health-check normal y restaura la posición/cámara después del nuevo boot.

## Owner

- Runtime: `src/core/session-continuity-system.js`
- API: `window.KeloSessionContinuity`
- Posición: **no escribe directamente** `localPlayer.x/y`; usa `KeloPlayerPosition.restore()`.
- Cámara: usa `KeloCamera.restoreState()` y `setBaseZoom()`.
- Update: consume `KeloUpdater`; no sustituye ni duplica el updater.

## Contrato de rendimiento

El sistema es event-driven:

- sin `setInterval`;
- sin polling propio;
- sin RAF permanente;
- sin game loop;
- sin escritura por frame;
- `sessionStorage` solo para el checkpoint de update;
- `localStorage` solo en checkpoints escasos (update, transición de posición, app oculta/pagehide).

Esto evita convertir el autosave en trabajo continuo del main thread de Safari/iPhone.

## Flujo de update

1. `KeloUpdater` detecta y prepara una build.
2. Al quedar `stage.status === ready`, Continuity confirma que el juego está visible y no está ocupado.
3. Captura posición y cámara.
4. Muestra `Actualizando Kelo World…`.
5. Llama `KeloUpdater.applyUpdate()`.
6. El updater conserva su `pendingBuild` y health shield normal.
7. En el nuevo boot, Continuity consume el checkpoint de una sola vez.
8. Valida la coordenada contra colisiones.
9. Si la coordenada quedó bloqueada por el nuevo mapa, prueba un pequeño anillo de puntos vecinos.
10. Restaura por las APIs Foundation y elimina el checkpoint de update.

## Seguridad

- No restaura durante combate ni Arena/PvP.
- El checkpoint de update expira a los 10 minutos.
- El `lastSafe` durable expira a las 6 horas y no se auto-restaura en un boot normal; queda disponible mediante `restoreLastSafe()` para recuperación explícita/futura.
- No persiste inventario, economía, propiedad ni progreso valioso del cliente. Esos dominios deben seguir autoridad online/server.
- Si `applyUpdate()` falla, el checkpoint de update se elimina para evitar un restore accidental en un reload no relacionado.

## Diagnóstico

```js
KeloSessionContinuity.getState()
KELO_SESSION_CONTINUITY_AUDIT
```

El audit debe reportar `timers: 0`, `intervals: 0`, `gameLoop: false`, `perFrameWrites: false`.

## Kill switch

Para depurar sin auto-aplicar:

- runtime: `window.KELO_DISABLE_AUTO_APPLY = true`
- URL: `?manualUpdate=1`

La detección/preparación del updater puede seguir funcionando; solo se evita el auto-apply de Continuity.

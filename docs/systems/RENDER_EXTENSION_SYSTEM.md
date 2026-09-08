# KeloRender — extensiones del frame

## Propósito

`KeloRender` es el OWNER único de las extensiones que necesitan ejecutar lógica antes o después del frame orquestado actualmente por `engine-c.js`.

Durante la transición Foundation, `engine-c` sigue dibujando el mundo, actores, capas visuales y joystick. `KeloRender` no reemplaza esa responsabilidad: crea un solo bridge estable para que features históricas dejen de envolver `render` una encima de otra y puedan dormir cuando no tienen nada que presentar.

```text
render legacy de engine-c
        │
        ▼
    KeloRender
    ├─ intercept ENABLED
    ├─ beforeFrame ENABLED
    ├─ render base exacto
    └─ afterFrame ENABLED

hooks SLEEPING permanecen registrados pero salen del hot path.
```

## Owner

**Owner:** `window.KeloRender`  
**Fuente:** `src/core/render-extension-system.js`

## API pública

### `KeloRender.intercept(owner, fn, priority)`

Registra un interceptor exclusivo autorizado. Si devuelve `true`, posee ese frame según el contrato existente.

### `KeloRender.beforeFrame(owner, fn, priority)`

Registra preparación previa al frame.

### `KeloRender.afterFrame(owner, fn, priority)`

Registra overlays o presentación posterior al frame: actores remotos, indicadores o compatibilidad durante migración.

### `KeloRender.setEnabled(hookId, enabled)`

Suspende o despierta un hook sin destruir su registro.

- Idempotente.
- Conserva prioridad e identidad.
- Un hook sleeping no ejecuta su callback.
- Las listas de hooks activos se recalculan solo cuando cambia el registro/lifecycle, no en cada frame.

### `KeloRender.unregister(id)`

Retira definitivamente un hook registrado.

### `KeloRender.snapshot()`

Expone owners, prioridades, `enabled` y totales `registered`, `enabled`, `sleeping` para auditoría y `KELO_PERF`.

## Lifecycle

```text
REGISTERED + ENABLED
        │ setEnabled(false)
        ▼
REGISTERED + SLEEPING
        │ setEnabled(true)
        └──────────────────> ENABLED

unregister → eliminado
```

`KeloRender` posee el scheduling del frame. Cada feature conserva ownership de la decisión “tengo algo que dibujar”.

## Invariantes

- Solo `src/core/render-extension-system.js` puede envolver directamente el `render` final de `engine-c` durante esta fase.
- Un hook de Render no decide gameplay, HP, economía ni autoridad online.
- Features nuevas no deben hacer `const old=render; render=function(){...}`.
- Orden por prioridad es determinista; menor prioridad se ejecuta primero dentro de cada fase.
- El `render` capturado se ejecuta exactamente una vez por llamada.
- Sleep/wake no puede duplicar el callback ni alterar prioridad.

## Performance

El contrato permite que una feature permanezca disponible pero deje de pagar CPU de render cuando no existe presentación activa. `KELO_PERF` consume `snapshot()` para mostrar hooks activos/dormidos.

Tests deterministas: `scripts/performance-foundation-audit.js`.

## Migración legacy

Los wrappers históricos se retiran uno por uno:

`IDENTIFICAR → mover lógica a beforeFrame/afterFrame → contrato → smoke/LIVE → retirar wrapper`.

No se reescribe el renderer completo.

## Online-first

Render es presentación cliente. Eventos o snapshots autoritativos pueden alimentar contenido visual, pero `KeloRender` jamás convierte el cliente en autoridad de estado compartido. Culling o sleep visual no elimina estado autoritativo.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE / SLEEP-WAKE CAPABLE**

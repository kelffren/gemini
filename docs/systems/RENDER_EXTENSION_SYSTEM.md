# KeloRender — extensiones del frame

## Propósito

`KeloRender` es el OWNER único de las extensiones que necesitan ejecutar lógica antes o después del frame orquestado actualmente por `engine-c.js`.

Durante la transición Foundation, `engine-c` sigue dibujando el mundo, actores, capas visuales y joystick. `KeloRender` no reemplaza esa responsabilidad: crea un solo bridge estable para que features históricas dejen de envolver `render` una encima de otra.

```text
render legacy de engine-c
        │
        ▼
    KeloRender
    ├─ beforeFrame hooks
    ├─ render base exacto
    └─ afterFrame hooks
```

## Owner

**Owner:** `window.KeloRender`  
**Fuente:** `src/core/render-extension-system.js`

## API pública

### `KeloRender.beforeFrame(owner, fn, priority)`

Registra preparación previa al frame. Ejemplos válidos: configurar contexto, actualizar contador visual de frame o preparar compatibilidad que deba existir durante el render base.

### `KeloRender.afterFrame(owner, fn, priority)`

Registra overlays o presentación posterior al frame: minimapa, indicadores, UI Canvas, actores remotos legacy durante la migración, etc.

### `KeloRender.unregister(id)`

Retira un hook registrado.

### `KeloRender.snapshot()`

Expone owners y prioridades para auditoría/debug.

## Invariantes

- Solo `src/core/render-extension-system.js` puede envolver directamente el `render` final de `engine-c` durante esta fase.
- Un hook de Render no decide gameplay, HP, economía ni autoridad online.
- Features nuevas no deben hacer `const old=render; render=function(){...}`.
- Orden por prioridad es determinista; menor prioridad se ejecuta primero dentro de cada fase.
- El `render` capturado se ejecuta exactamente una vez por llamada.

## Migración legacy

Los wrappers históricos se retiran uno por uno:

`IDENTIFICAR → mover lógica a beforeFrame/afterFrame → contrato → smoke/LIVE → retirar wrapper`.

No se reescribe el renderer completo.

## Online-first

Render es presentación cliente. Eventos o snapshots autoritativos pueden alimentar contenido visual, pero `KeloRender` jamás convierte el cliente en autoridad de estado compartido.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE**

# Kelo Performance Foundation

## Propósito

Kelo World debe poder crecer en contenido sin convertir todo el contenido disponible en trabajo permanente del cliente. La regla de diseño es:

```text
coste_runtime ≈ visible + activo + cercano + recursos_residentes_necesarios
```

No debe aproximarse a `todo_lo_que_existe_en_el_juego`.

Este documento no crea un nuevo engine. Define cómo los OWNERS existentes cooperan para reducir coste de arranque, CPU, GPU/memoria y red.

## Owners reutilizados

- `KeloSimulation`: scheduler oficial de extensiones de simulación. Sus hooks pueden quedar `enabled=false` sin desregistrarse.
- `KeloRender`: scheduler oficial de extensiones de frame. Sus hooks pueden quedar `enabled=false` sin crear otro loop.
- `KELO_PERF` / `KELO_PERFORMANCE_GOVERNOR`: calidad, telemetría, LOD espacial y lifecycle de visibilidad.
- `KELO_ATLAS_CONTRACT`: adquisición, refcount, warm residency y eviction de imágenes/atlases.
- `KELO_WORLD_RENDERER`: chunks visibles, cache LRU y assets de distrito.
- `KeloNetAuthority`: transporte cliente; no autoridad gameplay.
- Kelo plaza room server: autoridad de red y relevancia AOI.
- Cada feature conserva su owner. Performance no puede convertirse en un manager paralelo que posea gameplay ajeno.

## Estados de lifecycle

Una capacidad puede recorrer conceptualmente:

```text
UNLOADED -> LOADED -> ACTIVE -> SLEEPING -> ACTIVE
                         |          |
                         |          +-> external resources may be released
                         +-> presentation/resources only while needed
```

En JavaScript dinámico, el código importado/cargado normalmente permanece cacheado en el realm. Por eso `UNLOADED` después del primer uso significa principalmente liberar recursos externos, listeners, observers, timers, DOM y suscripciones; no fingir que el motor puede descargar arbitrariamente el módulo JS.

## Contratos

### Startup

Features opcionales no pertenecen al critical path. Character Customizer y Studio deben cargar su código pesado solo después de una acción explícita del jugador. Profile no puede arrancar combat/effects/melee como efecto lateral.

### CPU

Un feature sin trabajo no debe ejecutar lógica significativa cada frame. `KeloSimulation.setEnabled()` y `KeloRender.setEnabled()` son los puntos oficiales para sleep/wake de hooks registrados. No se crean `requestAnimationFrame`, `setInterval` o wrappers paralelos para solucionar scheduling.

### GPU y memoria

`KELO_ATLAS_CONTRACT` es la única frontera para lifecycle de atlases gestionados. `core` permanece retenido; `district` y `optional` pueden quedar warm un intervalo corto y luego evictarse si su refcount sigue en cero.

### Mundo

`KELO_WORLD_RENDERER` solo construye/dibuja chunks dentro del viewport de `KeloCamera` más margen. La cache es LRU y limitada por `KELO_MOBILE_PERFORMANCE_CONTRACT`. Recursos de distrito, como Gardens, solo se adquieren cuando el viewport expandido los necesita.

### Actores remotos

El cliente reutiliza `KELO_PERF.shouldUpdate()` y `KELO_PERF.shouldRenderActor()` para reducir interpolación y draw de peers lejanos. Esto es presentación cliente, nunca autoridad gameplay.

### Red

La pose local se envía por cambio, con frecuencia máxima y heartbeat idle. El servidor conserva autoridad de todos los players, pero cada conexión recibe solamente representaciones dentro de su zone + AOI espacial con hysteresis. Salir del AOI de un cliente no elimina al actor del estado autoritativo del servidor.

### Página oculta

`KELO_PERFORMANCE_GOVERNOR` emite lifecycle semántico cuando `document.hidden` cambia. Presentación no esencial puede dormir al ocultarse. La corrección gameplay/autoridad no puede depender de que el navegador continúe ejecutando RAF en background.

## Invariantes CI

El audit de Performance Foundation debe fallar si reaparece cualquiera de estas regresiones:

- Character Customizer vuelve a cargarse eager desde Profile.
- Profile vuelve a arrancar `kelo-runtime-bootstrap.js`.
- KeloSimulation/KeloRender pierden `setEnabled`.
- Visual System pierde su fast-path/sleep de trabajo vacío.
- Gardens vuelve a adquirirse incondicionalmente al boot del WorldRenderer.
- La cache de chunks deja de ser LRU limitada.
- Engine Net deja de usar el LOD espacial existente o vuelve a enviar poses idénticas continuamente.
- El servidor vuelve a enviar el estado completo de la room a cada cliente sin zone/AOI.

## Métricas

Antes y después de cambios grandes se registran, cuando el entorno lo permita:

- requests y bytes antes de PLAYER READY;
- tiempo hasta PLAYER READY;
- frame p50/p95/p99 y long frames;
- hooks activos/dormidos de KeloSimulation/KeloRender;
- decoded/resident texture budget;
- cache de chunks, hits y evictions;
- peers actualizados/dibujados vs culled;
- poses enviadas vs omitidas por no cambiar;
- snapshots/eventos de red relevantes por cliente.

## Regla de extensión

Antes de crear cualquier `PerformanceManager`, scheduler, asset loader, network culler o feature loader nuevo, localizar el OWNER existente. Si la capacidad cabe naturalmente en ese owner, se extiende allí. Un nuevo owner requiere demostrar que ninguna responsabilidad actual lo posee.

## Estado

**FOUNDATION ACTIVE — PERFORMANCE CONTRACT V1**

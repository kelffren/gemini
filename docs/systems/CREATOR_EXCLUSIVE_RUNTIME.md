<!-- KELO-SYSTEM-DOC
system-id: creator-exclusive-runtime
owner: Kelo Creators + Foundation owners
source: src/creators/core/creator-exclusive-runtime.mjs
contract-version: 1
-->

# Kelo Creator Exclusive Runtime — lifecycle de creators pesados

## Propósito

`creator-exclusive-runtime.mjs` permite abrir un editor Creator pesado sin crear un segundo engine ni dejar gameplay, input, render y assets compitiendo por los mismos recursos. Coordina claims efímeros sobre owners Foundation existentes y los libera al terminar.

No posee gameplay. No implementa otro scheduler. No sustituye `KeloSimulation`, `KeloRender`, `KeloMovement`, `KeloInputLocks` ni `KELO_ATLAS_CONTRACT`.

```text
Creator pesado abre
  → claim creator-exclusive
  → KeloInputLocks.acquire()
  → KeloMovement.intercept()
  → KeloRender.intercept()
  → KeloSimulation.suspend()
  → evict atlases no-core sin refs
  → authoring
  → cierre
  → unregister/resume/release
  → avatar/juego vuelve a responder
```

## Owner

- **Owner de lifecycle:** `Kelo Creators + Foundation owners`
- **Fuente:** `src/creators/core/creator-exclusive-runtime.mjs`
- **Estado:** Creator Foundation active.

Cada Foundation owner conserva autoridad sobre su propia responsabilidad. Creator Exclusive solo coordina tokens/claims.

## Estado que posee

Efímero y diagnóstico:

- claims Creator activos por token;
- owner/meta de cada claim;
- tokens/hook IDs adquiridos a Foundation;
- contador de transiciones;
- contador de atlases fríos expulsados.

No posee player state, física, autoridad online, economía, assets SOURCE, drafts ni publicación.

## API pública

- `enterCreatorExclusiveMode({root, owner, meta})` → token.
- `leaveCreatorExclusiveMode(token, {root})` → boolean.
- `releaseCreatorExclusiveOwner(owner, {root})` → número de claims liberados.
- `getCreatorExclusiveSnapshot()` → estado diagnóstico inmutable.

## Lifecycle

El primer claim instala la hibernación. Claims adicionales comparten el mismo estado Foundation y no duplican locks/hooks. Solo cuando desaparece el último claim se desmonta la hibernación.

El cierre libera, en orden seguro:

1. intercept de movement;
2. intercept de render;
3. suspension token de simulation;
4. input lock;
5. atributo DOM diagnóstico;
6. referencia al root.

## Gestión de atlases

Al entrar puede expulsar únicamente atlases cuyo role no sea `core` y cuyo refcount sea cero. No modifica SOURCE, catálogos ni revisiones; solo reduce residencia runtime antes de levantar un editor pesado.

## Eventos

Emite mediante `KeloEvents` y evento DOM equivalente cuando están disponibles:

- `CREATOR_EXCLUSIVE_ENTER`
- `CREATOR_EXCLUSIVE_CHANGED`
- `CREATOR_EXCLUSIVE_LEAVE`

Los eventos son observabilidad/lifecycle; no son autoridad gameplay.

## Invariantes

1. Un solo mecanismo Creator-exclusive; no segundo game loop.
2. No se detiene `engine-b` mediante monkey patch.
3. No se escriben globals gameplay para “pausar”.
4. Cada claim tiene token y release explícito.
5. El primer claim adquiere Foundation resources; el último release los devuelve.
6. Atlas core nunca se expulsa por este lifecycle.
7. Atlas con refs activas no se expulsa.
8. Abrir/cerrar Creator no cambia verdad de servidor.
9. Cleanup defensivo por owner no sustituye conservar los tokens propios.
10. El sistema no crea timers/watchdogs de vigilancia.

## Consumidores

Pixelorama Pro es el consumidor pesado de referencia. Otros workspaces pueden usar el mismo lifecycle solo cuando de verdad necesiten exclusividad; un Creator ligero no debe suspender el juego por defecto.

## QA mínimo

Para un Creator exclusivo móvil:

1. abrir el workspace/editor;
2. confirmar que llega a READY;
3. realizar una edición real;
4. cerrar;
5. verificar `getCreatorExclusiveSnapshot().active === false`;
6. verificar ausencia de locks/claims huérfanos;
7. caminar al menos 8 s sin freeze/crash/black screen;
8. reabrir y repetir;
9. para Safari/iPhone, validar en dispositivo real antes de marcar VERIFIED.

## Anti-patrones

- otro scheduler o `requestAnimationFrame` Creator;
- `setInterval` para mantener el juego “despierto”;
- forzar unlock de movimiento sin respetar tokens;
- destruir atlases core o con referencias;
- considerar un close visual suficiente si quedan claims;
- convertir Creator Exclusive en pausa autoritativa online.

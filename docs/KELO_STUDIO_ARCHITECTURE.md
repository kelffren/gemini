# Kelo Studio — Architecture

**Actualizado:** 2026-09-29

## Propósito

Kelo Studio es la superficie creator del juego. Edita el mismo mundo/runtime mediante contratos existentes; no es un segundo juego ni un segundo engine.

## Boot

`studio-launcher.js → world-workspace.mjs → world-studio-bridge.mjs → live-studio-controller.mjs → studio-entry.mjs`

En móvil/iPhone, World pinta chrome primero y precarga módulos de manera escalonada, cediendo control entre imports para reducir picos de memoria/CPU.
Si el jugador toca World antes del streamer posterior al boot, `world-workspace.mjs` asegura el `KeloModuleLoader` existente y su feature `properties` antes de abrir Studio. `KELO_WORLD_EDIT` proyecta el snapshot al volver al borrador; la lectura adyacente de `world:draft:current` no puede sustituir `world:draft:get` sin ese snapshot.

## Core

- `studio-kernel.mjs` — document + commands + undo/redo.
- `world-document.mjs` — representación del draft.
- `world-compiler.mjs` — compilación.
- `kelo-runtime-adapter.mjs` — bridge con owners runtime.
- `current-world-importer.mjs` — importar mundo actual.
- tools — select, placement, transform, terrain, collision, prefab, etc.

## UI

- `studio-live-shell.mjs` — chrome responsive.
- `studio-asset-palette.mjs` — browser compacto, búsqueda, recientes y categorías.
- `creator-productivity-panel.mjs` — copy/paste, prefab, grid/snap, camera/zoom, map check.

UI nunca posee persistencia/mutation final.

## Forest Plaza folders

Las 146 piezas semánticas se presentan mediante categorías de catálogo. La palette prioriza las 7 carpetas Forest Plaza:

- ✦ Plaza
- ▦ Arquitectura
- ✿ Jardines
- ≋ Agua
- ⌁ Caminos
- ▣ Mercado
- ♧ Bosque

La carpeta filtra templates reales; no duplica assets.

## Asset selection

`Property Catalog → palette row → preview → placement tool → Studio command → draft/world authority`

Los previews usan Asset Preview Service + Atlas Contract.
La limpieza del minimapa heredado excluye `[data-kelo-studio-ui]`; de lo contrario elimina los canvas de miniatura de la biblioteca móvil.

## Mobile UX

- target táctil grande;
- asset sheet/palette compacta;
- seleccionar asset minimiza chrome y conserva asset activo;
- EDIT reabre assets sin borrar selección;
- safe-area respetada;
- blur/backdrop desactivable en coarse/mobile para proteger Safari.
- el dock ApprovalRequest de World arranca plegado en móvil, accesible con el botón Aprobación para no tapar las tarjetas de Assets.

## QA mínimo de World

1. abrir Create → World;
2. shell visible e interactivo;
3. abrir Assets;
4. elegir una pieza Forest Plaza;
5. colocarla;
6. seleccionarla/moverla/rotarla;
7. undo/redo;
8. guardar, salir/reabrir y confirmar el placement en el borrador;
9. caminar ocho segundos con el joystick tras cerrar World;
10. no black tab, freeze ni pérdida de input.

Headless sirve como señal, no como verificación final de iPhone.

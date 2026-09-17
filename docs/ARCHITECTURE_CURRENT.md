# Kelo World — Architecture Current

**Actualizado:** 2026-09-17 · Runtime V6.69

## Capas

### 1. Boot / Account
`index.html` → Supabase/Auth UI → Guest bypass → engine boot diferido.

El first-playable path termina antes del reliability owner opcional. Después de `kelo:boot-ready`, quedan residentes los owners ligeros:

`KELO_FEATURE_REGISTRY → KELO_ASSET_REGISTRY → KELO_MODULE_LOADER`.

`KELO_FUSEBOX` permanece sin descargar hasta el primer `KELO_MODULE_LOADER.ensure(feature)`. El mismo Module Loader lo carga antes de la primera feature opcional; no existe un segundo loader ni un request adicional durante first-playable.

Cada pieza tiene un owner distinto: definición/dependencias, allow-list manual, health/circuit breaker y carga lazy respectivamente.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, camera, avatar composition, render/simulation extension, update system y reliability de features opcionales. `KeloSimulation` incluye suspensión por claims para lifecycle explícito; la feature consumidora no envuelve el loop legacy.

`KELO_FUSEBOX` no ejecuta features ni crea otro scheduler. Mantiene solamente health/circuit state de módulos opcionales conocidos y nace bajo demanda. Core/unknown permanece fuera de su dominio para que una clasificación defectuosa no pueda apagar movimiento, cámara, canvas o colisión.

El fallback histórico de `KELO_MODULE_LOADER` se conserva en `src/core/module-loader-legacy-fallback.js`; solo se descarga si falta `KELO_FEATURE_REGISTRY`, de modo que la compatibilidad legacy no pesa en el runtime moderno.

### 3. Legacy Core
`engine-a.js` y `engine-c.js` todavía contienen estado/física/render base. Los demás `engine-*.js` son módulos históricos/feature support. No deben recibir nuevas responsabilidades si existe owner moderno.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

La Biblioteca de Assets conserva el kill switch manual de paquetes mediante `KELO_ASSET_REGISTRY`; FuseBox lo consulta cuando existe, pero no duplica ese estado.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, Asset Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

Los Creators pesados pueden entrar en `creator-exclusive-runtime`: adquieren input lock, interceptan movement/render mediante sus owners, suspenden simulation por claim y pueden expulsar atlases no-core sin referencias. No aparece un segundo game loop.

Pixelorama Pro sigue esta frontera: el shell local `tools/pixelorama/index.html` levanta un runtime Godot/WebAssembly aislado sólo bajo demanda. Al salir se solicita quit/unload y se destruye el iframe. Los drafts `.pxo` se persisten en IndexedDB con historial acotado.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo. Los source projects Creator locales no son autoridad de publicación ni economía.

El circuit breaker de FuseBox puede permanecer cliente-local. Un kill switch global futuro puede venir de policy server/control plane reemplazando la fuente de policy sin cambiar los consumidores ni duplicar flags por feature.

## Flujo de asset moderno

`PNG/JPEG/WebP → foreground analysis → asset sheet compiler → sourceRects irregulares → manifest → atlas → semantic catalog → Studio palette → placement`

Para authoring avanzado:

`Asset Forge → Pixelorama Pro (lazy) → PNG/spritesheet/PXO → Asset Forge QA/contract → compiler/package`

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- simulation pause vía `KeloSimulation` claims, nunca wrapper externo;
- definición/dependencias de módulos opcionales vía `KELO_FEATURE_REGISTRY`;
- allow-list manual vía `KELO_ASSET_REGISTRY`;
- health/circuit breaker opcional vía `KELO_FUSEBOX`, cargado bajo demanda por el Module Loader;
- carga lazy opcional vía `KELO_MODULE_LOADER`;
- templates vía `KELO_PROPERTY_CATALOG`;
- World changes vía Studio/`KELO_WORLD_EDIT`;
- assets importados no inventan un renderer;
- UI/Creator no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online;
- un editor WebAssembly pesado debe ser lazy, aislado y destruible.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Evitar canvas/blur/import masivo simultáneo en iPhone. Para un editor pesado, gameplay debe entrar en modo Creator exclusivo y no competir activamente por render/simulation.

La verificación final móvil sigue siendo dispositivo real/LIVE para features que lo requieren. El Main Stability Gate mantiene además el firewall obligatorio de boot + caminata sostenida de 8 s en contexto iPhone-sized, sin freeze/crash/black screen. El Observed Boot Transfer Ratchet impide que reliability/compatibility opcional aumente requests o bytes estables del first-playable.

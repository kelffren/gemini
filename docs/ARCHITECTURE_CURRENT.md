# Kelo World — Architecture Current

**Actualizado:** 2026-09-15 · Runtime V6.54.2

## Capas

### 1. Boot / Account
`index.html` → Supabase/Auth UI → Guest bypass → engine boot diferido.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, camera, avatar composition, render/simulation extension y update system. `KeloSimulation` incluye suspensión por claims para lifecycle explícito; la feature consumidora no envuelve el loop legacy.

### 3. Legacy Core
`engine-a.js` y `engine-c.js` todavía contienen estado/física/render base. Los demás `engine-*.js` son módulos históricos/feature support. No deben recibir nuevas responsabilidades si existe owner moderno.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, Asset Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

Los Creators pesados pueden entrar en `creator-exclusive-runtime`: adquieren input lock, interceptan movement/render mediante sus owners, suspenden simulation por claim y pueden expulsar atlases no-core sin referencias. No aparece un segundo game loop.

Pixelorama Pro sigue esta frontera: el shell local `tools/pixelorama/index.html` levanta un runtime Godot/WebAssembly aislado sólo bajo demanda. Al salir se solicita quit/unload y se destruye el iframe. Los drafts `.pxo` se persisten en IndexedDB con historial acotado.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo. Los source projects Creator locales no son autoridad de publicación ni economía.

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
- templates vía `KELO_PROPERTY_CATALOG`;
- World changes vía Studio/`KELO_WORLD_EDIT`;
- assets importados no inventan un renderer;
- UI/Creator no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online;
- un editor WebAssembly pesado debe ser lazy, aislado y destruible.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Evitar canvas/blur/import masivo simultáneo en iPhone. Para un editor pesado, gameplay debe entrar en modo Creator exclusivo y no competir activamente por render/simulation.

La verificación final móvil sigue siendo dispositivo real/LIVE: Pixelorama debe abrir, editar/cerrar y después el avatar debe caminar al menos 8 s sin freeze/crash/black screen antes de marcar VERIFIED.

## Evergreen runtime compatibility

Kelo World separa compatibilidad de plataforma de lógica de producto. La disponibilidad de capacidades se decide por **feature detection**, no por nombre/versión de navegador ni por `navigator.userAgent`.

Owners:

- `src/core/evergreen-runtime-capabilities.mjs`: detecta capacidades core/online/enhancement y produce un plan explícito de compatibilidad/fallback.
- `src/core/evergreen-provider-adapters.mjs`: define puertos estables y selección priorizada de adapters para storage, auth, realtime, asset compute y telemetry.
- `config/evergreen-runtime-policy.json`: política canónica de runtime; Node 24 es producción bloqueante y Node 26 es lane adelantado no bloqueante.
- `.github/workflows/evergreen-runtime-compat.yml`: audit determinista, WebKit con perfil móvil iOS y future-runtime advisory.

Reglas:

- si falta una API **core**, el entorno se clasifica unsupported;
- si falta transporte online, el cliente puede entrar en modo degradado sin convertir el fallback local en autoridad permanente;
- toda API opcional debe declarar fallback o degradación explícita;
- un proveedor externo se consume detrás de un port/adapter estable, nunca como dependencia arquitectónica directa del dominio;
- WebKit emulado sirve como gate temprano; BrowserStack Safari/iPhone real sigue siendo evidencia de dispositivo para flujos móviles visibles.

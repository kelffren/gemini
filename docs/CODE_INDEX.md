# Kelo World — Code Index

**Actualizado:** 2026-09-16

## Runtime

- `index.html` — orden LIVE, auth-first y engine boot.
- `engine-a.js` — legacy state/movement physics core.
- `engine-c.js` — legacy render/simulation orchestration.
- `engine-net.js` — transporte multiplayer único; `avatarManifest` funciona como presentation envelope server-authoritative dentro del AOI.
- `server/index.js` — autoridad WebSocket/AOI; serializa presentation state ya resuelto por servidor.
- `server/avatar-sync-store.js` — resuelve full-body Creator avatar + modular Creator appearance publicados usando la identidad autenticada del dueño; sanea el envelope antes de replicarlo.

## Foundation Core

- `src/core/events/event-bus.js` — `KeloEvents`.
- `src/core/input-lock-system.js` — `KeloInputLocks`.
- `src/core/input-system.js` — `KeloInput`.
- `src/core/movement-system.js` — `KeloMovement`.
- `src/core/camera-system.js` — `KeloCamera`.
- `src/core/avatar-render-system.js` — `KeloAvatar`.
- `src/core/render-extension-system.js` — `KeloRender`.
- `src/core/simulation-extension-system.js` — `KeloSimulation`.
- `src/core/update-system.js` — `KeloUpdater`.
- `src/core/creators-lazy-gate.js` — entrada lazy Creator; probe metadata-only del loadout local, y tras equip/clear reutiliza `KeloNetAuthority.refreshAvatar()` para refrescar el presentation envelope existente sin segundo socket.
- `src/core/feature-registry.js` — catálogo first-use; Appearance declara slot schema, visual presets/stack, adapter y Creator Character Bridge.

## World / Environment

- `src/environment/world-map.js` — definición principal.
- `src/environment/terrain-contract.js` — terrain.
- `src/environment/tile-registry.js` — tile/atlas registry.
- `src/environment/atlas-contract.js` — atlas authority.
- `src/environment/environment-layer-stack.js` — draw phases.
- `src/environment/surface-ground.js` — suelo.
- `src/environment/prop-contract.js` — props data-driven.
- `src/environment/prefab-contract.js` — prefab rendering contract.
- `src/environment/world-builder-system.js` — builder integration.
- `src/environment/generated/forest-plaza-tileset-v2-manifest.js` — manifest irregular Forest Plaza.

## Forest Plaza / Assets

- `assets/world/plaza/forest-plaza-tileset-v2.png` — atlas fuente LIVE.
- `src/property/forest-plaza-asset-catalog.js` — 146 templates, nombres/categorías.
- `src/property/property-asset-catalog.js` — catálogo general.
- `src/property/creator-property-entitlement-guard.mjs` — impide reutilizar templates Creator cacheados tras cambio/revocación de acceso.
- `src/property/property-system.js` — owner de parcelas/placements; `useGuard()` permite precondiciones Creator sin reemplazar domain authority.
- `src/creators/assets/asset-sheet-compiler.mjs` — compiler heterogéneo.
- `src/creators/sprite-compiler/sprite-foreground-analysis.mjs` — foreground/components.
- `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs` — perfil world asset.

## Studio / Creator

- `src/creators/creator-entry.mjs` — composition root lazy de workspaces y servicios compartidos Creator.
- `src/creators/library/creator-content-types.mjs` — Creator Library: tipos universales y routing a owners/workspaces existentes.
- `src/creators/ui/creator-library-workspace.mjs` — biblioteca móvil CREATE / MY LIBRARY / MARKET / TOOLS / PIPELINE.
- `src/creators/workspaces/creator-library-workspace.mjs` — manifest lazy de Creator Library.
- `src/creators/workspaces/image-lab-workspace.mjs` — integra Image Lab al registry Creator.
- `src/creators/ui/image-lab-workspace.mjs` — preparación de fuentes no destructiva.
- `src/creators/ui/asset-forge-workspace.mjs` — pixel drawing + QA/repair + authoring local.
- `src/creators/ui/content-studio-workspace.mjs` — ingest universal + runtime preview + Release Center móvil.
- `src/creators/release/creator-release-service.mjs` — frontera de release server-side.
- `src/creators/marketplace/creator-marketplace-service.mjs` — marketplace; compra confirmada refresca entitlement guard.
- `src/creators/ui/creator-marketplace-surface.mjs` — DISCOVER / MY LISTINGS / OWNED / CREATOR PROFILE.
- `src/creators/content/creator-content-delivery.mjs` — Delivery exact-revision/on-demand.
- `src/creators/content/creator-use-authority.mjs` — persistencia autoritativa de avatar, visual appearance/equipment, mount y preflight property.
- `src/characters/creator-character-state-bridge.js` — overlay efímero local + overlays remotos WeakMap; ambos reutilizan `KeloCharacterCustomization`/`KeloCharacterVisualStack`/`KeloAvatar`, con IDs visuales revision-scoped separados local/remote.
- `src/characters/creator-avatar-runtime.mjs` — full-body Creator avatars; además detecta `creatorAppearance` remoto y despierta Appearance bajo demanda, sin crear otro renderer.
- `src/creators/content/supabase-content-repository.mjs` — transporte autenticado/RLS/RPC Creator.
- `src/creators/content/universal-content-service.mjs` — ingest semántico.
- `src/creators/content/runtime-content-registry.mjs` — registry semántico entitlement-aware.
- `src/systems/creator-entitlement-system.js` — `KeloCreatorEntitlements`: acceso exact-revision, sin ownership local persistido.
- `src/appearance/appearance-system.js` — registry/resolver shared; no gameplay stats.
- `src/mounts/mount-catalog.js` — catálogo mount con defensa Creator.
- `src/mounts/mount-system.js` — owner mount + guards componibles.
- `supabase/migrations/20260916002500_creator_marketplace_v1.sql` — marketplace/KC/entitlements.
- `supabase/migrations/20260916002600_creator_marketplace_discover_v2.sql` — Discover metadata-first.
- `supabase/migrations/20260916003000_creator_entitlement_access.sql` — acceso exact-revision canónico.
- `supabase/migrations/20260916003500_creator_content_delivery_v1.sql` — delivery manifest + Creator avatar selection.
- `supabase/migrations/20260916004000_creator_use_authority_v1.sql` — bindings server-authoritative Creator.
- `supabase/migrations/20260916004500_creator_modular_replication_v1.sql` — snapshot presentation-only de appearance/equipment actual, publicado y todavía autorizado.
- `scripts/creator-content-delivery-audit.mjs` — audit Delivery.
- `scripts/creator-use-authority-audit.mjs` — audit use authority.
- `scripts/creator-character-state-bridge-audit.mjs` — audit local Character bridge.
- `scripts/creator-modular-replication-audit.mjs` — audit del envelope remoto, publicación/entitlement, AOI reutilizado, WeakMap overlays y ausencia de segundo transporte/renderer.
- `src/ui/studio-launcher.js` — launcher Creator Hub/Studio.
- `src/creators/workspaces/world-workspace.mjs` — route/prewarm móvil.
- `src/studio/integration/world-studio-bridge.mjs` — bridge de carga.
- `src/studio/integration/live-studio-controller.mjs` — sesión LIVE.
- `src/studio/studio-entry.mjs` — composición Studio.
- `src/studio/core/studio-kernel.mjs` — document/commands.
- `src/studio/ui/studio-live-shell.mjs` — shell.
- `src/studio/ui/studio-asset-palette.mjs` — búsqueda/categorías/carpetas.
- `src/world/map-forge/` — generación/composición Map Forge.

## Gameplay

- `src/characters/character-customization.js` — owner del estado visual base, catálogo, historial, saves y middleware de capas; Creator bridge modifica solo la lectura `stateForActor()` con overlays efímeros.
- `src/characters/character-visual-stack.js` — resolver ordenado compartido por actor local/remoto.
- `src/abilities/` — abilities/Stone/equipment channels.
- `src/systems/pvp-world.js` — PvP world.
- `src/systems/arena-*` — Arena.
- `src/systems/equipment-system.js` — gameplay equipment/stats owner; Creator visual `equipment` no lo reemplaza.
- `src/mounts/` — monturas.
- `src/systems/backpack-system.js` — mochila.
- `src/systems/container-system.js` — contenedores.
- `src/systems/title-system.js` + `player-stats.js` — títulos/stats.
- `src/systems/nobility.js` — nobleza.
- `src/systems/commerce-authority.js` — commerce.
- `src/systems/regional-economy-system.js` — economía regional.
- `src/systems/caravan-system.js` — caravanas.
- `src/property/property-system.js` — placements/property; Creator use authorization es preflight.
- `src/instances/` — instancias.

## Admin / Reliability

- `src/systems/admin-key-system.js`
- `src/systems/guardian-system.js`
- `src/systems/game-tuning-system.js`
- `src/bug-reporting/`
- `bugs/` — registry/evidence canónico.

## Documentación

Empieza por `docs/DOCUMENTATION_INDEX.md`. Para trabajo Creator actual lee también `docs/implementation-passes/IMP-2026-09-16-CREATOR-MODULAR-REPLICATION-008.md` y el documento de sistema asociado. Los documentos `*_MEMORY.md` son contexto acumulado, no autoridad superior al runtime.

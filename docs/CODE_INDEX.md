# Kelo World — Code Index

**Actualizado:** 2026-09-15

## Runtime

- `index.html` — orden LIVE, auth-first y engine boot.
- `engine-a.js` — legacy state/movement physics core.
- `engine-c.js` — legacy render/simulation orchestration.
- `engine-net.js` — networking runtime.

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
- `src/core/creators-lazy-gate.js` — entrada lazy a Creator Library/Creators; no carga editores pesados en boot normal.

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
- `src/creators/assets/asset-sheet-compiler.mjs` — compiler heterogéneo.
- `src/creators/sprite-compiler/sprite-foreground-analysis.mjs` — foreground/components.
- `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs` — perfil world asset.

## Studio / Creator

- `src/creators/creator-entry.mjs` — composition root lazy de workspaces y servicios compartidos Creator; enlaza provider de entitlement al repository autenticado actual.
- `src/creators/library/creator-content-types.mjs` — Creator Library: tipos universales y routing a owners/workspaces existentes.
- `src/creators/ui/creator-library-workspace.mjs` — biblioteca móvil CREATE / MY LIBRARY / MARKET / TOOLS / PIPELINE; MARKET se importa lazy.
- `src/creators/workspaces/creator-library-workspace.mjs` — manifest lazy de Creator Library.
- `src/creators/workspaces/image-lab-workspace.mjs` — manifest que integra Image Lab al registry Creator.
- `src/creators/ui/image-lab-workspace.mjs` — preparación de fuentes tipo Photoshop ligero/no destructivo.
- `src/creators/ui/asset-forge-workspace.mjs` — pixel drawing + QA/repair + asset authoring local.
- `src/creators/ui/content-studio-workspace.mjs` — ingest universal + runtime preview + Release Center móvil.
- `src/creators/release/creator-release-service.mjs` — frontera de release: lee review/publicación server-side y solo permite submit/resubmit a review.
- `src/creators/marketplace/creator-marketplace-service.mjs` — composición client-side del marketplace; una compra confirmada refresca el entitlement guard.
- `src/creators/ui/creator-marketplace-surface.mjs` — UI móvil lazy: DISCOVER / MY LISTINGS / OWNED / CREATOR PROFILE.
- `src/creators/content/supabase-content-repository.mjs` — transporte autenticado/RLS/RPC para contenido, release, marketplace y access checks; no posee publish/wallet authority.
- `src/creators/content/universal-content-service.mjs` — ingest semántico; estampa `revisionId`/`ownerUserId` en records runtime Creator.
- `src/creators/content/runtime-content-registry.mjs` — registry semántico; bloquea records Creator sin entitlement antes de adaptarlos a owners runtime y expone `getForUse()`.
- `src/systems/creator-entitlement-system.js` — `KeloCreatorEntitlements`: cache/gate de acceso por revisión; no persiste ownership local ni crea auth client.
- `src/appearance/appearance-system.js` — defensa secundaria: omite layers Creator sin entitlement.
- `src/mounts/mount-catalog.js` — defensa secundaria: oculta monturas Creator no autorizadas de APIs de uso.
- `supabase/migrations/20260916002500_creator_marketplace_v1.sql` — listings, transacciones KC, entitlements y Creator profile authority.
- `supabase/migrations/20260916002600_creator_marketplace_discover_v2.sql` — Discover metadata-first/privacy-aware con flags relativos de ownership.
- `supabase/migrations/20260916003000_creator_entitlement_access.sql` — RPCs canónicos de acceso exact-revision (`creator owner` o entitlement).
- `src/ui/studio-launcher.js` — launcher del Creator Hub/Studio avanzado.
- `src/creators/workspaces/world-workspace.mjs` — route/prewarm móvil.
- `src/studio/integration/world-studio-bridge.mjs` — bridge de carga.
- `src/studio/integration/live-studio-controller.mjs` — sesión LIVE.
- `src/studio/studio-entry.mjs` — composición Studio.
- `src/studio/core/studio-kernel.mjs` — document/commands.
- `src/studio/ui/studio-live-shell.mjs` — shell.
- `src/studio/ui/studio-asset-palette.mjs` — búsqueda/categorías/carpetas.
- `src/world/map-forge/` — generación/composición Map Forge.

## Gameplay

- `src/abilities/` — abilities/Stone/equipment channels.
- `src/systems/pvp-world.js` — PvP world.
- `src/systems/arena-*` — Arena.
- `src/systems/equipment-system.js` — equipo.
- `src/mounts/` — monturas.
- `src/systems/backpack-system.js` — mochila.
- `src/systems/container-system.js` — contenedores.
- `src/systems/title-system.js` + `player-stats.js` — títulos/stats.
- `src/systems/nobility.js` — nobleza.
- `src/systems/commerce-authority.js` — commerce.
- `src/systems/regional-economy-system.js` — economía regional.
- `src/systems/caravan-system.js` — caravanas.
- `src/property/property-system.js` — placements/property.
- `src/instances/` — instancias.

## Admin / Reliability

- `src/systems/admin-key-system.js`
- `src/systems/guardian-system.js`
- `src/systems/game-tuning-system.js`
- `src/bug-reporting/`
- `bugs/` — registry/evidence canónico.

## Documentación

Empieza por `docs/DOCUMENTATION_INDEX.md`. Para passes materiales multiagente, lee también la entrada `ACTIVE` o `IMPLEMENTED_PENDING_VERIFY` correspondiente en `docs/IMPLEMENTATION_LEDGER.md`. Los documentos `*_MEMORY.md` son contexto acumulado, no autoridad superior al runtime.

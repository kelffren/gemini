# Kelo World — Code Index

**Actualizado:** 2026-09-16

## Runtime

- `index.html` — orden LIVE, auth-first y engine boot.
- `engine-a.js` — legacy state/movement physics core.
- `engine-c.js` — legacy render/simulation orchestration.
- `engine-net.js` — networking runtime.
- `tools/pixelorama/index.html` — shell same-origin lazy de Pixelorama Pro; Godot/WASM solo bajo demanda.

## Foundation Core

- `src/core/events/event-bus.js` — `KeloEvents`.
- `src/core/input-lock-system.js` — `KeloInputLocks`.
- `src/core/input-system.js` — `KeloInput`.
- `src/core/movement-system.js` — `KeloMovement`.
- `src/core/camera-system.js` — `KeloCamera`.
- `src/core/avatar-render-system.js` — `KeloAvatar`.
- `src/core/render-extension-system.js` — `KeloRender`.
- `src/core/simulation-extension-system.js` — `KeloSimulation`, incluidos suspension claims owner-native para lifecycle explícito.
- `src/core/update-system.js` — `KeloUpdater`.

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
- `src/creators/assets/png-conformance-guard.mjs` — estructura PNG, APNG/Adam7/16-bit classification, safe-to-copy y límites anti-bomb.
- `src/creators/assets/asset-image-profiler.mjs` — clasifica tile/pixel/UI/FX/sprite con confidence/sourceOfTruth y selecciona quality policy.
- `src/creators/assets/png-space-optimizer.mjs` — compresión PNG lossless con gate RGBA exacto y reducciones exactas de representación.
- `src/creators/assets/png-independent-validator.mjs` — consenso externo Sharp/libvips + pngcheck.
- `src/creators/assets/png-codec-tournament.mjs` — torneo verificado Kelo/OxiPNG/ZopfliPNG/ECT.
- `src/creators/assets/png-adaptive-optimizer.mjs` — búsqueda opt-in guiada por perfil con fallback strict.
- `src/creators/assets/png-quality-agent.mjs` — RGBA/alpha/PSNR/bordes/seams/premultiplied/composited hard gates.
- `src/creators/assets/asset-animation-consistency.mjs` — QA temporal de secuencias: silhouette, alpha, centroid, paleta y anchor drift.
- `src/creators/assets/quality-boundary-search.mjs` — búsqueda medida multi-frontera/no-monotónica con probes exploratorios.
- `src/creators/assets/quality-pareto.mjs` — fronteras no dominadas de tamaño/calidad/CPU/decode/memoria/compatibilidad.
- `src/creators/assets/perceptual-quality-bridge.mjs` — advisory opcional SSIMULACRA2/Butteraugli/IQA; nunca sobreescribe hard gates.
- `src/creators/assets/asset-effort-controller.mjs` — FAST→BALANCED→DEEP según valor marginal medido.
- `src/creators/assets/asset-optimization-cache.mjs` — cache content-addressed invalidado por source/config/engine/toolchain.
- `src/creators/assets/asset-provenance.mjs` — SHA-256 SOURCE/OUTPUT y evidencia reproducible.
- `src/creators/assets/runtime-image-variants.mjs` — laboratorio DELIVERY PNG/WebP/AVIF en sRGB, con timings/memoria y bloqueo por device proof.
- `src/creators/assets/delivery-device-proof.mjs` — contrato formal de benchmark real iOS Safari.
- `src/creators/assets/asset-delivery-manifest.mjs` — variantes DELIVERY inmutables por hash + provenance.
- `src/creators/assets/smart-atlas-planner.mjs` — trim alpha-safe, `orig/trim/anchor`, MaxRects y subframe dedup.
- `src/creators/assets/asset-budget-policy.mjs` — límites declarativos por grupo/zona para bytes, RGBA, file count y asset máximo.
- `docs/asset-space-budgets.json` — política inicial de budget de bibliotecas/zonas; no infiere loading runtime.
- `scripts/asset-space-compiler.mjs` — CLI FAST/AUTO/BALANCED/DEEP, before/after/diff, perfil, provenance y reporte.
- `scripts/asset-space-budget.mjs` — transferencia, RGBA baseline, transparencia y duplicados exactos.
- `scripts/asset-route-budget-audit.mjs` — enforcement CI de grupos declarados en `docs/asset-space-budgets.json`.
- `scripts/asset-animation-consistency-audit.mjs` — corpus adversarial de flicker/anchor/alpha temporal.
- `scripts/asset-codec-tournament.mjs` — laboratorio profundo de codecs y variantes de entrega.
- `scripts/asset-space-meta-audit.mjs` — gate de profiler/seams/search no-monotónico/tournament.
- `scripts/asset-png-torture-audit.mjs` — parser/conformance mutation corpus.
- `scripts/asset-png-independent-audit.mjs` — validación independiente sobre assets reales.
- `scripts/asset-atlas-space-audit.mjs` — presupuesto geométrico/trim/dedup/MaxRects de atlas.
- `scripts/asset-atlas-recomposition-audit.mjs` — prueba render-exact de trim/repack + anchors.
- `src/creators/assets/asset-sheet-compiler.mjs` — compiler heterogéneo de geometría/metadata.
- `src/creators/sprite-compiler/sprite-foreground-analysis.mjs` — foreground/components.
- `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs` — perfil world asset.

## Studio / Creator

- `src/ui/studio-launcher.js` — launcher.
- `src/creators/workspaces/world-workspace.mjs` — route/prewarm móvil.
- `src/studio/integration/world-studio-bridge.mjs` — bridge de carga.
- `src/studio/integration/live-studio-controller.mjs` — sesión LIVE.
- `src/studio/studio-entry.mjs` — composición Studio.
- `src/studio/core/studio-kernel.mjs` — document/commands.
- `src/studio/ui/studio-live-shell.mjs` — shell.
- `src/studio/ui/studio-asset-palette.mjs` — búsqueda/categorías/carpetas.
- `src/world/map-forge/` — generación/composición Map Forge.
- `src/creators/core/creator-exclusive-runtime.mjs` — lifecycle de creators pesados sobre Foundation: input/movement/render/simulation/atlas.
- `src/creators/repository/pixelorama-project-store.mjs` — drafts `.pxo` en IndexedDB con revisiones acotadas.
- `src/creators/ui/pixelorama-pro-bridge.mjs` — integración Pixelorama Pro in-game, lazy y binaria con Asset Forge.
- `scripts/prepare-pixelorama-kelo.mjs` — patch reproducible del source upstream para Web móvil Kelo sin vendorear WASM/PCK.
- `scripts/pixelorama-runtime-audit.mjs` — auditoría estática del contrato Pixelorama/Kelo.
- `server/sprite-ai-service.js` — owner server de selección de proveedor de inferencia para Sprite Factory.
- `server/sprite-ai-provider-huggingface.js` — adapter server-only a Gradio/ZeroGPU.
- `deploy/huggingface-sprite-ai/` — Space de referencia FLUX.2 Klein + SpriteSheet LoRA; produce candidatos para el compilador, no assets aprobados.

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
- `src/systems/guardian-system.js` — owner cliente Guardian, P2P, preferencias y capability probe WebGPU.
- `src/systems/guardian-asset-gpu-worker.mjs` — cómputo WebGPU opt-in para candidatos de assets con presets seguros, SHA-256 y quorum.
- `server/guardian-coordinator.js` — scheduler/leases/proofs y agregado de capacidad Guardian, incluida GPU para assets.
- `supabase/migrations/20260916053000_guardian_gpu_asset_capacity_v3.sql` — agregado GPU del control plane primario.
- `src/systems/game-tuning-system.js`
- `src/bug-reporting/`
- `bugs/` — registry/evidence canónico.

## Documentación

Empieza por `docs/DOCUMENTATION_INDEX.md`. Los documentos `*_MEMORY.md` son contexto acumulado, no autoridad superior al runtime.
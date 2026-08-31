# ARCHITECTURE_CURRENT — Kelo World
Fecha: 2026-08-30
Repo: kelffren/gemini  branch main
Pages: https://kelffren.github.io/gemini/
Commit auditado: b5ea02165a8162aa13d82d68088679551a6963f5

## Entry point
index.html carga canvas + HUD DOM y scripts en orden:
engine-a … engine-n.js

No hay Phaser 3 en producción. El loop es canvas 2D + requestAnimationFrame (definido en a/b).

## Capas
1. engine-a: mundo, player, input, física AABB, cámara, particles, STATE, skills data, bots, PvP stub, render base
2. engine-b: paneles mercado/farm/forja/casa/exchange (DEMO), render farm/plot/arena, game loop wrap
3. engine-c: zoom, menu sheet, farm ticks, quickTravel
4. engine-d: ranks, inspect, minimapa
5. engine-e: applyState + jewels + contrato player
6. engine-f/g/j/k/l/m: aim ML, dash tween, rango medible, proyectiles visibles
7. engine-h/i: HiDPI + plaza.jpg
8. engine-n: melee tap lado derecho

## Contrato player (NO CAMBIAR campos)
id name title rankId jewels power x y vx vy
applyState(player, patch)

## Persistencia
localStorage key kelo_world_state_v2_1 (STATE economico demo)
No DataManager formal todavía.

## Red
Ninguna. Bots locales. Colyseus es futuro, no existe en este repo.

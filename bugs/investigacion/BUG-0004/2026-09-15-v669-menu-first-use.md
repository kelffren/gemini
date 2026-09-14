# First-use regression investigation

BUG: BUG-0004
FECHA: 2026-09-15
VERSION / BUILD: V6.69 / 307850e1, local loader candidates v7-v11
ESTADO: vigente

Original runtime failures were reproduced in the local in-app Chromium browser. The mobile fixture uses a 390x844 iframe; this is neither WebKit nor a physical iPhone.

| Route | Before | Candidate evidence |
|---|---|---|
| Mounts | `KeloMounts missing catalog/stats dependency`; no panel | Dependency graph initializes; move 8104ms / distance2499, rest10s, resume4013ms / distance1240, sample delay <=130ms, no errors |
| Market | Only `Mercado cargando…`, no close control | Real menu opens the listings/escrow panel with close control; move8069ms / distance2499, rest10s, resume4032ms / distance1250, delay<=124ms, no errors |
| Bag | Loader says ready while Equipment and Containers are absent | Owners present; watched cycle move8032ms / distance2467, rest10s, resume4039ms / distance1244, delay<=123ms, no errors |
| Appearance | `CHARACTER_SLOT_SCHEMA_NOT_LOADED`; loader still says ready | Existing Profile Launcher; owners present, move8073ms / distance2478, rest10s, resume4030ms / distance1244, delay<=118ms, no errors |

One Bag fixture run recorded a 281095ms timer gap before re-observation. A watched retry passed. The origin of that gap (game, browser lifecycle, host suspension) remains undetermined; do not silently remove it or count that run as passing.

The network regression test failed on original code with `Missing expected rejection`. The candidate removes failed script tags, rejects the pack, clears its inflight promise and allows retry. The test then passes and checks no duplicate successful script tags.

Movement tests reverse direction every 2s along the same path to avoid mistaking a map boundary for a freeze. A naive initial right-only resume had zero displacement at the boundary; it was a test geometry error, not evidence of freeze.

Pending: actual UI open/close and functional operations for all routes; WebKit matrix; cold-load timing; long-session soak; real iPhone QA; original player's persistent freeze reproduction. Existing static audits for equipment/performance still assume the removed eager index chain and fail; do not weaken their functional checks to hide this.

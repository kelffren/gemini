# Main Menu / Luxe Shell System

## Status

**Foundation active UI shell + collapsible quick-actions rail + shared presentation primitives.** `src/ui/luxe-shell.js` sigue siendo el único owner visible del menú principal/HUD. `src/ui/luxe-player-hud.js` es su subcomponente de HUD y `src/ui/luxe-ui-foundation.js` extiende el mismo owner con primitives de presentación compartidos bajo `KeloUI`; no crea un segundo menú ni un segundo owner de gameplay.

## Purpose

Luxe mantiene una sola navegación móvil y deja el mundo legible. La capa `KeloUI` estandariza feedback y comportamiento transversal para que paneles presentes y futuros no inventen su propio toast, dialog, overlay stack, busy state, motion preference o diagnóstico táctil.

La implementación es presentation-only. Inventario, economía, combate, propiedades, PvP, mounts, creators y cualquier dato valioso conservan sus owners/authority existentes.

## Owner and files

- **Presentation owner:** `KELO_LUXE` / `src/ui/luxe-shell.js`.
- **Shared presentation support contract:** `KeloUI` / `src/ui/luxe-ui-foundation.js`.
- **Base responsive tokens (critical path):** `src/ui/responsive-foundation.css`.
- **Post-ready semantic/primitives styles:** `src/ui/luxe-ui-foundation.css`.
- **Player HUD + quick actions:** `src/ui/luxe-player-hud.js` / `KELO_LUXE_PLAYER_HUD`.
- **Fullscreen/orientation:** `KELO_ORIENTATION` / `src/ui/mobile-orientation.js`.
- **Input locks:** `KeloInputLocks`.
- **Domain owners:** cada destino sigue poseyendo sus datos y operaciones.

`KeloUI` es un contrato support del mismo owner de presentación, no una autoridad de dominio.

## State owned / not owned

Owned presentation state:

- main-menu open/closed;
- chat drawer open/closed;
- Luxe input-lock tokens;
- quick-actions expanded/collapsed;
- visual HUD cache;
- `KeloUI` surface stack efímero;
- toast/busy presentation entries;
- preferencia local `motion` (`system`, `full`, `reduced`).

Not owned:

- gameplay position/movement;
- HP/mana authority;
- inventory/equipment/economy;
- purchases/trades;
- PvP results/cooldowns;
- property/world authority;
- creator publish authority.

## KeloUI shared presentation API

`src/ui/luxe-ui-foundation.js` publica:

```text
KeloUI.toast(message, options)
KeloUI.closeToast(token)
KeloUI.confirm(options) -> Promise<boolean>
KeloUI.surfaces.open(options)
KeloUI.surfaces.close(token)
KeloUI.surfaces.top()
KeloUI.surfaces.requestCloseTop(reason)
KeloUI.surfaces.snapshot()
KeloUI.busy.begin(key, label)
KeloUI.busy.end(token)
KeloUI.haptics.pulse(kind)
KeloUI.motion.get()
KeloUI.motion.set(mode)
KeloUI.auditTouchTargets(scope)
KeloUI.snapshot()
```

### Surface stack

The stack owns only presentation ordering and focus restoration. A domain UI can register a surface and provide `onRequestClose`. Closing the surface never mutates domain state. Dialogs use the same stack rather than a private modal registry.

### Dialog contract

`KeloUI.confirm()`:

- uses `role="dialog"` + `aria-modal="true"`;
- traps Tab focus inside the dialog;
- focuses the primary action on open;
- supports Escape/backdrop cancellation;
- acquires/release a `KeloInputLocks` token owned by `kelo-ui-dialog`;
- restores previous focus after close;
- resolves a boolean only; the caller decides any domain mutation after the result.

### Toast contract

Toasts:

- are deduplicated by explicit key or message;
- expose neutral/success/warning/error tones;
- support an optional action callback;
- always provide a 44 px dismiss target;
- use `aria-live` / `role=status` or `role=alert` for error tone;
- use timers only for finite visual dismissal, never polling.

### Busy contract

Busy tokens are presentation-only. They communicate pending work without claiming completion. Multiple operations may coexist; ending a token reports measured elapsed presentation time through `kelo:ui-busy-end`.

### Haptics

`KeloUI.haptics.pulse()` is capability-based. It calls `navigator.vibrate` only when available and always returns a boolean. UI must still provide visible feedback because vibration is not universally supported.

### Motion

The system already respects OS `prefers-reduced-motion`. `KeloUI.motion.set('reduced')` adds an explicit in-game override. `system` removes the override. This preference is presentation-only and may live locally without server authority.

## Design tokens and boot weight

`responsive-foundation.css` remains the small critical-path source for viewport, spacing, radius, typography and the existing 44 px touch token. The larger semantic/polish layer lives in `luxe-ui-foundation.css` and is intentionally declared only **after** `window.__keloBootReady=true` so UI maturity cannot make the plaza slower to become playable.

The post-ready layer adds semantic tokens for:

- surface layers;
- primary/secondary text;
- accent/success/warning/danger;
- soft/accent borders;
- raised/modal shadows;
- fast/normal/slow motion;
- UI z-layers from HUD through critical diagnostics.

Domain UIs should consume semantic meaning rather than copy one-off colors and z-index values. `scripts/luxe-ui-foundation-audit.mjs` fails if the new CSS or JS is moved back before the first-playable marker.

## Legibility and touch contract

- primary frequent touch target goal: **44×44 CSS px**;
- `KeloUI.auditTouchTargets()` reports visible interactive elements below the goal without silently resizing domain layouts;
- shared buttons guarantee at least 44×44;
- common focus-visible styling is keyboard/pointer accessible;
- Luxe labels previously rendered in the 5.4–8 px range receive a presentation legibility floor in the post-ready shared CSS;
- safe-area and visual viewport owners remain unchanged.

This follows the mobile game principle of keeping touch controls physically comfortable and using flexible/safe-area-aware layouts rather than globally scaling an entire interface.

## Quick-actions rail

Default is collapsed. The same existing Boutique, Menú, PvP, Guía and Pantalla Completa nodes are moved into the expandable rail; handlers are not cloned.

Rules:

1. existing owner nodes/listeners are preserved;
2. the launcher owns only expanded/collapsed state;
3. collapsed options cannot capture pointer events;
4. motion uses transform/opacity and honors reduced motion;
5. launcher/actions maintain mobile touch sizing;
6. fullscreen remains owned by `KELO_ORIENTATION`.

## Player combat HUD

Social exploration keeps the combat HUD hidden. Combat/PvP shows only real Vida/Maná sources and never mutates either resource. Presentation refresh remains event/hook based rather than `setInterval`.

## Current player-facing main-menu routes

| Entry | Destination owner / route | Status |
|---|---|---|
| Mochila | `KeloBackpackUI.open()` | LIVE |
| Habilidades | `KeloAbilities.openStonePanel()` | LIVE |
| Apariencia | `KeloCharacterCustomizer.open()` | DYNAMIC LIVE |
| Monturas | `KeloMountPanel.open()` | LIVE when ready |
| Perfil | `inspectPlayer(localPlayer, true)` adapter | LIVE / LEGACY UI |
| Mercado | `KeloMarketUI.open()` | LIVE |
| Chat | Luxe chat drawer | LIVE presentation |
| Propiedades | `KELO_HOUSE_UI.show()` | LIVE |
| Nobleza | `KeloNobility.open()` | LIVE |
| Libro de títulos | `KeloTitles.openBook()` | LIVE |
| Burlas | `KeloSelfInteractionUI.openEmotes()` | LIVE |
| Creators | authorized lazy launcher | LIVE when authorized |

Misiones/Ajustes remain owner-gated.

## Input-lock contract

Main menu claims `luxe-main-menu`; chat claims `luxe-chat`; shared dialog claims `kelo-ui-dialog`. Small quick-actions do not lock gameplay. Every token is released by the owner that acquired it.

## Events and observability

Presentation foundation emits browser events:

```text
kelo:ui-ready
kelo:ui-surface-open
kelo:ui-surface-close
kelo:ui-toast-open
kelo:ui-toast-close
kelo:ui-busy-start
kelo:ui-busy-end
kelo:ui-motion-change
```

`KELO_UI_AUDIT` exposes stable facts for tests: owner, presentation-only status, 44 px contract, focus trap, toast dedupe, surface stack, busy tokens, motion preference, haptics fallback and zero polling.

`?uiLab=1` or `?uiInspector=1` enables a small read-only inspector showing surface depth, sub-44 targets, visual viewport size and current focus. It never changes gameplay state.

## Online-first model

This feature can remain fully client-side because it owns only presentation. Valuable actions still flow:

```text
UI -> domain public API -> local/server authority -> result -> UI feedback
```

Replacing a domain authority with Supabase/server does not require redesigning KeloUI IDs, focus, stack, toast, dialog or motion behavior.

## Extension points

A new domain panel should:

1. call the domain owner for data/operations;
2. use semantic tokens/shared primitives for presentation;
3. register itself in `KeloUI.surfaces` if it participates in stacked navigation;
4. use `KeloUI.busy` while an operation is pending;
5. use toast for transient status and dialog only for genuinely interruptive/irreversible confirmation;
6. keep domain mutation outside DOM handlers except through the owner public API;
7. preserve 44 px frequent touch targets and focus behavior.

## Invariants

- one Luxe navigation owner;
- no second gameplay/input owner;
- KeloUI owns presentation only;
- no writes to `STATE` or `localPlayer` from the presentation foundation;
- no `setInterval` or UI correctness watchdog;
- domain authority remains outside UI;
- one overlay stack for consumers that adopt the shared contract;
- dialog input locks are tokenized and released;
- minimum shared control target is 44 px;
- OS and explicit reduced motion are respected;
- presentation foundation CSS/JS stays post-ready and outside first-playable bytes;
- same existing Luxe action IDs/handlers remain valid.

## Anti-patterns

Do not:

- create another global UI manager with competing stack/toasts;
- let a toast/dialog mutate economy/gameplay directly;
- clone Boutique/Menu/PvP/Fullscreen handlers;
- hide overlays only with opacity while they remain touchable;
- use arbitrary maximum z-index for normal surfaces;
- introduce a UI framework only to obtain primitives already covered here;
- use polling to synchronize visual state;
- treat haptic success as the only feedback channel;
- force all legacy controls to 44 px by global CSS if that breaks layout;
- move the new polish layer before `kelo:boot-ready`.

## Tests and CI

Static shared-presentation gate:

```text
node scripts/luxe-ui-foundation-audit.mjs
```

It verifies owner/API contract, semantic tokens, 44 px contract, zero gameplay writes, zero polling, post-ready load order, first-playable exclusion and mandatory mobile coverage.

Main Stability Gate runs the audit on every PR to `main`, then serves exact PR bytes and executes `tests/main-stability-mobile.spec.js` at iPhone 390×844 with touch/iPhone UA. The repository Weightless workflow independently enforces the critical-path byte ratchet.

The mobile smoke verifies:

- boot and guest gate;
- canvas/player readiness;
- eight seconds sustained joystick movement;
- evaluate latency budget ≤400 ms;
- no page errors;
- `KeloUI` and `KELO_UI_AUDIT` availability;
- presentation-only ownership;
- toast open/dismiss behavior with 44 px close target;
- dialog surface stack, initial focus, 44 px actions and cancellation cleanup;
- no leaked dialog surface after close.

Existing Luxe menu audits remain:

```text
node scripts/luxe-menu-audit.mjs
node scripts/live-luxe-menu-audit.mjs
```

## Known debt

- Existing domain UIs still need gradual adoption of shared primitives; this pass deliberately does not destructively rewrite validated panels.
- Some legacy Luxe controls still have bespoke CSS; shared semantic tokens are now available for migration.
- Global boot still contains historical z-index/minimap containment that should be retired only through the documented identify → migrate → test → live → dead sequence.
- `KeloUI.auditTouchTargets()` reports legacy undersized targets; it does not claim they are all migrated yet.

## Checklist for future changes

- [ ] Reuse `KELO_LUXE` / `KeloUI`; do not add a parallel presentation manager.
- [ ] Keep domain authority outside UI.
- [ ] Use shared tokens/primitives.
- [ ] Keep presentation-polish CSS/JS post-ready.
- [ ] Preserve safe areas / VisualViewport behavior.
- [ ] Preserve 44 px frequent controls.
- [ ] Test focus and reduced motion.
- [ ] Run `node scripts/luxe-ui-foundation-audit.mjs`.
- [ ] Run Main Stability iPhone smoke.
- [ ] Run existing Luxe/static/live audits for changes to menu/rail routes.
- [ ] Update this document and player guide if a visible route/mechanic changes.

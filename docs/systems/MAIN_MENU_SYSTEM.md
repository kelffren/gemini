# Main Menu / Luxe Shell System

## Status

**Foundation active UI shell.** `src/ui/luxe-shell.js` is the single visible main-menu surface used by the current runtime. This pass redesigns that existing surface; it does not create a second menu or navigation engine.

## Owner and responsibility

- **Presentation owner:** `KELO_LUXE` / `src/ui/luxe-shell.js`
- **Input-lock owner:** `KeloInputLocks`
- **Domain owners:** each destination keeps its own state and operations.

The Luxe shell owns only:

- the visible top HUD shell;
- the right-side Menu / PvP launch controls;
- open/closed presentation state for its main menu and chat drawer;
- temporary input-lock claims for those Luxe surfaces;
- dispatching a tap to an existing public owner API.

It does **not** own inventory, abilities, character appearance, market data, properties, nobility, emotes, profile state, PvP authority or creator permissions.

## Current player-facing menu routes

| Entry | Destination owner / route | Status |
|---|---|---|
| Mochila | `KeloBackpackUI.open()` | LIVE |
| Habilidades | `KeloAbilities.openStonePanel()` | LIVE |
| Apariencia | `KeloCharacterCustomizer.open()` | DYNAMIC LIVE |
| Perfil | legacy LIVE `inspectPlayer(localPlayer, true)` adapter | LIVE / LEGACY UI |
| Mercado | `KeloMarketUI.open()` | LIVE |
| Chat | Luxe chat drawer | LIVE presentation |
| Propiedades | `KELO_HOUSE_UI.show()` with current property/house owner flow | LIVE |
| Nobleza | `KeloNobility.open()` | LIVE, authority-aware |
| Burlas | `KeloSelfInteractionUI.openEmotes()` | LIVE |
| Creators | `KELO_CREATORS_LAUNCHER` / admin-authorized lazy launcher | LIVE when authorized |

## Recovered discoverability

Three valid features existed in the runtime but were not exposed in the visible Luxe menu:

1. **Apariencia** — the Character Creator was already Foundation-active but primarily reachable through self-interaction/profile routing.
2. **Nobleza** — the nobility owner still had a stale injection selector for an older `#menu-sheet .menu-grid`; the real current shell is `#lx-menu-panel .lx-menu-grid`. Luxe now routes directly to the existing owner rather than duplicating the Nobility UI.
3. **Burlas** — the emote panel was reachable from the self-interaction popup but not from the main menu.

## Intentionally not exposed as fake buttons

### Misiones

The current legacy `openSocialTool('missions')` path is only a placeholder message. `engine-q.js` contains a legacy Maestro trial prototype and explicitly is not the owner for new missions. The premium menu only renders Misiones if a future `KeloMissionsUI.open()` owner exists.

### Ajustes

The current legacy `openSocialTool('settings')` path is only a placeholder. The premium menu only renders Ajustes if a future `KeloSettingsUI.open()` owner exists.

This keeps the rule: **visible button = real destination**.

## Nobility / donations

`KeloNobility` remains the owner. Its existing flow includes accumulated donations and ranks from Caballero through Rey. When online authority is available, `nobility-authority.js` routes donation decisions through `KeloNetAuthority`; the main menu never calculates or mutates donation balances.

## Input-lock contract

Opening the Luxe main menu claims one token:

```text
owner: luxe-main-menu
```

Closing it releases that exact token.

The chat drawer uses its own token:

```text
owner: luxe-chat
```

A menu tap must not leak through to world movement. Luxe UI surfaces stop pointer propagation, while the actual lock lifecycle remains owned by `KeloInputLocks`.

No direct `KELO_MODAL_INPUT_LOCK` writes, watchdogs or `setInterval` polling are allowed.

## Mobile layout contract

- portrait-first;
- two-column card grid;
- iOS safe-area aware;
- menu content scrolls inside the panel instead of growing outside the viewport;
- low-height landscape receives a compact layout;
- primary close target is at least 44 × 44 px;
- cards are substantially larger than the minimum touch target;
- no horizontal document overflow.

## Creators

`src/ui/studio-launcher.js` remains a separate launcher because it owns authorization and lazy loading for creator tools. It **reuses the existing Luxe grid** and does not create another menu. If the active user lacks the required admin permission, the Creators card is absent.

## Adding a future main-menu destination

Do not add a decorative button first. The sequence is:

1. identify the domain owner;
2. confirm a stable public `open()`/navigation operation exists;
3. add one declarative menu entry in Luxe;
4. route the tap to that owner API;
5. add browser coverage;
6. update this document and player guide if the entry is player-visible.

If there is no real owner yet, do not expose the entry as if it worked.

## Validation

Static contract audit: `node scripts/luxe-menu-audit.mjs`.

Browser audit: `node scripts/live-luxe-menu-audit.mjs` with `AUDIT_URL` pointing at a local server or the deployed Pages URL. It validates portrait/landscape containment, recovered routes, token release, movement after closing, PvP enter/leave, console errors and screenshot evidence.

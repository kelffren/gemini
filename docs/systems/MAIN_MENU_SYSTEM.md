# Main Menu / Luxe Shell System

## Status

**Foundation active UI shell + Player HUD V1.** `src/ui/luxe-shell.js` remains the single visible main-menu/HUD presentation owner used by the current runtime. `src/ui/luxe-player-hud.js` is a presentation subcomponent of that same owner: it replaces the old compact top-left gold/presence surface with the player profile HUD without creating a second gameplay, profile, wallet, nobility or title system.

## Owner and responsibility

- **Presentation owner:** `KELO_LUXE` / `src/ui/luxe-shell.js`
- **Player HUD presentation subcomponent:** `src/ui/luxe-player-hud.js` / `KELO_LUXE_PLAYER_HUD`
- **Input-lock owner:** `KeloInputLocks`
- **Domain owners:** each destination and player datum keeps its own state and operations.

The Luxe shell owns only:

- the visible top HUD shell;
- the right-side Menu / PvP launch controls;
- open/closed presentation state for its main menu and chat drawer;
- temporary input-lock claims for those Luxe surfaces;
- dispatching a tap to an existing public owner API.

It does **not** own inventory, abilities, character appearance, market data, properties, nobility, titles, HP, gold, clan membership, emotes, profile authority, PvP authority or creator permissions.

## Player HUD V1

The top-left HUD is one cohesive player card. It is rendered as real DOM/CSS, not as a flat reference image, and consumes state already owned by the runtime.

Visible hierarchy:

1. **Nobleza** — intentionally the strongest prestige treatment, with crown, gold frame and larger typography.
2. Player name + stable player ID.
3. Equipped personal title.
4. Vida / Maná resource rows.
5. Clan + Oro.
6. A styled **GUÍA** button sits immediately below the card.

The card contains:

- avatar/portrait;
- player name;
- player ID and copy affordance;
- clan plaque under the avatar;
- current Nobleza rank;
- currently equipped personal title;
- HP / max HP with a dynamic bar;
- Maná / max Maná when a real resource source exists;
- current Oro amount;
- the player-guide link below the card.

### Data sources and ownership

| HUD datum | Source / owner consumed | Fallback policy |
|---|---|---|
| Name / ID | `localPlayer` | stable local prototype identity if no profile bridge exists |
| Avatar | player/profile avatar when exposed | existing `assets/hero.PNG` visual fallback only |
| Clan | player/profile clan fields if exposed | `Sin clan`; no clan persistence is invented |
| Nobleza | `KeloNobility.getRank()` | actor nobility field / `Sin nobleza` |
| Personal title | `KeloTitles.getEquipped()` + `getTitle()` | `Ninguno` |
| Vida | `localPlayer.hp` / `maxHp` | unavailable indicator if absent |
| Maná | player/profile `mana` / `maxMana` only | `— / —`; the HUD does not invent mana gameplay state |
| Oro | existing `STATE.gold` / profile bridge | `0` only when no value is exposed |

The HUD never mutates those values. It renders snapshots and subscribes to semantic changes when owners emit them. It also refreshes after player UI interactions so existing legacy flows that still call `saveState()` remain visible without a timer. There is no `setInterval`, watchdog or continuous render-loop polling.

### Duplicate HUD root cause and retirement

The duplicated `Oro 1500` was **not** a double execution of `luxe-shell.js`. Two different surfaces were live at the same time:

1. `index.html` mounted the legacy `#telemetry-bar` containing `Oro: 1500 | KC: 200` in the top-left corner.
2. `src/ui/luxe-shell.js` independently mounted its Luxe `.lx-gold` pill in the same area.

The old guide link was also mounted independently by `index.html`.

Player HUD V1 removes the cause rather than covering it:

- the legacy `#telemetry-bar` markup and its `.hud-badge` CSS are removed from `index.html`;
- the legacy standalone `#kelo-guide-link` markup/CSS are removed from `index.html`;
- the Player HUD subcomponent replaces the old Luxe gold/presence nodes in DOM and owns the single integrated visual surface;
- the integrated Oro display still reads the same `STATE.gold` value; there is no second wallet variable.

No hidden duplicate telemetry element is retained.

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
2. **Nobleza** — the nobility owner still had a stale injection selector for an older `#menu-sheet .menu-grid`; the real current shell is `#lx-menu-panel .lx-menu-grid`. Luxe routes directly to the existing owner rather than duplicating the Nobility UI.
3. **Burlas** — the emote panel was reachable from the self-interaction popup but not from the main menu.

## Intentionally not exposed as fake buttons

### Misiones

The current legacy `openSocialTool('missions')` path is only a placeholder message. `engine-q.js` contains a legacy Maestro trial prototype and explicitly is not the owner for new missions. The premium menu only renders Misiones if a future `KeloMissionsUI.open()` owner exists.

### Ajustes

The current legacy `openSocialTool('settings')` path is only a placeholder. The premium menu only renders Ajustes if a future `KeloSettingsUI.open()` owner exists.

This keeps the rule: **visible button = real destination**.

## Nobility / donations

`KeloNobility` remains the owner. Its existing flow includes accumulated donations and ranks from Caballero through Rey. When online authority is available, `nobility-authority.js` routes donation decisions through `KeloNetAuthority`; neither the menu nor the Player HUD calculates or mutates donation balances.

`KeloTitles` remains a separate owner for achievement titles. The Player HUD may therefore display, for example, Nobleza `Duque` and personal title `Asesino` simultaneously without merging the two concepts.

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

The Player HUD itself is pointer-transparent except for intentional controls such as avatar/profile, copy-ID and GUÍA. No direct `KELO_MODAL_INPUT_LOCK` writes, watchdogs or `setInterval` polling are allowed.

## Mobile layout contract

Player HUD:

- anchored to `safe-area-inset-top` and `safe-area-inset-left`;
- width scales with `clamp()` and has a compact <=360 px layout;
- Nobleza remains readable and visually dominant without consuming half the viewport;
- low-height landscape reduces avatar/resources further;
- interactive targets such as GUÍA remain at least 44 px high;
- the card does not occupy the right-side Menu / PvP rail.

Main menu:

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

## Extending the Player HUD

Do not add a second HUD or profile store. Expose the missing datum from its real domain owner or a minimal profile read adapter, then teach `luxe-player-hud.js` to consume it. The HUD is intentionally tolerant of absent optional fields so future clan/mana/online-profile owners can plug into the same presentation contract.

## Validation

Static contract audit: `node scripts/luxe-menu-audit.mjs`.

Browser audit: `node scripts/live-luxe-menu-audit.mjs` with `AUDIT_URL` pointing at a local server or the deployed Pages URL. It validates portrait/landscape containment, recovered routes, token release, movement after closing, PvP enter/leave, console errors and screenshot evidence. Player HUD V1 additionally requires checking one top-left HUD instance, absence of legacy telemetry/guide elements, safe-area containment, Nobleza/title separation, resource values and pointer isolation.

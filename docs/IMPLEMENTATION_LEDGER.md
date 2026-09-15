# Kelo World — Implementation Ledger

**Propósito:** conservar la intención exacta de los cambios materiales para que ChatGPT, Grok, Codex u otro agente pueda continuar un pass sin reinventar arquitectura ni confundir planes con comportamiento LIVE.

Este archivo **NO sustituye** a `ENGINE_MAP.md`, Foundation ni a los documentos de sistema. Su trabajo es conservar **qué se está intentando conseguir, qué parte ya se implementó, qué evidencia existe y qué falta**.

## Regla obligatoria para agentes

Antes de continuar un cambio material que ya tenga una entrada `ACTIVE` o `IMPLEMENTED_PENDING_VERIFY`:

1. leer la entrada completa;
2. leer los owners/documentos enlazados;
3. verificar HEAD/runtime antes de asumir que el código coincide;
4. actualizar la misma entrada en vez de crear un plan paralelo;
5. nunca mover un ítem a `VALIDATED` sin la evidencia requerida por `AGENTS.md`.

Estados permitidos:

- `PROPOSED` — intención acordada; todavía no implementada.
- `ACTIVE` — implementación en progreso.
- `IMPLEMENTED_PENDING_VERIFY` — código escrito/revisado, pero falta gate requerido o LIVE.
- `VALIDATED` — pasó los gates documentados pertinentes.
- `PAUSED` — trabajo intencionalmente detenido con siguiente paso explícito.
- `SUPERSEDED` — reemplazado; conservar enlace al sucesor.

## Plantilla

```md
### IMP-YYYY-MM-DD-SLUG
Status: PROPOSED | ACTIVE | IMPLEMENTED_PENDING_VERIFY | VALIDATED | PAUSED | SUPERSEDED
Owner(s):
User intent / source prompt:
Why:
Invariants:
Planned scope:
Implemented now:
Files/contracts touched:
Deferred deliberately:
Acceptance / gates:
Evidence:
Next action:
Handoff prompt:
```

---

### IMP-2026-09-15-CREATOR-OS-001

**Status:** ACTIVE  
**Owner(s):** Kelo Creators composition root + Kelo Creator Library; specialized editors keep their existing owners.  
**User intent / source prompt:** Convert Kelo's creator tooling into a universal in-game creation ecosystem: one library for characters, skins, weapons, armor, props, world objects, VFX, animations and future content; include an easy Photoshop-like preparation experience; preserve reuse/lazy loading so catalog growth does not make normal gameplay heavy; keep the creator-economy/market path open; and document every material improvement so any agent can continue the same implementation intent.

**Why:** Existing Creator workspaces already cover many domains, but discovery is tool-centric. The missing capability is a universal authoring router and durable cross-agent implementation context—not another renderer, asset catalog or second editor stack.

**Invariants:**

- `src/creators/creator-entry.mjs` remains the lazy Creator composition owner.
- Runtime owners remain unchanged: Character/Appearance/Equipment/Abilities/World/VFX/etc. keep authority.
- Creator Library routes; it does not become gameplay authority.
- Image Lab is reused as source/image preparation instead of implementing a second Photoshop clone.
- Asset Forge remains the pixel drawing/QA tool.
- Heavy Creator UIs remain lazy and absent from normal game boot.
- `CONTENT EXISTS != CONTENT IS ACTIVE`; large catalog growth must be metadata/preview/on-demand driven.
- Real marketplace value/KC/review/publish eventually requires server/online authority.

**Planned scope:**

1. Universal content-type registry covering Character, Skin, Weapon, Armor, Item, Prop, Furniture, Environment, Prefab, World, Map, VFX, Animation, UI Art, Mount, NPC, Ability, Sprite Ability, Audio, Cinematic and Seasonal Packs.
2. Mobile-first Creator Library UI with CREATE, MY LIBRARY, TOOLS and PIPELINE surfaces.
3. Register existing Image Lab as an official Creator workspace.
4. Make Creator Library the lightweight direct Creator entry from the game menu; preserve Asset Forge API compatibility.
5. Route each type to the correct existing specialized workspace/owner.
6. Establish this implementation ledger as mandatory cross-agent continuity for material passes.
7. Document Creator OS architecture in `docs/systems/CREATOR_OS_LIBRARY.md` and system catalog/code index.
8. Later passes: unified publish/review/discover/economy adapters, deeper Photoshop-like operations, specialized authoring polish and server-backed marketplace.

**Implemented now (branch `creator-os-universal-library`):**

- Universal immutable content-type registry added.
- Creator Library workspace manifest + mobile UI added.
- Image Lab workspace manifest added, reusing the existing Image Lab implementation.
- Creator composition root registers Library + Image Lab and supplies the workspace registry to router UIs.
- Lazy gate changed so `Creator Library` is the direct lightweight menu surface; `openAssetForge()` remains supported for compatibility.
- Creator Library routes to existing workspaces rather than cloning their logic.

**Files/contracts touched:**

- `src/creators/library/creator-content-types.mjs`
- `src/creators/ui/creator-library-workspace.mjs`
- `src/creators/workspaces/creator-library-workspace.mjs`
- `src/creators/workspaces/image-lab-workspace.mjs`
- `src/creators/creator-entry.mjs`
- `src/core/creators-lazy-gate.js`
- documentation files listed below as this pass continues

**Deferred deliberately:**

- Server-authoritative publication/review/payment settlement.
- Creator revenue split/KC purchase transactions.
- CDN/blob lifecycle and global moderation.
- Layer-based raster editor parity with full Photoshop; existing Image Lab + Asset Forge are the current safe base.
- Automatic seasonal publishing without human/review authority.
- Claiming that every specialized creator fully supports every asset type; Library routing does not invent missing domain capability.

**Acceptance / gates:**

- Static module syntax/import graph must pass.
- Creator Library must open lazily without loading the large world asset catalog first.
- On mobile, CREATE search/cards and TOOLS must be operable.
- Character/Skin/Weapon/Prop/VFX routes must open the intended existing workspace.
- Closing Library must release `KeloInputLocks`.
- Normal game boot/walk must pass the mandatory iPhone Playwright gate in `AGENTS.md` before `VALIDATED`.
- Creator UI must receive user-facing/LIVE mobile verification before claiming complete.
- `npm run audit:docs` should pass once this pass is integrated into a runnable checkout.

**Evidence:** code commits on branch; runtime/Playwright evidence not recorded yet.

**Next action:** finish documentation/catalog synchronization, static audit, PR review; run required mobile/Playwright gates from a runnable checkout/LIVE before merge/validation.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-OS-001`. Read `AGENTS.md`, Foundation, Engine Map, System Documentation Standard, this ledger entry, and `docs/systems/CREATOR_OS_LIBRARY.md`. Preserve existing owners. Do not create a second asset catalog, image editor, runtime renderer, history store, or marketplace authority. Continue the smallest unimplemented item, update this same ledger entry with actual evidence, and never mark VALIDATED without the required mobile/Playwright/LIVE gates.

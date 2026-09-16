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

**Status:** IMPLEMENTED_PENDING_VERIFY  
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
- Search was corrected to repaint only result groups, preserving focus/keyboard on mobile.
- Workspace cards now respect manifest availability and capability permissions.
- Creator OS owner/boundary documentation synchronized.
- Static contract audit script added for types/routes/lazy/docs checks.

**Files/contracts touched:**

- `src/creators/library/creator-content-types.mjs`
- `src/creators/ui/creator-library-workspace.mjs`
- `src/creators/workspaces/creator-library-workspace.mjs`
- `src/creators/workspaces/image-lab-workspace.mjs`
- `src/creators/creator-entry.mjs`
- `src/core/creators-lazy-gate.js`
- `scripts/creator-os-library-audit.mjs`
- `docs/systems/CREATOR_OS_LIBRARY.md`
- `docs/IMPLEMENTATION_LEDGER.md`
- `docs/SYSTEM_DOCUMENTATION_STANDARD.md`
- `docs/DOCUMENTATION_INDEX.md`
- `docs/system-catalog.json`
- `docs/CODE_INDEX.md`
- `ENGINE_MAP.md`
- `docs/ARCHITECTURE_CURRENT.md`

**Deferred deliberately:**

- Server-authoritative publication/review/payment settlement.
- Creator revenue split/KC purchase transactions.
- CDN/blob lifecycle and global moderation.
- Layer-based raster editor parity with full Photoshop; existing Image Lab + Asset Forge are the current safe base.
- Automatic seasonal publishing without human/review authority.
- Claiming that every specialized creator fully supports every asset type; Library routing does not invent missing domain capability.
- Type-specific default seeding/presets inside every legacy specialized editor; current V1 routes to the correct owner first.

**Acceptance / gates:**

- Static module syntax/import graph must pass.
- `node scripts/creator-os-library-audit.mjs` must pass from a runnable checkout.
- Creator Library must open lazily without loading the large world asset catalog first.
- On mobile, CREATE search/cards and TOOLS must be operable.
- Character/Skin/Weapon/Prop/VFX routes must open the intended existing workspace.
- Closing Library must release `KeloInputLocks`.
- Normal game boot/walk must pass the mandatory iPhone Playwright gate in `AGENTS.md` before `VALIDATED`.
- Creator UI must receive user-facing/LIVE mobile verification before claiming complete.
- `npm run audit:docs` should pass once this pass is integrated into a runnable checkout.

**Evidence:**

- Branch: `creator-os-universal-library`.
- Pull request: `#269` — `Creator OS V1 — universal library + cross-agent implementation ledger`.
- GitHub compare: branch ahead of `main` with only intended Creator/documentation/QA files.
- Local shell attempt could not clone GitHub because the execution environment could not resolve `github.com`; therefore Node/Playwright/LIVE evidence is **not** claimed.

**Next action:** run the static audit + docs audit + mandatory mobile/Playwright/LIVE gates from a runnable checkout. Fix any observed failure in this same branch/PR. Only then change this status to `VALIDATED` and merge according to repository protocol.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-OS-001` / PR #269. Read `AGENTS.md`, Foundation, Engine Map, System Documentation Standard, this ledger entry, and `docs/systems/CREATOR_OS_LIBRARY.md`. Preserve existing owners. Do not create a second asset catalog, image editor, runtime renderer, history store, or marketplace authority. First run `node scripts/creator-os-library-audit.mjs`, `npm run audit:docs`, the required iPhone Playwright gate, and LIVE Creator Library interaction. Fix failures in PR #269. Do not mark VALIDATED or merge as verified until those gates pass.

---

### IMP-2026-09-15-CREATOR-RELEASE-002

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Depends on:** `IMP-2026-09-15-CREATOR-OS-001` / PR #269.  
**Owner(s):** Kelo Universal Content Studio UI + Kelo Creator Release Service + existing Supabase content/review/publication authority.  
**User intent / source prompt:** Continue the Creator OS so creator-made characters, skins, weapons, props and future content can move toward a real creator economy/market without losing context between agents or turning the browser into the authority.

**Why:** The database and Universal Content Studio already had immutable content revisions, review requests and service-role publication, but creators lacked one visible release surface. A local fake marketplace would duplicate truth and make later moderation/KC settlement harder.

**Invariants:**

- `content_review_requests` is the canonical review state (`pending/approved/rejected/cancelled`).
- `content_publications` is the canonical publication evidence (`global/official`, active rows only).
- Browser-authenticated creators may submit/resubmit their own revision for review; they may not publish it.
- `publish_content_revision` remains executable only by `service_role`.
- Runtime preview for the creator is not public publication.
- Release Center must list only revisions owned by the authenticated user even though RLS also permits reading globally published revisions.
- No KC purchase, payout or revenue split is added in this pass.

**Implemented now (stacked branch `creator-release-center-v1`):**

- Added `Kelo Creator Release Service` over the existing repository/runtime registry.
- Added authoritative server reads for review requests and active publications.
- Corrected `listMyContent()` to explicitly filter `owner_user_id` from the authenticated JWT.
- Added Content Studio `RELEASE CENTER` showing INGESTED / IN_REVIEW / REJECTED / CANCELLED / APPROVED / PUBLISHED based on server rows.
- Added `SUBMIT REVIEW` and `RESUBMIT REVIEW` only when the server state permits it.
- Kept publish action completely absent from client API/UI.
- Added current-session runtime preview list so creators can distinguish preview from global publication.
- Added static authority audit `scripts/creator-release-center-audit.mjs`.
- Updated `docs/systems/UNIVERSAL_CONTENT_STUDIO.md` with the release lifecycle and security boundary.

**Files/contracts touched:**

- `src/creators/release/creator-release-service.mjs`
- `src/creators/content/supabase-content-repository.mjs`
- `src/creators/ui/content-studio-workspace.mjs`
- `scripts/creator-release-center-audit.mjs`
- `docs/systems/UNIVERSAL_CONTENT_STUDIO.md`
- `docs/IMPLEMENTATION_LEDGER.md`

**Deferred deliberately:**

- Discover/global marketplace browsing UI.
- Marketplace listings/pricing separate from publication metadata.
- KC escrow/payment settlement.
- Creator revenue split and payout ledger.
- Moderation/reviewer admin UI and automated approval.
- CDN/public asset lifecycle beyond the existing publication system.
- Seasonal auto-publishing; seasonal generation may prepare drafts, but publication remains review-authoritative.

**Acceptance / gates:**

- `node scripts/creator-release-center-audit.mjs` passes.
- Existing `npm run audit:universal-content` remains green.
- Authenticated integration proves only own revisions appear.
- Submit review creates/returns `content_review_requests.status=pending`.
- Rejected/cancelled revision can be resubmitted; pending/approved cannot create a fake new client state.
- A service-role publication appears as PUBLISHED with correct `global/official` visibility after refresh.
- No client module calls `publish_content_revision`.
- Mobile Content Studio can refresh/submit without freezing normal gameplay; upstream Creator OS iPhone gate still applies.
- `npm run audit:docs` passes.

**Evidence:**

- Branch: `creator-release-center-v1`, stacked from `creator-os-universal-library` at `03195b54659ab9eae8fab0e5af7be288ab24c42e`.
- Database migration inspected: `20260910024046_universal_content_registry.sql` explicitly revokes `publish_content_revision` from authenticated clients and grants it to `service_role` only.
- This environment still cannot provide the required runnable checkout/iPhone Playwright evidence, so this entry remains `IMPLEMENTED_PENDING_VERIFY`.

**Next action:** validate PR #269 first, then run Release Center static/universal/docs audits and authenticated Supabase/LIVE mobile flows on this stacked branch. Fix failures here before merging the release layer.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-RELEASE-002` on `creator-release-center-v1`. Do not implement a local marketplace queue or client publication authority. Read the Universal Content Studio system doc and migration `20260910024046_universal_content_registry.sql`. Run `node scripts/creator-release-center-audit.mjs`, `npm run audit:universal-content`, `npm run audit:docs`, authenticated Supabase review/resubmit/publication visibility tests, and the mobile/LIVE gates. Preserve the invariant that only service-role can publish. The next product layer after validation is Discover/listing/economy metadata on top of approved publications, not replacing the publication model.

---

### IMP-2026-09-15-CREATOR-MARKET-003

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Depends on:** `IMP-2026-09-15-CREATOR-RELEASE-002` / PR #271 and upstream Creator OS #269.  
**Owner(s):** Kelo Creator Marketplace client service/presentation + Supabase Creator marketplace authority + existing `character_wallets` / `wallet_ledger` KC authority.  
**User intent / source prompt:** Continue the universal Creator Library into a real creator marketplace where characters, skins, weapons, props and other approved Creator content can be discovered, listed, bought with KC and owned through durable licenses, while creators can earn from their work and all future agents retain the exact implementation context.

**Why:** Publication alone does not establish a creator economy. The next stable boundary is a marketplace that sells entitlements to immutable published content revisions without copying bytes, trusting localStorage balances, or treating UI state as ownership.

**Invariants:**

- Only an active row in `content_publications` may become a marketplace listing.
- `DRAFT != REVIEWED != PUBLISHED != LISTED != OWNED`.
- `character_wallets` + `wallet_ledger` remain the KC authority; Marketplace does not create another wallet.
- Buyer client sends listing ID, owned buyer character ID and idempotency correlation ID; it does not submit trusted settlement price or revenue split.
- Purchase RPC re-reads price/split and publication state server-side and writes debit, creator payout, transaction and entitlement transactionally.
- Entitlement is account-level to one immutable content revision. Buyer character only selects which authoritative KC wallet pays.
- Creator asset bytes and public publication bytes remain in existing asset/content owners; marketplace metadata never duplicates them.
- V1 `seller_share_bps=10000`: 100% of KC goes to the creator and 0% to platform until a platform fee/treasury policy is explicitly decided.
- Discover is metadata/preview-first and does not preload full asset bytes.
- MARKET UI remains lazy and absent from normal game boot and the default CREATE view.
- Runtime entitlement enforcement is **not yet complete**; hiding unavailable content in UI is not security.

**Implemented now (stacked branch `creator-marketplace-v1`):**

- Added Supabase `creator_profile_details`, `creator_market_config`, `creator_market_listings`, `creator_market_transactions` and `creator_content_entitlements`.
- Added Creator profile RPCs extending the existing profile identity with tagline/bio.
- Added create/update/cancel listing RPC over authority-published content only.
- Added privacy-aware `discover_creator_market_v2` returning public Creator metadata, public preview metadata and caller-relative `is_own` / `is_owned` without exposing raw creator account UUIDs.
- Added idempotent `purchase_creator_market_listing` with server-side KC settlement through existing `apply_wallet_delta`, append-only marketplace transaction record and entitlement grant.
- Added optional future platform fee configuration while defaulting to 100% creator / 0% platform.
- Added repository methods for authoritative KC wallet reads, Creator profiles, Discover, listings, purchases and entitlements.
- Added `Kelo Creator Marketplace` client service with no local wallet/listing authority.
- Added lazy Creator Library `MARKET` tab with `DISCOVER`, `MY LISTINGS`, `OWNED`, and `CREATOR PROFILE` mobile surfaces.
- Discover uses lazy public previews and metadata only; full Creator content remains on-demand.
- `MY LISTINGS` only offers revisions already found in the owner's active publications.
- Added authoritative KC balance display by active character.
- Added static contract audit `scripts/creator-marketplace-audit.mjs`.
- Added technical owner/security document `docs/systems/CREATOR_MARKETPLACE.md`.

**Files/contracts touched:**

- `supabase/migrations/20260916002500_creator_marketplace_v1.sql`
- `supabase/migrations/20260916002600_creator_marketplace_discover_v2.sql`
- `src/creators/content/supabase-content-repository.mjs`
- `src/creators/marketplace/creator-marketplace-service.mjs`
- `src/creators/ui/creator-marketplace-surface.mjs`
- `src/creators/ui/creator-library-workspace.mjs`
- `src/creators/creator-entry.mjs`
- `scripts/creator-marketplace-audit.mjs`
- `docs/systems/CREATOR_MARKETPLACE.md`
- `docs/IMPLEMENTATION_LEDGER.md`

**Deferred deliberately:**

- Runtime/server entitlement enforcement when equipping skins/weapons, placing props, using VFX/content, or otherwise consuming purchased content.
- Any real-money creator cash-out, tax/KYC/payment processor/App Store policy implementation.
- Platform marketplace fee policy; V1 remains 100% Creator KC until explicitly changed.
- Refund/chargeback/revocation policy after completed purchases.
- Creator sales analytics, ratings/reviews, favorites, ranking and featured merchandising.
- Moderation/reviewer tooling beyond the existing review/publication authority.
- Automatic seasonal listing/publishing.
- Full asset/content download/use authorization endpoint; current Discover remains preview/metadata-first.

**Acceptance / gates:**

- `node scripts/creator-marketplace-audit.mjs` passes from a runnable checkout.
- `node scripts/creator-release-center-audit.mjs` and upstream Creator OS/universal-content/docs audits remain green.
- Both marketplace migrations apply cleanly to a test Supabase environment.
- Listing an unpublished revision fails; listing another user's revision fails; payout character must belong to seller.
- Discover does not expose raw account UUIDs and returns ownership flags correctly.
- Two-account test: seller lists published content, buyer with authoritative KC buys it, buyer wallet decreases, seller payout wallet increases, `creator_market_transactions` is written and entitlement appears.
- Repeating the same correlation ID returns the same idempotent result without a second charge.
- Self-purchase, already-owned and insufficient-funds attempts fail without partial wallet changes.
- MARKET UI works on iPhone: Discover/search/thumbnail lazy load, character selection, listing, purchase, Owned and Creator Profile.
- Normal game boot remains unaffected; mandatory iPhone/LIVE gate passes before `VALIDATED`.
- `npm run audit:docs` passes.

**Evidence:**

- Branch: `creator-marketplace-v1`, stacked from `creator-release-center-v1`.
- Existing economy migration `20260910015537_kelo_economy_persistence_and_audit_foundation.sql` already provides `character_wallets`, append-only `wallet_ledger`, server audit and service-role-only wallet mutation RPC; this pass reuses it.
- Existing release authority requires service-role publication before a revision can be listed.
- Static audit was added but has not been executed in this environment; Supabase migrations and mobile/LIVE integration have not been claimed as tested.

**Next action:** run marketplace/release/Creator OS/docs audits and two-account Supabase + iPhone/LIVE flows. Fix failures on the same stacked branch. After validation, the next product pass is **Creator Entitlement Enforcement V1**: specialized runtime/server owners must require publication-owner or entitlement before equipping/placing/using paid Creator content.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-MARKET-003` on `creator-marketplace-v1`. Read `docs/systems/CREATOR_MARKETPLACE.md`, the Release/Creator OS ledger entries, the wallet/economy migration and publication authority before changing anything. Do not create local KC, a second wallet, a duplicate asset store, or a client-side ownership flag as authority. First validate both marketplace migrations, run `node scripts/creator-marketplace-audit.mjs` plus upstream audits, then execute two-account purchase/idempotency/failure tests and iPhone/LIVE MARKET flows. Keep V1 split at 100% Creator unless product policy explicitly changes it. Do not mark `VALIDATED` until all gates pass. The next architectural pass is entitlement enforcement in specialized content consumers, not another marketplace UI rewrite.

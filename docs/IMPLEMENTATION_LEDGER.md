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

---

### IMP-2026-09-15-CREATOR-ENTITLEMENT-004

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Depends on:** `IMP-2026-09-15-CREATOR-MARKET-003` / PR #273 and all upstream Creator OS/Release layers.  
**Owner(s):** `KeloCreatorEntitlements` + authoritative Supabase content ownership/entitlements; specialized runtime owners retain their own rendering/gameplay responsibilities.  
**User intent / source prompt:** Continue after Creator Marketplace so buying a character, skin, weapon, prop, mount or other Creator content actually controls whether the runtime may use it—not merely whether Marketplace UI says OWNED—while keeping one reusable rule and preserving cross-agent context.

**Why:** A marketplace entitlement has no practical security/value if specialized runtime owners can consume the paid content through another code path. The stable solution is one revision-specific access authority plus defense-in-depth adapters, not separate ownership logic in every editor/runtime.

**Invariants:**

- `PUBLISHED != LISTED != OWNED != USABLE`.
- Author ownership or an authoritative `creator_content_entitlements` row grants use; publication alone never grants use.
- Access is account-level and exact-revision by default. Buying r3 does not silently grant r4.
- Missing Creator access identity/cache fails closed for Creator content.
- Built-in/non-Creator content remains unaffected.
- No localStorage/IndexedDB ownership truth and no second Supabase client.
- Creator OS reuses its authenticated repository via `bindProvider`; fallback may reuse existing `KeloOnlineAuth`.
- Runtime Registry gates Creator records before dispatching them to existing specialized owners.
- Client gating is defense in depth only: any server-authoritative future equip/place/spawn/use mutation must independently enforce the same access rule.

**Implemented now (stacked branch `creator-entitlement-enforcement-v1`):**

- Added authoritative `list_my_creator_content_access()` and `check_creator_content_access(uuid)` RPCs.
- Added `KeloCreatorEntitlements`, an in-memory metadata-only access cache/gate.
- Added provider binding so Creator's current authenticated repository and the game's existing `KeloOnlineAuth` can share one guard without creating a third auth client.
- Universal Content Service now stamps runtime records with immutable `revisionId` UUID and `ownerUserId`.
- Creator Runtime Registry checks access before runtime adaptation; denied records become `activation.status='restricted'` instead of reaching Property/Appearance/Mount/Avatar owners.
- Registry adds `getForUse()`, `query({usable:true})`, `reactivate()` and `reactivateRestricted()`.
- Entitlement refresh emits a change event; previously restricted records can activate after a successful purchase without re-importing content.
- Marketplace purchase refreshes entitlement state after the authoritative purchase RPC succeeds.
- Appearance preserves Creator identity metadata and rechecks access inside `resolveLoadout()`; unauthorized Creator layers are omitted and reported as `restricted`.
- Mount Catalog rechecks Creator access in `get/has/list/query`; raw definition access remains explicit through `getRaw()` for diagnostics/tooling only.
- World/tile Creator content is denied at the registry boundary before a property template can be registered.
- Character adaptation is denied before `KeloCreatorAvatars.register()` when access is missing.
- Added static contract audit and technical system documentation.

**Files/contracts touched:**

- `supabase/migrations/20260916003000_creator_entitlement_access.sql`
- `src/systems/creator-entitlement-system.js`
- `src/creators/creator-entry.mjs`
- `src/creators/content/supabase-content-repository.mjs`
- `src/creators/content/universal-content-service.mjs`
- `src/creators/content/runtime-content-registry.mjs`
- `src/creators/marketplace/creator-marketplace-service.mjs`
- `src/appearance/appearance-system.js`
- `src/mounts/mount-catalog.js`
- `scripts/creator-entitlement-audit.mjs`
- `docs/systems/CREATOR_ENTITLEMENT_SYSTEM.md`
- `docs/IMPLEMENTATION_LEDGER.md`

**Deferred deliberately:**

- Server mutation endpoints for Creator `equip/place/spawn/use`; these must call the authoritative access rule before they become security boundaries.
- A global purchased-content delivery loader outside Creator OS. When added, it must initialize/reuse `KeloCreatorEntitlements` before registering Creator runtime records.
- Refund/revocation/transfer/subscription/upgrades; V1 entitlements are permanent exact-revision grants.
- Automatic entitlement migration from rN to rN+1.
- Specialized enforcement in content types that do not yet have a runtime consumer. Future consumers must use `getForUse()` / usable queries or explicitly call the guard.
- Treating client JavaScript as tamper-proof security; it is not.

**Acceptance / gates:**

- `node scripts/creator-entitlement-audit.mjs` passes from a runnable checkout.
- Upstream Marketplace/Release/Creator OS/docs audits remain green.
- Migration applies cleanly in test Supabase.
- Creator can use their own exact revision without purchasing it.
- Buyer cannot use a published/listed foreign revision before purchase.
- Buyer can use the exact purchased revision after purchase + entitlement refresh.
- A second non-entitled account remains denied.
- Buying r3 does not grant r4.
- Sign-out/account switch removes previous buyer access.
- Appearance omits unauthorized Creator layers.
- Mount Catalog hides unauthorized Creator mounts.
- Unauthorized Creator World content never registers into Property catalog.
- Built-in Appearance/Mount/World content is unchanged.
- iPhone/LIVE Creator + Marketplace flow remains stable.
- Any online server mutation test must reject a spoofed client use without entitlement before this layer can be called end-to-end secure.

**Evidence:**

- Branch: `creator-entitlement-enforcement-v1`, stacked from `creator-marketplace-v1` at `e006231b7c7a907b35e3d41d0c4cfede94c29397`.
- Static source inspection confirms Creator Marketplace entitlement rows are account-level and revision-specific.
- This environment has not executed the new Supabase migration, Node audit, Playwright, two-account integration or iPhone/LIVE test; therefore the pass remains `IMPLEMENTED_PENDING_VERIFY`.

**Next action:** run entitlement + upstream audits, apply migrations in test Supabase and execute multi-account own/pre-purchase/post-purchase/r3-vs-r4/sign-out tests. Then add authoritative server-side access checks to any online equip/place/spawn/use endpoints before calling the entire paid-content path secure. After that, the next product layer can be **Public Creator Content Delivery V1**: entitlement-aware metadata/download delivery for owned published content on normal gameplay sessions.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-ENTITLEMENT-004` on `creator-entitlement-enforcement-v1`. Read `docs/systems/CREATOR_ENTITLEMENT_SYSTEM.md`, Marketplace/Release/Creator OS ledger entries and migration `20260916003000_creator_entitlement_access.sql`. Do not add local ownership flags, a second auth client, or separate entitlement logic per content type. Run `node scripts/creator-entitlement-audit.mjs` plus all upstream audits, apply the migration in test Supabase, and test owner / pre-purchase deny / post-purchase allow / second-account deny / r3-not-r4 / sign-out. Remember that browser enforcement is defense in depth: any authoritative server mutation that uses paid Creator content must independently verify revision access. Do not mark VALIDATED until Supabase, iPhone/LIVE and server spoof-resistance gates pass.

---

### IMP-2026-09-15-CREATOR-DELIVERY-005

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Depends on:** `IMP-2026-09-15-CREATOR-ENTITLEMENT-004` / PR #275 and all upstream Creator Marketplace/Release/OS layers.  
**Owner(s):** Kelo Creator Content Delivery + Supabase publication/access authority; specialized runtime owners retain rendering/gameplay authority.  
**User intent / source prompt:** Continue after Entitlement Enforcement so owned Creator content can actually enter normal gameplay on demand without opening Creator tools, bulk-syncing the library or making iPhone boot heavier.

**Why:** Entitlement alone answers “may this account use revision rN?” but does not deliver the immutable published metadata/assets to the correct runtime owner. A scalable marketplace needs a narrow on-demand bridge from exact revision ownership to existing runtime owners.

**Invariants:**

- `PUBLISHED != LISTED != OWNED != DELIVERABLE != ACTIVE`.
- Delivery accepts one immutable revision UUID at a time; there is no login-time “download all Owned”.
- The caller must author the exact revision or own an exact-revision entitlement.
- Content must have an active `content_publication`; every bound asset must have an active `asset_publication`.
- Delivery never exposes `creator-private` paths.
- V1 uses existing `creator-global` public bytes as transport; a public URL is not license evidence.
- `KeloCreatorEntitlements` remains the access authority/cache; Delivery does not create another ownership system.
- Creator OS binds Delivery to the same authenticated repository/session. Outside Creator, fallback reuses existing `KeloOnlineAuth`.
- Manifest cache is memory-only, account-scoped and capped at 48 revisions.
- Delivery does not fetch image bytes itself; specialized owners receive URLs only after access succeeds.
- Persistent/competitive mutations remain server-authoritative and must independently check entitlement.

**Implemented now (stacked branch `creator-content-delivery-v1`):**

- Added `get_creator_content_delivery(uuid)` authority RPC returning one exact published manifest only after owner/entitlement verification.
- Delivery RPC verifies all content asset bindings are authority-published before returning their public locations.
- Added `Kelo Creator Content Delivery` client runtime with bounded identity-keyed manifest cache and per-revision inflight dedupe.
- Added normal-game `KeloCreatorDelivery.useRevision()` / `manifest()` facade through the already-loaded `creators-lazy-gate`; real Delivery code remains dynamic-import first-use.
- Delivery wakes only the specialized package required by content type (`appearance`, `mounts`, `properties`) and reuses the existing Creator Avatar adapter for characters.
- Delivery registers normalized semantic records into the existing `KELO_CREATOR_CONTENT_REGISTRY`; it does not create a renderer or duplicate asset catalog.
- Runtime Registry now rechecks access in use-facing `getForUse()`/usable queries and stamps Creator Property templates with exact revision identity.
- Added dynamic Property catalog entitlement facade so cached Creator props stop being available after logout/account switch.
- Creator Avatar runtime now checks exact-revision entitlement for local select/current/draw while preserving authority-published remote avatar rendering for multiplayer viewers.
- Upgraded `set_active_character_avatar` so a purchased published Creator character can be selected server-side; an unowned revision is rejected.
- `get_avatar_manifest` now carries revision/owner identity for local enforcement.
- Creator composition root binds Delivery to the same repository/session as Entitlements and invalidates manifest cache on Creator auth changes.
- Feature Registry can wake entitlement-aware Appearance/Mount/Property owners only on first use.
- Added static delivery contract audit and technical documentation.
- Removed an experimental duplicate Delivery facade so `creators-lazy-gate` remains the single normal-boot entry.

**Files/contracts touched:**

- `supabase/migrations/20260916003500_creator_content_delivery_v1.sql`
- `src/creators/content/creator-content-delivery.mjs`
- `src/core/creators-lazy-gate.js`
- `src/core/feature-registry.js`
- `src/creators/content/supabase-content-repository.mjs`
- `src/creators/content/runtime-content-registry.mjs`
- `src/creators/creator-entry.mjs`
- `src/property/creator-property-entitlement-guard.mjs`
- `src/characters/creator-avatar-runtime.mjs`
- `scripts/creator-content-delivery-audit.mjs`
- `docs/systems/CREATOR_CONTENT_DELIVERY.md`
- `docs/system-catalog.json`
- `docs/CODE_INDEX.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/IMPLEMENTATION_LEDGER.md`

**Deferred deliberately:**

- Byte secrecy/DRM for premium assets. V1 authority controls use, while approved bytes remain in public `creator-global`. Future private published bytes should use short-lived signed URLs behind the same Delivery manifest contract.
- Server-authoritative Creator equipment/appearance mutations.
- Server-authoritative Creator prop placement mutations.
- Server-authoritative Creator mount spawn/equip/use mutations.
- Refund/revocation/subscription/version-upgrade policy.
- Automatic rN → rN+1 entitlement upgrades.
- Bulk offline download/library pinning; mobile-first V1 is on-demand only.

**Acceptance / gates:**

- `node scripts/creator-content-delivery-audit.mjs` passes from a runnable checkout.
- Entitlement/Marketplace/Release/Creator OS/docs audits remain green.
- Migration applies cleanly to a test Supabase environment.
- Owner can deliver their own published exact revision.
- Buyer before purchase is denied.
- Buyer after purchase can deliver the exact purchased revision.
- Entitlement to r3 cannot deliver r4.
- Missing one bound `asset_publication` fails with `CONTENT_ASSET_PUBLICATION_INCOMPLETE`.
- Delivery response contains only published storage locations, never private paths.
- Logout/account switch prevents reuse of cached local Creator avatar/prop/appearance/mount metadata.
- Purchased published Creator character can be selected by `set_active_character_avatar`; unowned character cannot.
- Remote players' published Creator avatars still render to viewers without local ownership.
- Normal boot performs no bulk Owned sync or Creator asset fetch.
- iPhone/LIVE first-use Delivery loads only requested owner/assets and does not freeze gameplay.

**Evidence:**

- Branch: `creator-content-delivery-v1`, stacked from `creator-entitlement-enforcement-v1`.
- Source contracts and branch writes are present; duplicate facade was removed before PR creation.
- This environment has not executed the new migration, Node audit, two-account Supabase integration, Playwright or iPhone/LIVE flow. This pass therefore remains `IMPLEMENTED_PENDING_VERIFY`.

**Next action:** validate Delivery + upstream migrations/audits with two accounts and iPhone/LIVE. After that, the next architectural pass is **Creator Use Authority V1**: route persistent `equip/place/spawn/use` actions through server-authoritative exact-revision checks for Appearance/Equipment, Property and Mounts, reusing the same access rule rather than creating domain-specific ownership stores.

**Handoff prompt:**

> Continue `IMP-2026-09-15-CREATOR-DELIVERY-005` on `creator-content-delivery-v1`. Read `docs/systems/CREATOR_CONTENT_DELIVERY.md`, Entitlement/Marketplace ledger entries and migrations `20260916003000_creator_entitlement_access.sql` + `20260916003500_creator_content_delivery_v1.sql`. Do not bulk-sync Owned content, create another asset store/auth client, or treat `creator-global` URLs as license evidence. First run `node scripts/creator-content-delivery-audit.mjs` plus all upstream audits, apply migrations to test Supabase, then test owner/pre-purchase/post-purchase/r3-vs-r4/publication-integrity/account-switch/avatar-selection and iPhone/LIVE first-use. The next implementation layer is server-authoritative equip/place/spawn/use, not another marketplace or renderer rewrite.

# Universal Content Studio

`playerVisible: false`

## Owner

- Authoring/UI owner: `Kelo Universal Content Studio`.
- Release boundary: `Kelo Creator Release Service` from `src/creators/release/creator-release-service.mjs`.
- Semantic runtime registry: `KELO_CREATOR_CONTENT_REGISTRY` from `src/creators/content/runtime-content-registry.mjs`.
- Persistent semantic owner: Supabase `content_definitions` + immutable `content_definition_revisions`.
- Review/publication truth: Supabase `content_review_requests` + `content_publications`.
- Asset bytes remain owned by the existing Creator Asset foundation (`asset_families`, `asset_revisions`, Supabase Storage).
- Runtime owners are not replaced: `KELO_PROPERTY_CATALOG`, `KeloAppearance`, `KeloMountCatalog`, Character/VFX/etc. continue owning their own runtime behavior.

## Goal

Make Creator Studio the graphical/data-driven equivalent of authoring Kelo content in code. One phone-first pipeline accepts a spreadsheet plus referenced files and turns each row into reusable, versioned content without storing raw file paths in maps or gameplay state.

The Release Center adds a second responsibility without moving authority into the browser: show the creator's own revisions, show real server review/publication state, preview content activated in the current Creator session, and submit/re-submit revisions to review.

## Data model

`Asset` answers **which bytes?**. `Content Definition` answers **what do those bytes mean?**.

```text
content_definitions                 stable identity
  -> content_definition_revisions  immutable semantic versions
       -> content_asset_bindings    roles such as primary/idle/walk/portrait
       -> content_review_requests   pending / approved / rejected / cancelled
       -> content_publications      global / official, authority-created
```

A single definition can reference one asset (tree), many assets (character animation set), or the same asset in multiple future definitions. New `content_type` values do not require a database migration as long as they follow the stable type-key format.

## Spreadsheet contract

The existing lazy CSV/XLSX importer remains the parser. `universal-content-importer.mjs` normalizes rows into jobs.

Core columns:

- `type`, `id`, `name`
- `file`
- `file_idle`, `file_walk`, `file_run`, `file_attack`, `file_hit`, `file_death`, `portrait`
- `family`, `category`, `rig`, `slot`, `profiles`
- `species`, mount profile/ability columns
- `world_w`, `world_h`, `collision`, `layer`
- `rarity`, `tags`, `publish`

Additional asset roles may use `file_<role>`, `file.<role>`, `asset_<role>` or `asset.<role>` without changing the importer.

Aliases normalize common authoring words, e.g. `armor -> equipment`, `hair/outfit -> appearance`, `tree/prop -> world`, `hero/player -> character`.

## Phone workflow

```text
Kelo Creators
 -> Creator Library
 -> Content Studio
 -> sign in to Supabase
 -> choose CSV/XLSX from Files/Drive/iCloud
 -> choose referenced image files
 -> ANALYZE
 -> validation report per row
 -> IMPORT READY ROWS
 -> runtime preview for creator session
 -> Release Center
 -> SUBMIT REVIEW / RESUBMIT REVIEW
 -> server authority decides approval/publication
```

The browser never executes spreadsheet formulas or arbitrary code. XLSX is parsed only after explicit user action.

## Ingest pipeline

For every valid row:

1. Validate referenced local files.
2. Decode dimensions and enforce the current image asset limits.
3. SHA-256 the bytes.
4. Create/reuse an asset family for each semantic role.
5. Upload immutable bytes into `creator-private` Storage under the authenticated user prefix.
6. Register immutable `asset_revisions`.
7. Create/reuse the stable `content_definition`.
8. Hash normalized semantic payload + immutable asset revision IDs.
9. Create an immutable `content_definition_revision` plus role bindings.
10. If `publish=YES`, submit asset/content revisions to review. Browser clients cannot approve themselves.
11. Register the new semantic revision in `KELO_CREATOR_CONTENT_REGISTRY` immediately for the creator session.
12. Existing runtime owners receive adapters when their contract is already known.

## Release Center V1

`src/creators/release/creator-release-service.mjs` is a thin service over the existing online repository. It does not own a second queue or second database model.

The server-backed lifecycle exposed to creators is:

```text
INGESTED
  -> IN_REVIEW (content_review_requests.status = pending)
     -> REJECTED -> RESUBMIT REVIEW
     -> CANCELLED -> RESUBMIT REVIEW
     -> APPROVED
        -> PUBLISHED when an active content_publications row exists
```

Rules:

- `listMyContent()` is explicitly filtered to the authenticated `owner_user_id`; public content from other creators must not appear as the user's releasable content.
- Review state is read from `content_review_requests`; the UI never infers approval from a local flag.
- Publication state is read from active `content_publications` rows.
- The client can call `submit_content_revision` through the authenticated repository adapter.
- The client **cannot** call `publish_content_revision`; the migration revokes it from `public`, `anon`, and `authenticated`, and grants it only to `service_role`.
- `PUBLISHED` therefore means server evidence exists, not that a client button was pressed.
- Runtime preview is separate from publication. A creator may preview an ingested draft in their current session without making it global.

## Runtime activation V1

- `world`, `tile`: registers the image with `KELO_ATLAS_CONTRACT` and a placeable template with `KELO_PROPERTY_CATALOG` immediately.
- `appearance`, `equipment`: registers visual items through `KeloAppearance`; this covers armor, clothing, hair and outfit-style visual content when a compatible profile/slot resolves.
- `mount`: registers into `KeloMountCatalog` once required movement/equipment/appearance/ability profile IDs resolve.
- `character`, `vfx`, `item`, `audio`, `ui`, and unknown future types: the immutable semantic definition becomes live in `KELO_CREATOR_CONTENT_REGISTRY`. Specialized owners can add adapters without changing DB IDs, spreadsheet format or ingest transport.

`equipment` activation in V1 is visual/appearance registration. Inventory/stats/market authority is intentionally not invented by Creator Studio; those remain server/gameplay-owner responsibilities.

## Identity and security

Browser configuration contains only the Supabase project URL and the public `sb_publishable_*` key. No `sb_secret_*` or service-role credential may enter browser code.

Writes require an authenticated Supabase JWT. Existing RLS/RPC rules enforce ownership. Stable creator bytes use the user ID as the first Storage folder segment.

Creator-authored drafts are visible/usable by their owner. Global/official publication remains an authority operation. `publish=YES` and `SUBMIT REVIEW` mean submit for review, not bypass moderation.

## Versioning invariants

- Maps/game definitions reference immutable IDs, never Drive filenames or blob URLs.
- Replacing bytes creates a new `asset_revision`.
- Changing semantic configuration creates a new `content_definition_revision`.
- Old published revisions remain addressable.
- Runtime temporary Data URLs are presentation-only and are never persisted as identity.
- A rejected/cancelled revision can be re-submitted using the existing RPC contract; a pending/approved revision is not duplicated by the client.

## Current media boundary

The existing Creator Asset foundation currently validates PNG/WebP/JPEG up to 5 MB and 2048 px per dimension. Universal semantic schemas already include audio/UI/future types, but binary audio/ZIP ingestion must expand the existing asset-byte owner instead of creating a second storage model.

## Tests

Existing universal ingest audit:

`npm run audit:universal-content`

Release Center static authority audit:

`node scripts/creator-release-center-audit.mjs`

The release audit checks owner scoping, review/publication reads, absence of a client publish helper, migration grants/revokes, Release Center UI wiring, documentation and ledger continuity.

These static checks do **not** replace authenticated Supabase integration tests or the required mobile/LIVE Creator verification.

## Extension rule

When a new system becomes Creator-configurable:

1. reuse the same `content_definitions`/revision/binding model;
2. add/extend a schema in `content-type-schemas.mjs` only when editor hints are useful;
3. add one adapter from the universal registry to the existing runtime owner;
4. reuse Release Center for review/publication visibility;
5. never create a parallel gameplay/render/storage/review owner just to support Creator Studio.

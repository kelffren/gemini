# Creator Marketplace

`playerVisible: false` (Creator/admin surface V1)

## Owner

- Client composition/presentation: `Kelo Creator Marketplace` under `src/creators/marketplace/` + Creator Library MARKET surface.
- Persistent authority: Supabase Creator marketplace tables/RPCs.
- Currency authority: existing `character_wallets` + `wallet_ledger` (`currency_key='kc'`).
- Publication authority: existing `content_publications`.
- Identity authority: existing `profiles`, `characters`, `auth.users`; Creator profile is a one-to-one extension, not a new login/profile system.

## Core rule

```text
DRAFT != REVIEWED != PUBLISHED != LISTED != OWNED
```

A Creator listing can only reference an active `content_publication`. Buying a listing creates an account-level entitlement to a specific immutable content revision. The marketplace never copies asset bytes into a second storage model.

## Data model

- `creator_profile_details` — public Creator tagline/bio extending `profiles`.
- `creator_market_config` — authority-owned seller share + optional platform treasury character.
- `creator_market_listings` — listing metadata over one published content revision.
- `creator_market_transactions` — append-only KC settlement record.
- `creator_content_entitlements` — account-level license/ownership record for one immutable revision.

## KC settlement

V1 defaults to:

- creator share: **10000 bps = 100%**;
- platform fee: **0%**;
- no fake/client wallet.

The client sends only `listingId`, buyer character and an idempotency correlation ID. It does **not** submit trusted price or revenue split. The purchase RPC locks the listing, re-reads server price/split, validates publication and ownership, debits buyer KC through `apply_wallet_delta`, credits the creator payout character, optionally credits a configured treasury, writes the transaction and grants the entitlement in the same DB transaction.

If a future platform fee is configured without a treasury character, the purchase fails closed with `PLATFORM_TREASURY_NOT_CONFIGURED`.

## Listing lifecycle

```text
content revision
  -> approved/publication authority
  -> content_publications.is_active
  -> creator creates listing
  -> active / paused / cancelled
```

Only the content owner may create/cancel their listing, and only an active owned character may be selected as the KC payout character.

## Purchase lifecycle

```text
Discover metadata
  -> select buyer character
  -> purchase RPC
  -> validate active listing/publication
  -> reject self-purchase / already-owned
  -> authoritative KC settlement
  -> creator_market_transactions
  -> creator_content_entitlements
```

## Discover

`discover_creator_market_v2` is metadata-first. It returns:

- listing ID + immutable revision/content ID;
- content type/name/tags;
- price KC + license key;
- public Creator handle/display name/avatar/tagline;
- publication/listing timestamps;
- one public preview path when available;
- caller-relative `is_own` / `is_owned` flags.

It intentionally does not expose raw creator account UUIDs and does not preload full asset bytes.

## Creator Library UI

The top-level Library adds a lazy `MARKET` tab. The marketplace surface is imported only when that tab opens and contains:

- `DISCOVER`
- `MY LISTINGS`
- `OWNED`
- `CREATOR PROFILE`

Normal gameplay and the default CREATE view do not pay for marketplace UI/thumb loading.

## Creator profile

`creator_profile_details` extends the existing `profiles` row with:

- tagline;
- bio;
- creator_since;
- public visibility.

Handle/display name/avatar remain owned by the base profile system.

## Security / invariants

1. A client cannot list an unpublished content revision.
2. A client cannot purchase its own listing.
3. A client cannot choose the price/split at settlement time.
4. A client cannot mint KC or write wallet rows directly.
5. Purchases are idempotent by correlation ID.
6. Buyer entitlement is account-level; KC is debited from the selected owned character.
7. Asset/publication bytes remain in existing Creator asset/content owners.
8. Marketplace UI never stores balances/listings/ownership in localStorage or IndexedDB.
9. Full marketplace economics are not production-ready until entitlement checks are enforced by the relevant runtime/server owners when equipping/placing/using paid content.

## Important remaining boundary

V1 creates authoritative ownership/settlement records, but **runtime entitlement enforcement is still a separate pass**. A paid skin/weapon/prop must ultimately be rejected by its specialized gameplay/server owner if the requesting account lacks a valid entitlement. Client UI hiding alone is not security.

## Tests / audits

```bash
node scripts/creator-marketplace-audit.mjs
npm run audit:docs
```

Also required before `VALIDATED`:

- apply migrations in a test Supabase project;
- create/publish test content;
- create listing from owner account;
- fund buyer KC via trusted authority/test fixture;
- buy and verify both wallet ledgers + transaction + entitlement;
- verify retry with same correlation is idempotent;
- verify self-purchase / already-owned / insufficient funds fail;
- iPhone/LIVE Marketplace interaction and normal boot gate.

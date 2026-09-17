# Evergreen Foundation — 10-year compatibility layer

`playerVisible: false`

## Purpose

Kelo World must be able to change implementation, providers, runtime versions and content schemas for at least a ten-year horizon without requiring old published content to be rewritten by hand or forcing a second engine/runtime.

This foundation is deliberately **not** a new gameplay owner. It is a build/shared compatibility layer that reuses the existing owners already responsible for runtime migration, rollback, observability, updates, feature loading and semantic content.

## Existing owners reused

- Legacy-to-modern rollout: `src/core/migration-switchboard.js`.
- Transactional validate/apply/rollback for hot declarative data: `src/core/hot-data-registry.js`.
- Freeze/crash diagnostics: `src/core/bug-observability.mjs`.
- App update/rollback: `src/core/update-system.js`.
- Optional feature catalog: `src/core/feature-registry.js`.
- Provider adapter pattern: `server/sprite-ai-provider-huggingface.js` behind the Kelo Sprite AI service.
- Semantic content identity/revisions: Universal Content Studio + `KELO_CREATOR_CONTENT_REGISTRY`.

No duplicate manager is introduced for those responsibilities.

## New compatibility primitives

### Contract registry

`src/core/evergreen-contracts.mjs` provides dependency-free semver parsing, compatibility checks and deprecation status for public contracts. The canonical critical-contract list is `config/evergreen-contracts.json`.

A breaking public contract must use a major version and ship an adapter or migration path. Consumers must never assume a private/internal function is a permanent public API merely because it exists.

### Content schema migrations

`src/creators/content/content-schema-migrations.mjs` extends Universal Content Studio with deterministic, contiguous forward migrations.

Invariants:

- every persisted semantic record has a positive integer `schemaVersion`;
- migrations are `N -> N+1`, deterministic and side-effect free;
- `contentId` and `stableKey` cannot change during migration;
- source records are never mutated in place;
- downgrades are not implicit;
- a breaking schema release cannot become current until a complete migration path exists from every supported older schema;
- published immutable revisions remain addressable as historical evidence.

Current production schema remains version `1`; the migration engine is installed before the first breaking schema change so version `2` does not require emergency architecture work.

## Deprecation lifecycle

`config/evergreen-deprecations.json` is the canonical ledger. Public-contract removal requires at least the notice period in `config/evergreen-policy.json`, a replacement, and verification that persisted/published content no longer depends on the removed contract or has a migration/adapter.

Lifecycle:

`ACTIVE -> DEPRECATED -> MIGRATED/ADAPTED -> DEAD -> REMOVABLE`

Never `ACTIVE -> DELETE -> fix what breaks`.

## Dependency reproducibility

The policy requires lockfiles for both `/` and `/server`. `.github/workflows/evergreen-lockfiles.yml` can generate/refresh them in GitHub Actions, keeping the workflow usable from mobile without requiring a local computer. CI should use `npm ci` once locks exist.

Dependabot remains the update discoverer; lockfiles make those updates reviewable and reproducible instead of resolving a different transitive tree on each installation.

## Supply-chain record

`.github/workflows/evergreen-sbom.yml` produces CycloneDX SBOM artifacts for root and server dependency graphs after a frozen install. This is evidence/audit output; it does not alter gameplay.

## CI gate

`scripts/evergreen-foundation-audit.mjs` verifies:

- ten-year policy exists;
- Node runtime policy stays aligned;
- canonical reused owners still exist;
- contract catalog parses and versions are valid;
- content migration identity/immutability invariants;
- deprecation notice rules;
- root/server lockfiles;
- Dependabot and Evergreen CI remain wired.

Workflow: `.github/workflows/evergreen-foundation.yml`.

## Online-first boundary

The compatibility layer owns **formats and migration rules, not authoritative decisions**. A server-authoritative system may migrate a payload before validation, but the migration function never grants ownership, currency, damage, inventory or publication authority.

## Extension checklist

When changing a long-lived public format or API:

1. identify the existing owner;
2. update the contract version in `config/evergreen-contracts.json`;
3. if schema-breaking, add a deterministic `N -> N+1` migration;
4. keep stable IDs immutable;
5. add a deprecation entry before removing old public behavior;
6. preserve provider calls behind the owner adapter boundary;
7. run `node scripts/evergreen-foundation-audit.mjs`;
8. run the affected owner/domain audits;
9. for player-visible runtime changes, run the required iPhone/Playwright LIVE gates before claiming verified.

## Debt / next migrations

The foundation does not automatically convert every historical domain record to an explicit schema envelope. Domains should adopt `schemaVersion` when their next persisted/public contract changes, rather than performing a risky mass rewrite solely for aesthetics.

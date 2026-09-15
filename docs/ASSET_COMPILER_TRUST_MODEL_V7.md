# Kelo Asset Compiler V7 — Trust Model

## Goal
Turn untrusted, often AI-generated images into game-ready assets without treating AI confidence as correctness. The compiler is fail-closed: rejection or quarantine is acceptable; freezing the editor, publishing partial state, silently changing semantics, or bypassing evidence gates is not.

## Core rule
**AI may propose. Deterministic evidence, measured runtime evidence, or explicitly bounded human review decides.**

AI is never authoritative for: file safety, memory budgets, integrity, reproducibility, runtime validity, collision, portal passability, pivot/footprint geometry, or publication.

## Trust layers

### 0. Source evidence
Record source type, declarant, license evidence where applicable, generator/model/version, and transformation lineage. Visual AI must never claim ownership or legal permission from pixels alone.

### 1. Untrusted byte boundary
Before browser/native decoding:
- verify magic/container structure;
- resolve dimensions from the actual container;
- enforce compressed bytes, dimensions, pixel count and decoded-memory ceilings;
- reject animation by default;
- reject MIME/magic mismatch and inconsistent container lengths.

Target backend: a memory-safe, isolated decoder. Wuffs/Wasm is preferred for untrusted still-image decoding. Browser decoding remains a compatibility fallback behind the same preflight boundary until the sandbox backend is production-ready.

### 2. Hard isolation
Long-running or CPU-bound untrusted work must execute outside the UI thread. A dedicated Worker is created per isolated task and terminated on timeout. Promise/AbortSignal cancellation alone is not considered a hard CPU boundary.

Future target: WebAssembly Component Model/WASI backend with only the capabilities explicitly imported by the decoder/optimizer component.

### 3. Canonical pixels
Normalize color-space policy, alpha mode, transparent RGB, dimensions and pixel representation before analysis. Security and geometry stages consume canonical pixels, not model-generated descriptions.

### 4. Deterministic compiler
Existing Kelo stages remain responsible for measurable foreground/layout/rig/frame normalization, anchors, collision/portal geometry, atlas layout and validation. Outputs are versioned and content-addressed.

### 5. AI advisory oracles
Segmentation, depth, semantic labels, layer suggestions and repair suggestions are advisory. Oracle descriptors must pin provider/model/version and prompt-policy hash. `latest`, `auto` and equivalent moving aliases are forbidden.

A new oracle version runs in shadow mode against a labelled/golden corpus. Promotion is never automatic and does not grant release authority.

### 6. Evidence authority
Every release decision is assembled from typed evidence. Locked domains require deterministic passing evidence. An AI result marked authoritative in a locked domain is itself a release violation.

### 7. Human review
Human review resolves subjective ambiguity (style, taxonomy, semantic intent and explicitly reviewable interpretation). It cannot override unsafe containers, decoded-memory limits, integrity failures, blocking defects, or failed runtime canaries. Those require a corrected/regenerated source or compiler fix.

### 8. Atomic publication
All outputs are staged. Publication is a single transaction after every required gate passes. Failure rolls back staged outputs. Late/stale jobs cannot publish.

### 9. Reproducibility and regression
Fingerprint source bytes + normalized config + compiler version. Compare structural output and canonical pixel hashes where available. Maintain golden visual regressions. A compiler change should be shadow-tested before becoming the default.

### 10. Real-device canary
AI cannot predict browser/GPU behavior. Collect real measurements for target classes (especially iPhone): decode time, texture upload time, first render, memory, context loss, upload failure and render errors. Gate rollout on sample coverage and configured p95 budgets.

### 11. Adversarial testing
Keep example tests, but add generated/property/chaos cases for malformed containers, extreme dimensions, alpha/pathological pixel data, cancellation, supersession, transaction rollback, ledger tampering, backend trust and runtime failure. Every discovered failure becomes a permanent regression fixture.

### 12. Provenance and signing
C2PA can describe media provenance/AI disclosure. SLSA/in-toto can describe how build artifacts were produced. Sigstore can sign and transparently log release artifacts. These prove lineage/integrity, not artistic quality or runtime safety; normal release gates still apply.

## Backend trust levels
- `untrusted`: never allowed to own a release decision.
- `advisory`: AI/heuristic suggestion only.
- `validated`: deterministic implementation with tests, but not a security sandbox by itself.
- `sandboxed`: isolated implementation suitable for untrusted security-boundary work, subject to its declared capabilities.

A browser Worker provides kill isolation, not capability security: it may still have ambient web APIs. A Wasm Component/WASI backend is the intended capability-restricted boundary.

## Non-negotiable invariants
1. An invalid/unresolved container never reaches expensive decode.
2. A failed security/integrity/runtime gate never commits an asset.
3. AI cannot approve a locked domain.
4. Hard failures cannot be human-overridden.
5. Superseded/late jobs cannot publish.
6. Timeout-bounded isolated tasks are terminable.
7. Same pinned input/config/compiler must produce the same canonical structural result; canonical pixel hashes are compared when available.
8. Model/provider upgrades are explicit and shadow-tested.
9. Provenance is append-only/tamper-evident where cryptography is available.
10. Runtime performance claims come from measurements, not model estimates.

## Rollout stages
`experimental -> shadow -> canary -> default -> deprecated`

A new compiler/oracle/backend cannot skip directly to `default`. Shadow compares outputs without publishing. Canary limits exposure and measures runtime. Rollback must preserve the previous known-good compiler/profile.

## Current V7 implementation
Implemented on `feature/asset-compiler-hardening-v7`:
- container preflight and decoded-memory limits;
- deterministic fingerprint and metadata migration surface;
- cancellable/stale-safe jobs plus dedicated-worker hard-timeout client;
- atomic transaction gates;
- authority policy and release evidence;
- tamper-evident SHA-256 verification ledger;
- AI suggestion sanitizer;
- bounded human review/quarantine;
- backend trust/capability registry;
- pinned AI oracle + shadow promotion gate;
- real-device canary evaluator;
- source/right-evidence attestation workflow;
- atlas/mip/runtime-budget helpers;
- visual/temporal/AI-artifact quality checks;
- deterministic and adversarial CI audits.

## Deliberately not claimed yet
- Wuffs/Wasm is researched and selected as a target but not yet vendored into the production bundle.
- KTX2/Basis encoding is exposed through an adapter contract, not yet a mandatory encoder.
- C2PA/SLSA/Sigstore signing/attestations are not yet wired to production release infrastructure.
- Real-device canary logic exists, but trustworthy gates require actual device measurements.
- No system can promise zero bugs. The design goal is bounded blast radius, deterministic failure, rapid diagnosis and safe rollback.

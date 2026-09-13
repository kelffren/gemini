## What changed

<!-- Describe the smallest user-visible or architectural change. -->

## Validation state

- [ ] Deterministic/local tests passed
- [ ] Relevant PR release gate passed on the exact candidate SHA
- [ ] Real-device evidence attached when this affects mobile/user-facing behavior
- [ ] No required gate is red, skipped, cancelled, timed out, or missing

For World / Studio / Creator mobile changes:

- [ ] `KELO RELEASE GATE / World real iPhone` is green before merge

## Completion language

Do **not** call this PR `fixed`, `done`, `validated`, or `working` merely because it merged or deployed.

Use the status vocabulary from `docs/RELEASE_VALIDATION_GATE.md`:

`CODE COMPLETE -> PR CANDIDATE -> PR VERIFIED -> MERGED / LIVE UNVERIFIED -> LIVE VERIFIED`

A deployed user-facing change is only considered fixed after its post-deploy LIVE gate passes.

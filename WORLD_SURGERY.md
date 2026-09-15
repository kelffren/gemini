# World Surgery Control

Diagnostic infrastructure for isolating World Editor freezes without deleting modern code.

## Entry point

Open **Creators → BUILD → 🩺 CIRUGÍA** before opening World.

The Surgery panel is intentionally independent from Studio mount. Its settings persist in `localStorage` on the device so a configuration survives a reload or WebContent crash whenever Safari preserves local storage.

## Safety model

- Default preset: `ALL_CURRENT` — existing behavior remains enabled.
- VITAL modules cannot be disabled from the normal panel.
- ISOLATABLE and OPTIONAL modules can be disabled without deleting their implementation.
- On iPhone, individually disabled productivity modules are skipped before dynamic `import()`.
- Paint Copies OFF returns a no-op tool before registering its input context, key listener, MutationObserver, or Studio DOM button.

## Evidence labels

Device/result reporting must use:

- `HEADLESS PASS`
- `MOBILE EMULATION PASS`
- `REAL IPHONE PASS`
- `REAL IPHONE FAIL`
- `UNKNOWN`

A headless or emulated pass never proves an iPhone freeze fixed.

## Flight Recorder

For instrumented module boundaries the recorder persists:

- `START` module / phase / timestamp
- `DONE` module / phase / duration
- `FAILED` module / phase / error
- World boot heartbeat (400 ms)
- last started module
- last completed module
- last heartbeat

If a device dies after START and before DONE, the next Surgery-panel opening exposes that module as the current `SUSPECT`. This is evidence for narrowing the search, not automatic proof of causality.

## Presets

- `SAFE_CORE`
- `NO_OPTIONAL`
- `NO_ASSETS`
- `NO_STORAGE`
- `NO_IMPORT_CURRENT`
- `NO_PRODUCTIVITY`
- `NO_PAINT_COPIES`
- `ALL_CURRENT`
- `CUSTOM` (created by manual toggles / bisect)

## Auto Bisect

Auto Bisect halves the non-vital candidate set. After each device test mark only one result:

- `✅ FUNCIONA`
- `💀 FREEZE`

It continues until one primary suspect remains. Always reproduce the final suspect ON/OFF manually before calling it causal.

## Historical reference

Historical boot/mount boundary found by bisect:

- GOOD: `ea14e48426ac20aff44da009f0d615d8562cf7cd`
- first BAD: `c13cceafecd4edc9144a99a108eb2851f88a7541` — `studio: make paint copies interactive`
- later mitigation: `51bd0453876296e1548b70e38f89338bfdb05f9a` — `fix(studio): stop Paint Copies DOM mutation storm`

Paint Copies is therefore marked as a historical high-risk module, not presumed to be the current culprit.

## Production rule

Do not interpret the existence of this diagnostic UI as permission to roll back World. The purpose is to isolate the smallest failing boundary while preserving current World functionality and later re-enable every healthy module.

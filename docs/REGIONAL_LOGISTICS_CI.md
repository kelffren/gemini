# Regional Logistics CI Gate

Workflow: `.github/workflows/regional-logistics-ci.yml`.

Required commands:

- `npm ci`
- `npm run audit:logistics`
- `npm run audit:docs`

A failing deterministic domain check must block completion until corrected.

# Turbo Update — Hosting Evidence

Status: **BLOCKED_BY_CURRENT_HOST**

This file is evidence, not a waiver. Turbo Update MUST NOT be declared complete from configuration or intent alone.

## Current production host

Current deployment path is GitHub Pages (`pages build and deployment`). GitHub Pages owns edge response headers and transport negotiation. This repository cannot force arbitrary `Cache-Control` rules per path, cannot force Brotli/Gzip selection, and cannot force HTTP/3/CDN behavior from application code.

HOSTING_HEADERS_VERIFIED: false
COMPRESSION_VERIFIED: false
TRANSPORT_VERIFIED: false

HOSTING_LIMITATION: GitHub Pages does not expose repository-controlled per-path response header rules required to prove immutable hashed assets plus explicit HTML/version/manifest revalidation, and protocol/compression behavior is platform-controlled.
MIGRATION_PLAN: Deploy the same built static output to a header-controllable edge host (Cloudflare Pages is the preferred target), apply `public/_headers`, validate live responses for HTML/version/manifests and hashed assets, validate Content-Encoding br/gzip, record negotiated HTTP/2 or HTTP/3, then change the three VERIFIED flags above only from captured live evidence.

## Required live acceptance evidence

TU-09 is accepted only when live responses prove:

- content-hashed JS/CSS/assets: `Cache-Control: public, max-age=31536000, immutable`;
- `index.html`, `version.json`, update manifests and service-worker control files: `Cache-Control: no-cache, max-age=0, must-revalidate` or stricter equivalent;
- the tested URLs are the actual production URLs.

TU-10 is accepted only when live responses prove at least one supported compression encoding (`br` preferred, `gzip` fallback) for compressible production assets using `Accept-Encoding` negotiation.

TU-11 is accepted only when live production evidence records HTTP/2 or HTTP/3 and the serving CDN/edge. A limitation + migration plan keeps the contract honest but does **not** convert TU-09/TU-10 into PASS.

## Migration configuration staged in repository

`public/_headers` is the target edge-host policy. It is intentionally **not evidence of current GitHub Pages behavior**. The guardian must require the VERIFIED flags plus live evidence before marking hosting guarantees complete.

## Verification commands after migration

```bash
curl -sSI https://PRODUCTION_HOST/index.html
curl -sSI https://PRODUCTION_HOST/version.json
curl -sSI https://PRODUCTION_HOST/PATH_TO_HASHED_ASSET.js
curl -sSI -H 'Accept-Encoding: br,gzip' https://PRODUCTION_HOST/PATH_TO_HASHED_ASSET.js
curl -sS -o /dev/null -w '%{http_version}\n' https://PRODUCTION_HOST/
```

Record the exact production host, tested URLs, timestamp, response headers, content encoding and negotiated HTTP version in this file before changing any VERIFIED flag.

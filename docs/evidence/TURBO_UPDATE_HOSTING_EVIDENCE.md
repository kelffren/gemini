# Turbo Update — Hosting Evidence

Status: **BLOCKED_BY_EXTERNAL_HOSTING**

This file is evidence, not a waiver. Turbo Update MUST NOT be declared complete from configuration, comments, provider promises, or unverified code alone.

## Current production host

Current deployment path is GitHub Pages (`pages build and deployment`). GitHub Pages owns edge response headers and transport negotiation. This repository cannot force arbitrary `Cache-Control` rules per path, cannot force Brotli/Gzip selection, and cannot force HTTP/3/CDN behavior from application code.

HOSTING_HEADERS_VERIFIED: false
COMPRESSION_VERIFIED: false
TRANSPORT_VERIFIED: false

HOSTING_LIMITATION: GitHub Pages does not expose repository-controlled per-path response header rules required to prove immutable hashed assets plus explicit HTML/version/manifest revalidation, and protocol/compression behavior is platform-controlled.
MIGRATION_PLAN: Deploy the tested Turbo host to a header-controllable public host (Netlify/Render/Cloudflare-class edge host), validate live responses for HTML/version/manifests and hashed assets, validate Content-Encoding br/gzip, record negotiated HTTP/2 or HTTP/3, then change the three VERIFIED flags above only from captured live evidence.

## 2026-09-14 execution evidence

The repository now contains `scripts/turbo-host-server.mjs`, which implements the required server-side policy and derives `/version.json` from the deployed commit (`RENDER_GIT_COMMIT`/`GITHUB_SHA`) instead of trusting a hand-written build identity.

The repository also contains `scripts/turbo-host-integration-test.mjs`. Turbo Update Guardian builds the real hashed production output, launches this host, and makes HTTP requests against it. The test fails unless all of these are observed from the running server:

- `index.html` => `Cache-Control: no-cache, max-age=0, must-revalidate`;
- `version.json` => the same revalidation policy;
- a real content-hashed production JS output => `Cache-Control: public, max-age=31536000, immutable`;
- `Accept-Encoding: br,gzip` => Brotli response;
- `Accept-Encoding: gzip` => gzip response;
- server/internal source paths are not publicly served.

This proves the host implementation behavior but is intentionally **not** treated as live-production hosting evidence.

### External deployment attempt

A Render web service was requested from the connected workspace using the live `kelffren/gemini` `main` repository, with production build and `scripts/turbo-host-server.mjs` as the start command. Render returned an HTTP 500 and no new service was created. Inspection of the connected workspace showed the existing Render web services, including `kelo-world-server`, suspended by `billing`. Therefore publication to Render is currently an external account/hosting blocker rather than a repository-code blocker.

A Netlify connector has been surfaced as an alternate deploy path. Connecting it requires explicit account authorization by the user; until a public host is successfully deployed and probed, the VERIFIED flags above remain false.

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

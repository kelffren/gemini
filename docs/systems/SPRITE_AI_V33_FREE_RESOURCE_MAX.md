# Sprite AI V3.3 — Free Resource Max

## Goal

Maximize useful sprite output while staying inside the free-first architecture. No silent paid fallback, no quota circumvention, no provider secrets in browser code.

## Confirmed external limits (2026-09-16)

Hugging Face ZeroGPU currently gives a Free account about 5 minutes of included daily GPU quota, resetting 24 hours after first GPU usage. Free personal accounts in good standing can host up to 2 ZeroGPU Spaces. `large` uses 48 GB VRAM at 1x quota cost; `xlarge` uses 96 GB at 2x quota cost. Shorter declared GPU durations improve queue priority. ZeroGPU is Gradio/PyTorch oriented.

These are provider limits, not Kelo guarantees. The server must treat its own budget counters as estimates because Hugging Face does not expose exact remaining GPU seconds through the current Kelo integration.

## Resource architecture

### Space A — identity/master

`deploy/huggingface-sprite-ai/`

Responsibilities:
- canonical master character
- rotations / legacy atlas candidate
- semantic repair fallback

### Space B — real pose

`deploy/huggingface-sprite-pose/`

Responsibilities:
- OpenPose-style structural conditioning
- IP-Adapter identity guidance
- one direction row at a time
- batched generation

Target hardware is ZeroGPU `large`, not `xlarge`.

## V3.3 optimizations

### 1. One diffusion call per direction row

The pose Space batches frame prompts and ControlNet images instead of invoking SDXL once per frame. Batch inference increases GPU utilization and removes repeated pipeline overhead.

### 2. Three unique walk frames on first pass

Walk draft mode generates frames 0, 1 and 2 on GPU and builds the four-frame loop locally as `0 → 1 → 2 → 1`. If Frame Doctor rejects the row, repair mode automatically generates four unique frames.

This makes the cheap path the default while retaining a higher-quality escalation path.

### 3. Adaptive quality

Draft:
- 384×384 working resolution
- 12 denoising steps
- 3 unique GPU frames for walk

Repair retry:
- 448×448 working resolution
- 16 denoising steps
- 4 unique GPU frames

The final Kelo compiler still normalizes frames to the game format.

### 4. Exact-request cache

`server/sprite-ai-resource-governor.js` hashes the generation request. Image data URLs are represented by SHA-256 digests in the cache key instead of duplicated raw content.

Cache is isolated by authenticated Kelo user. A generated image belonging to one user can never be returned as another user's cache hit.

### 5. In-flight deduplication

Two identical requests from the same user share one pending provider call. Repeated taps or retry races no longer multiply GPU use.

### 6. Memory limits

Default server cache:
- 32 entries
- 64 MiB approximate image payload
- 6 hour TTL
- maximum cached single result: 8 MiB

LRU-style eviction keeps the free Render server bounded.

### 7. Soft daily budget

Kelo tracks estimated GPU seconds per authenticated user over a 24-hour window.

Default:
- ZeroGPU reference quota: 300 seconds
- Kelo soft target: 270 seconds
- 30-second reserve
- enforcement disabled until real measurements are collected

The estimate is shown in generation metadata. This is a planning signal, not a claim about Hugging Face's exact remaining quota.

### 8. 24 requests/hour

The old 4/hour API limit could not complete an eight-direction V3 character. The authenticated Sprite AI route now defaults to 24/hour. GPU quota and resource governance remain the expensive-resource controls.

## Escalation policy

1. deterministic browser repair
2. compiler geometry repair
3. cached result reuse
4. draft GPU generation
5. targeted row retry
6. higher-quality GPU repair
7. stop when free quota is exhausted

Never regenerate the full atlas for one bad row when a row-level repair can solve it.

## What we intentionally do not do

- Do not rotate between anonymous/authenticated pools to evade provider quota.
- Do not automatically buy Hugging Face credits.
- Do not silently fall back to OpenAI paid generation.
- Do not require `xlarge` unless future measured evidence proves `large` cannot run the pipeline.
- Do not claim the soft budget equals the provider's billing meter.

## Next measurement gate

After both Spaces are deployed, record for every real generation:
- provider queue/wall time
- quality tier
- working resolution
- unique GPU frames
- cache hit / dedupe / GPU call
- Frame Doctor result
- whether a retry was needed

After at least 30 real direction rows, tune draft resolution, steps and estimated GPU-second weights from measured results rather than guesses.

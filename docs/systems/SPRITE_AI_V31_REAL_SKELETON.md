# Sprite AI V3.1 — Real Skeleton Conditioning

## Goal

Replace prompt-only pose hints with an actual structural image condition while preserving the V3 identity-first architecture.

PixelLab's public workflow separates reference identity, skeleton/keypoints, generation and local repair. V3.1 mirrors that separation without claiming to reproduce PixelLab's private model weights.

## Architecture

```text
Master / directional reference
        ↓ identity
     IP-Adapter
        +
Kelo biped-v2 joints
        ↓
OpenPose-style control-map renderer
        ↓ structure
SDXL + OpenPose ControlNet
        +
pixel-art LoRA
        ↓
4-frame directional row candidate
        ↓
Image Treatment
        ↓
Frame Doctor
        ↓
selective repair / atlas composition
```

## Why a dedicated pose Space

The existing FLUX.2 Klein Space remains useful for character creation and broad rotation generation. Real pose control has different model requirements, so V3.1 uses a separate provider boundary instead of forcing incompatible ControlNet weights into the FLUX pipeline.

The pose Space is intentionally independent:

- `deploy/huggingface-sprite-ai/` — master/rotation/general V3 generation;
- `deploy/huggingface-sprite-pose/` — real skeleton directional generation.

The Kelo server hides that split from the browser.

## Server contract

Public browser authority remains:

`POST /api/sprite-generate`

A real-skeleton direction request uses:

```json
{
  "pipeline": "identity-skeleton-v3",
  "mode": "direction",
  "realSkeleton": true,
  "direction": "SW",
  "action": "walk",
  "sourceImageDataUrl": "data:image/png;base64,...",
  "poseTemplate": {
    "schema": "kelo-biped-v2",
    "frames": []
  }
}
```

The server routes this to `KELO_SPRITE_AI_HF_POSE_SPACE` through `server/sprite-ai-provider-pose-huggingface.js`.

If real skeleton is explicitly requested and the pose backend is unavailable, the request fails. It does not silently return a semantic-prompt pose and call that equivalent.

## Skeleton schema

`kelo-biped-v2` uses normalized 0..1 cell coordinates and includes:

- head / neck;
- shoulders;
- elbows;
- hands;
- chest / hips;
- left/right hip;
- knees;
- feet.

The compiler owns these abstract joints. Provider-specific conversion to an OpenPose-style image happens only inside the pose Space.

This keeps future migration to another structural-control model possible without rewriting the editor or animation data.

## Current open stack

Reference implementation:

- SDXL base for image generation;
- `xinsir/controlnet-openpose-sdxl-1.0` for structural pose control;
- `h94/IP-Adapter` for image-reference identity conditioning;
- `ntc-ai/SDXL-LoRA-slider.pixel-art` as a lightweight pixel-art bias.

No model weights are committed to the Kelo repository.

## Rollout

Default:

```text
KELO_SPRITE_AI_REAL_SKELETON=0
```

Required before enabling globally:

1. Deploy an actual Hugging Face pose Space.
2. Confirm all models load inside available ZeroGPU memory.
3. Generate the same character/seed across semantic V3 and real-skeleton V3.1.
4. Run Frame Doctor identity/head/weapon/motion checks.
5. Verify all 8 directions.
6. Verify 64px reduction and background cleanup.
7. Confirm no provider token reaches browser code.
8. Only then set `KELO_SPRITE_AI_REAL_SKELETON=1`.

## Failure policy

- No silent paid fallback remains the default.
- No silent downgrade from requested real skeleton to prompt-only pose.
- GPU output is never automatically considered a publishable asset.
- Frame Doctor and compiler remain final technical authority.

## CI

`.github/workflows/sprite-ai-smoke.yml` validates:

- Node syntax for Sprite AI server modules;
- deterministic server smoke tests;
- Python syntax for both Hugging Face Space apps.

Real GPU inference is a separate deployment gate and cannot be replaced by syntax/smoke coverage.

## Known limitations

- The current control-map renderer uses Kelo's own normalized joints rather than estimating OpenPose from a user sprite.
- Identity quality depends on IP-Adapter strength and reference quality.
- Real ZeroGPU memory/runtime compatibility is not proven until the Space is deployed.
- Pixel-art appearance still requires deterministic post-processing and may need a future Kelo-specific LoRA trained from approved assets.

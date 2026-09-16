---
title: Kelo Sprite Pose
emoji: 🦴
colorFrom: indigo
colorTo: blue
sdk: gradio
python_version: 3.12
app_file: app.py
pinned: false
---

# Kelo Sprite Pose — Real Skeleton Space

This is the dedicated pose-generation backend for Kelo Sprite AI V3.1.

It does one job: generate a **single four-frame directional animation row** from a canonical character reference plus a normalized Kelo skeleton sequence.

## Pipeline

```text
Kelo master character
  + Kelo normalized joints (4 poses)
      ↓
OpenPose-style control-map renderer
      ↓
SDXL + xinsir OpenPose ControlNet
      + IP-Adapter reference identity
      + lightweight pixel-art LoRA
      ↓
4 independently pose-conditioned frames
      ↓
512×128 candidate row
      ↓
Kelo Image Treatment + Frame Doctor + atlas composer
```

## Models

- Base: `stabilityai/stable-diffusion-xl-base-1.0`
- Pose authority: `xinsir/controlnet-openpose-sdxl-1.0`
- Identity reference: `h94/IP-Adapter` (`ip-adapter_sdxl.bin`)
- Pixel-art bias: `ntc-ai/SDXL-LoRA-slider.pixel-art`

The pose ControlNet and the pixel-art LoRA are open model components. Check every upstream model license before production distribution; this directory does not redistribute weights.

## Gradio contract

Endpoint: `/generate_pose`

Inputs, in order:

1. character prompt
2. master-character image data URL
3. seed
4. direction (`N, NE, E, SE, S, SW, W, NW`)
5. action
6. Kelo skeleton JSON
7. style hint
8. retry hint

Outputs:

1. PNG data URL containing a 4×1 row
2. preview image
3. metadata JSON

## Skeleton schema

The current client schema is `kelo-biped-v2`. Coordinates are normalized to one sprite cell, from `[0,0]` top-left to `[1,1]` bottom-right. The Space converts those joints into an OpenPose-like colored control image.

The important joints are:

`head, neck, leftShoulder, rightShoulder, leftElbow, rightElbow, leftHand, rightHand, hips, leftHip, rightHip, leftKnee, rightKnee, leftFoot, rightFoot`.

## Server integration

Configure the Kelo server only — never GitHub Pages/browser JavaScript:

```text
KELO_SPRITE_AI_HF_POSE_SPACE=<hf-user>/<pose-space>
KELO_SPRITE_AI_HF_POSE_API_NAME=/generate_pose
KELO_SPRITE_AI_REAL_SKELETON=1
HF_TOKEN=<optional server-only token>
```

`KELO_SPRITE_AI_REAL_SKELETON=0` remains the safe rollout default until a real Space has passed end-to-end QA.

A request can opt in before global rollout using:

```json
{
  "pipeline": "identity-skeleton-v3",
  "mode": "direction",
  "realSkeleton": true
}
```

When real skeleton conditioning is explicitly requested and the pose Space is not configured, Kelo returns an error. It does **not** silently downgrade to semantic prompt-only pose control.

## Validation gate

A successful GPU response is still only a candidate. Kelo's deterministic local pipeline must validate identity drift, clipping, baseline, silhouette, motion continuity and other Frame Doctor checks before composing or publishing the final atlas.

## ZeroGPU deployment

This Space is intended for Hugging Face `zero-a10g` hardware. `spaces` is imported before torch/diffusers and GPU work is wrapped in `@spaces.GPU`; model placement at module scope follows the current ZeroGPU loading model.

## Status

**Prepared, not yet proven LIVE.** Real ZeroGPU model load/inference must pass in an actual Hugging Face Space before `KELO_SPRITE_AI_REAL_SKELETON=1` becomes the production default.

---
title: Kelo Sprite AI Free
emoji: 🎮
colorFrom: indigo
colorTo: yellow
sdk: gradio
python_version: 3.12
app_file: app.py
pinned: false
---

# Kelo Sprite AI · Free ZeroGPU

Reference Hugging Face Space for the existing Kelo Sprite Factory backend.

## What it does

- Uses `black-forest-labs/FLUX.2-klein-base-4B`.
- Loads `Leon1000/pixel_spritesheet_4walk_small_lora_v1`.
- Generates one cardinal 4x4 sheet and one diagonal 4x4 sheet.
- Reorders the eight rows into Kelo's canonical `N, NE, E, SE, S, SW, W, NW` 4x8 atlas.
- Returns a PNG data URL through the Gradio `/generate` API.
- Leaves background cleanup, 64x64 normalization, geometry repair and per-frame QA to Kelo's existing Sprite Compiler.

This is an **experimental open-weight V1**, not a claim of PixelLab parity. The public LoRA was trained primarily for four cardinal directions; diagonal generation is a second reference-conditioned pass and must be judged by Kelo QA. Failed frames should be regenerated selectively rather than trusting the raw model output.

## Deploy from a phone

1. Create a new Hugging Face **Gradio** Space.
2. In Space Settings choose **ZeroGPU** hardware.
3. Copy this folder's `README.md`, `app.py` and `requirements.txt` into the Space.
4. Wait for the Space to build and confirm the UI can generate an atlas.
5. In the Kelo server environment set:

```text
KELO_SPRITE_AI_PROVIDER=huggingface
KELO_SPRITE_AI_HF_SPACE=<your-hf-user>/<your-space-name>
KELO_SPRITE_AI_HF_API_NAME=/generate
HF_TOKEN=<optional server-only HF token>
KELO_SPRITE_AI_ALLOW_PAID_FALLBACK=0
```

A token is optional for a public Space, but authenticating the server call lets Hugging Face apply the account's ZeroGPU allowance instead of the smaller unauthenticated allowance. Never put `HF_TOKEN` in GitHub Pages, browser JavaScript or localStorage.

## API contract

The Gradio endpoint accepts, in order:

1. `subject_prompt` — character/style text assembled by Kelo server.
2. `source_image_data_url` — optional cleaned PNG/WebP/JPEG reference image.
3. `seed` — `0` means random; positive values are deterministic inputs.
4. `retry_hint` — targeted feedback from Kelo Frame Doctor.

The first output is a PNG data URL. Extra outputs are only for the Space preview and debugging.

## Free-tier reality

ZeroGPU is shared infrastructure with daily GPU quotas. It is ideal for development and low-volume authoring, but it is not unlimited production compute. Kelo therefore keeps provider selection behind one server API so a future self-hosted GPU, another open provider or a paid provider can replace the inference layer without changing the Creator UI or compiler.

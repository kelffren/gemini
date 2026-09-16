# KELO-INDEX
# area: DEPLOY / SPRITE AI
# owner: Kelo Sprite AI compatible Hugging Face Space
# purpose: generate one 4x8 candidate atlas from two FLUX.2 Klein + sprite-LoRA passes for Kelo compiler QA
# online: exposed only through Gradio /generate; Kelo server remains the credential/rate-limit boundary
# do-not: no gameplay state, no Kelo auth, no provider secrets in returned payload

import base64
import io
import random
import re

import spaces  # ZeroGPU requires this before torch/diffusers.
import gradio as gr
import torch
from diffusers import DiffusionPipeline
from PIL import Image

BASE_MODEL = "black-forest-labs/FLUX.2-klein-base-4B"
LORA_MODEL = "Leon1000/pixel_spritesheet_4walk_small_lora_v1"
CELL = 128
SHEET = 512
MAX_SEED = 2**31 - 1

# Hugging Face ZeroGPU emulates CUDA during startup; loading on cuda here is the
# documented fast path and avoids reloading the 4B model for every request.
pipe = DiffusionPipeline.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16)
pipe.load_lora_weights(LORA_MODEL)
pipe.to("cuda")


def _decode_reference(data_url: str):
    value = (data_url or "").strip()
    if not value:
        return None
    match = re.match(r"^data:image/(?:png|webp|jpeg);base64,(.+)$", value, re.I | re.S)
    if not match:
        raise gr.Error("Reference image must be a PNG/WebP/JPEG data URL.")
    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)), validate=True)
    return Image.open(io.BytesIO(raw)).convert("RGB").resize((SHEET, SHEET), Image.Resampling.LANCZOS)


def _to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _row(sheet: Image.Image, index: int) -> Image.Image:
    top = index * CELL
    return sheet.crop((0, top, SHEET, top + CELL))


def _compose(cardinal: Image.Image, diagonal: Image.Image) -> Image.Image:
    # LoRA training order for the cardinal pass is S, W, E, N.
    cardinal_rows = {"S": 0, "W": 1, "E": 2, "N": 3}
    # The second pass is explicitly prompted in this order.
    diagonal_rows = {"NE": 0, "SE": 1, "SW": 2, "NW": 3}
    order = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    atlas = Image.new("RGB", (SHEET, SHEET * 2), (255, 255, 255))
    for target_row, direction in enumerate(order):
        if direction in cardinal_rows:
            source = _row(cardinal, cardinal_rows[direction])
        else:
            source = _row(diagonal, diagonal_rows[direction])
        atlas.paste(source, (0, target_row * CELL))
    return atlas


def _cardinal_prompt(subject: str, retry_hint: str) -> str:
    return (
        f"{subject}\n"
        "Create pixel art on a plain solid background. Make exactly one 4 by 4 sprite grid, no labels, no borders and no scenery. "
        "All 16 cells show the exact same character with identical clothes, equipment, proportions and palette. "
        "Rows are exactly: facing down, facing left, facing right, facing up. "
        "Every row contains four chronological looping walk phases with strong readable limb motion. "
        "Keep the feet baseline, scale and framing constant and leave clear empty padding around the character in every cell. "
        f"{retry_hint}"
    )


def _diagonal_prompt(subject: str, retry_hint: str) -> str:
    return (
        f"{subject}\n"
        "Using the reference sheet only to preserve the exact same character identity and art style, create a new pixel-art 4 by 4 sprite grid on a plain solid background. "
        "No labels, borders or scenery. Rows are exactly: facing north-east, south-east, south-west, north-west. "
        "Every row contains four chronological looping walk phases. Preserve clothing, equipment, silhouette, palette, scale, feet baseline and padding exactly. "
        f"{retry_hint}"
    )


def _sample(prompt: str, seed: int, reference=None):
    generator = torch.Generator(device="cuda").manual_seed(seed)
    kwargs = {
        "prompt": prompt,
        "width": SHEET,
        "height": SHEET,
        "num_inference_steps": 20,
        "generator": generator,
    }
    if reference is not None:
        kwargs["image"] = reference
    return pipe(**kwargs).images[0].convert("RGB").resize((SHEET, SHEET), Image.Resampling.LANCZOS)


@spaces.GPU(duration=120)
def generate(subject_prompt: str, source_image_data_url: str = "", seed: int = 0, retry_hint: str = ""):
    """Generate a Kelo-compatible 4x8 atlas candidate; deterministic compiler QA runs after this on the Kelo client."""
    seed = int(seed or 0)
    if seed <= 0:
        seed = random.randint(1, MAX_SEED)
    seed %= MAX_SEED
    subject = (subject_prompt or "Premium dark-fantasy MMORPG character, restrained gold accents.").strip()
    retry = (retry_hint or "").strip()
    reference = _decode_reference(source_image_data_url)

    cardinal = _sample(_cardinal_prompt(subject, retry), seed, reference)
    # Reuse the first generated sheet as identity reference when no uploaded
    # character exists. With an upload, keep the user's cleaned master as the
    # identity anchor for both passes.
    diagonal_reference = reference if reference is not None else cardinal
    diagonal = _sample(_diagonal_prompt(subject, retry), seed + 1, diagonal_reference)
    atlas = _compose(cardinal, diagonal)
    return _to_data_url(atlas), atlas, seed


with gr.Blocks(title="Kelo Sprite AI · Free ZeroGPU") as demo:
    gr.Markdown("# Kelo Sprite AI · ZeroGPU\nExperimental open-weight generator. Kelo Sprite Compiler performs the final background cleanup, 64px normalization and frame QA.")
    with gr.Row():
        with gr.Column():
            subject = gr.Textbox(label="Character / art direction", lines=5, value="Premium dark-fantasy MMORPG character, clean silhouette, restrained gold accents.")
            source = gr.Textbox(label="Reference image data URL (server use)", visible=False)
            seed = gr.Number(label="Seed", value=0, precision=0)
            retry = gr.Textbox(label="Kelo QA retry hint", visible=False)
            button = gr.Button("Generate 8-direction atlas", variant="primary")
        with gr.Column():
            preview = gr.Image(label="4 × 8 candidate atlas", type="pil")
            used_seed = gr.Number(label="Seed used", precision=0)
            encoded = gr.Textbox(label="Server data URL", visible=False)
    button.click(generate, inputs=[subject, source, seed, retry], outputs=[encoded, preview, used_seed], api_name="generate")

demo.queue(default_concurrency_limit=1).launch()

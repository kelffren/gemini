# KELO-INDEX
# area: DEPLOY / SPRITE AI
# owner: Kelo Sprite AI compatible Hugging Face Space
# purpose: free-first V2 atlas + V3 staged master/direction/repair candidates for Kelo compiler QA
# online: exposed through Gradio /generate and /generate_v3; Kelo server remains credential/rate-limit boundary
# do-not: no gameplay state, no Kelo auth, no provider secrets in returned payload

import base64
import io
import json
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
DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
V3_MODES = {"master", "rotations", "direction", "repair"}

pipe = DiffusionPipeline.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16)
pipe.load_lora_weights(LORA_MODEL)
pipe.to("cuda")


def _decode_image(data_url: str, size=None):
    value = (data_url or "").strip()
    if not value:
        return None
    match = re.match(r"^data:image/(?:png|webp|jpeg);base64,(.+)$", value, re.I | re.S)
    if not match:
        raise gr.Error("Reference image must be a PNG/WebP/JPEG data URL.")
    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)), validate=True)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    return image.resize(size, Image.Resampling.LANCZOS) if size else image


def _decode_reference(data_url: str):
    return _decode_image(data_url, (SHEET, SHEET))


def _to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _walk_row(sheet: Image.Image, index: int) -> Image.Image:
    """Turn the LoRA's trained 3-walk-frames + special-pose row into a clean 4-frame loop."""
    top = index * CELL
    trained_walk = [sheet.crop((column * CELL, top, (column + 1) * CELL, top + CELL)) for column in range(3)]
    loop = Image.new("RGB", (SHEET, CELL), (255, 255, 255))
    for target_column, source_index in enumerate((0, 1, 2, 1)):
        loop.paste(trained_walk[source_index], (target_column * CELL, 0))
    return loop


def _compose(cardinal: Image.Image, diagonal: Image.Image) -> Image.Image:
    cardinal_rows = {"S": 0, "W": 1, "E": 2, "N": 3}
    diagonal_rows = {"NE": 0, "SE": 1, "SW": 2, "NW": 3}
    atlas = Image.new("RGB", (SHEET, SHEET * 2), (255, 255, 255))
    for target_row, direction in enumerate(DIRECTIONS):
        source = _walk_row(cardinal, cardinal_rows[direction]) if direction in cardinal_rows else _walk_row(diagonal, diagonal_rows[direction])
        atlas.paste(source, (0, target_row * CELL))
    return atlas


def _cardinal_prompt(subject: str, retry_hint: str) -> str:
    return (
        f"{subject}\nCreate pixel art on a plain solid background. Make exactly one 4 by 4 sprite grid, no labels, no borders and no scenery. "
        "All 16 cells show the exact same character with identical clothes, equipment, proportions and palette. "
        "Rows are exactly: facing down, facing left, facing right, facing up. "
        "In every row the FIRST THREE cells are chronological walking frames with clear limb motion; the fourth cell may be a separate special pose. "
        "Keep the feet baseline, scale and framing constant and leave clear empty padding around the character in every cell. "
        f"{retry_hint}"
    )


def _diagonal_prompt(subject: str, retry_hint: str) -> str:
    return (
        f"{subject}\nUsing the reference sheet only to preserve the exact same character identity and art style, create a new pixel-art 4 by 4 sprite grid on a plain solid background. "
        "No labels, borders or scenery. Rows are exactly: facing north-east, south-east, south-west, north-west. "
        "In every row the FIRST THREE cells are chronological walking frames; the fourth is a spare special pose. Preserve clothing, equipment, silhouette, palette, scale, feet baseline and padding exactly. "
        f"{retry_hint}"
    )


def _sample(prompt: str, seed: int, reference=None, width=SHEET, height=SHEET):
    generator = torch.Generator(device="cuda").manual_seed(seed)
    kwargs = {"prompt": prompt, "width": width, "height": height, "num_inference_steps": 20, "generator": generator}
    if reference is not None:
        kwargs["image"] = reference.resize((width, height), Image.Resampling.LANCZOS)
    return pipe(**kwargs).images[0].convert("RGB").resize((width, height), Image.Resampling.LANCZOS)


def _seed(value: int) -> int:
    value = int(value or 0)
    if value <= 0:
        value = random.randint(1, MAX_SEED)
    return value % MAX_SEED


def _safe_json(value: str, fallback):
    try:
        parsed = json.loads(value or "null")
        return fallback if parsed is None else parsed
    except Exception:
        return fallback


@spaces.GPU(duration=120)
def generate(subject_prompt: str, source_image_data_url: str = "", seed: int = 0, retry_hint: str = ""):
    """Backward-compatible V2 4x8 atlas candidate."""
    seed = _seed(seed)
    subject = (subject_prompt or "Premium dark-fantasy MMORPG character, restrained gold accents.").strip()
    retry = (retry_hint or "").strip()
    reference = _decode_reference(source_image_data_url)
    cardinal = _sample(_cardinal_prompt(subject, retry), seed, reference)
    diagonal_reference = reference if reference is not None else cardinal
    diagonal = _sample(_diagonal_prompt(subject, retry), seed + 1, diagonal_reference)
    atlas = _compose(cardinal, diagonal)
    return _to_data_url(atlas), atlas, seed


def _master_prompt(subject: str, retry: str) -> str:
    return (
        f"{subject}\nCreate one canonical full-body game character on a plain solid background. One character only, no sprite grid, no labels, no text, no scenery. "
        "Neutral readable stance, centered feet, clean silhouette and generous empty padding. This is the identity master: face, hair, clothing, armor, weapon, proportions and palette must be unambiguous and reusable in later views. "
        f"{retry}"
    )


def _direction_prompt(subject: str, direction: str, action: str, pose, retry: str) -> str:
    return (
        f"{subject}\nUse the supplied reference as an immutable identity anchor. Generate one horizontal row of four chronological pixel-art frames facing {direction}: "
        f"{action} phases contact, passing, opposite-contact, passing. Do not redesign the face, hair, clothes, armor, weapon, body proportions or palette. "
        "Keep scale and feet baseline constant. No labels, borders or scenery. "
        f"Pose/keypoint intent: {json.dumps(pose, separators=(',', ':'))[:1800]}. {retry}"
    )


def _repair_prompt(subject: str, regions, retry: str) -> str:
    return (
        f"{subject}\nRepair this game sprite while preserving the original identity, pose, palette and framing. "
        f"Only correct these regions or defects: {', '.join(regions) if regions else 'the exact QA defect'}. "
        "Do not redesign healthy parts. Keep the same character, clothing, equipment, face and silhouette. "
        f"{retry}"
    )


@spaces.GPU(duration=120)
def generate_v3(mode: str, subject_prompt: str, source_image_data_url: str = "", seed: int = 0, retry_hint: str = "", direction: str = "", action: str = "walk", pose_json: str = "", target_frame_data_url: str = "", repair_regions_json: str = ""):
    """V3 staged generation. Final acceptance still belongs to Kelo Frame Doctor + compiler."""
    stage = (mode or "master").strip().lower()
    if stage not in V3_MODES:
        raise gr.Error(f"Unsupported V3 mode: {stage}")
    seed = _seed(seed)
    subject = (subject_prompt or "Premium dark-fantasy MMORPG character, restrained gold accents.").strip()
    retry = (retry_hint or "").strip()
    reference = _decode_reference(source_image_data_url)
    pose = _safe_json(pose_json, {})
    regions = _safe_json(repair_regions_json, [])

    if stage == "master":
        image = _sample(_master_prompt(subject, retry), seed, reference)
    elif stage == "rotations":
        cardinal = _sample(_cardinal_prompt(subject, retry), seed, reference)
        identity_reference = reference if reference is not None else cardinal
        diagonal = _sample(_diagonal_prompt(subject, retry), seed + 1, identity_reference)
        image = _compose(cardinal, diagonal)
    elif stage == "direction":
        facing = (direction or "S").strip().upper()
        if facing not in DIRECTIONS:
            raise gr.Error(f"Unsupported direction: {facing}")
        raw = _sample(_direction_prompt(subject, facing, (action or "walk").strip().lower(), pose, retry), seed, reference)
        # The public LoRA is grid-biased; the deterministic Kelo contract consumes one 4-frame row.
        image = _walk_row(raw, 0)
    else:
        target = _decode_image(target_frame_data_url, (SHEET, SHEET)) or reference
        if target is None:
            raise gr.Error("repair mode requires target_frame_data_url or source reference")
        repaired = _sample(_repair_prompt(subject, regions if isinstance(regions, list) else [], retry), seed, target)
        image = repaired.resize((CELL, CELL), Image.Resampling.LANCZOS)

    metadata = json.dumps({"pipeline": "identity-skeleton-v3", "stage": stage, "seed": seed, "direction": (direction or "").upper(), "action": (action or "walk").lower(), "poseConditioning": "semantic-keypoint-intent", "identityReference": bool(source_image_data_url)})
    return _to_data_url(image), image, metadata


with gr.Blocks(title="Kelo Sprite AI · Free ZeroGPU") as demo:
    gr.Markdown("# Kelo Sprite AI · ZeroGPU\nV2 atlas + experimental V3 staged identity/pose pipeline. Kelo Sprite Compiler and Frame Doctor remain the final authority.")
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

    v3_mode = gr.Textbox(value="master", visible=False)
    v3_direction = gr.Textbox(value="", visible=False)
    v3_action = gr.Textbox(value="walk", visible=False)
    v3_pose = gr.Textbox(value="", visible=False)
    v3_target = gr.Textbox(value="", visible=False)
    v3_regions = gr.Textbox(value="", visible=False)
    v3_encoded = gr.Textbox(visible=False)
    v3_preview = gr.Image(visible=False, type="pil")
    v3_metadata = gr.Textbox(visible=False)
    v3_trigger = gr.Button("V3 server endpoint", visible=False)
    v3_trigger.click(generate_v3, inputs=[v3_mode, subject, source, seed, retry, v3_direction, v3_action, v3_pose, v3_target, v3_regions], outputs=[v3_encoded, v3_preview, v3_metadata], api_name="generate_v3")

demo.queue(default_concurrency_limit=1).launch()

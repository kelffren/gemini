# KELO-INDEX
# area: DEPLOY / SPRITE AI / REAL SKELETON
# owner: Kelo Sprite Pose Space
# purpose: generate one 4-frame directional row using real OpenPose-style ControlNet conditioning + IP-Adapter identity guidance
# online: exposed through Gradio /generate_pose; Kelo server remains auth/rate-limit/credential boundary
# do-not: no gameplay state, no Kelo auth, no provider secrets in returned payload

import base64
import io
import json
import random
import re

import spaces  # ZeroGPU patch must load before torch/diffusers.
import gradio as gr
import torch
from diffusers import ControlNetModel, StableDiffusionXLControlNetPipeline
from PIL import Image, ImageDraw

BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
CONTROLNET_MODEL = "xinsir/controlnet-openpose-sdxl-1.0"
IP_ADAPTER_MODEL = "h94/IP-Adapter"
PIXEL_LORA_MODEL = "ntc-ai/SDXL-LoRA-slider.pixel-art"
PIXEL_LORA_WEIGHT = "pixel art.safetensors"
CANVAS = 512
CELL = 128
MAX_SEED = 2**31 - 1

# SDXL + ControlNet provides the structural pose authority. IP-Adapter carries the
# master-character appearance into every frame. A small SDXL pixel-art LoRA biases
# rendering toward game-asset texture; Kelo's deterministic compiler remains final QA.
controlnet = ControlNetModel.from_pretrained(CONTROLNET_MODEL, torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
    BASE_MODEL,
    controlnet=controlnet,
    torch_dtype=torch.float16,
    use_safetensors=True,
)
pipe.load_ip_adapter(
    IP_ADAPTER_MODEL,
    subfolder="sdxl_models",
    weight_name="ip-adapter_sdxl.bin",
)
pipe.set_ip_adapter_scale(0.82)
pipe.load_lora_weights(
    PIXEL_LORA_MODEL,
    weight_name=PIXEL_LORA_WEIGHT,
    adapter_name="pixel_art",
)
pipe.set_adapters(["pixel_art"], adapter_weights=[1.15])
pipe.to("cuda")

# OpenPose-like body palette and topology. Exact semantic joints stay provider-neutral
# in Kelo; this renderer converts normalized Kelo biped joints into a ControlNet image.
LIMBS = [
    ("neck", "rightShoulder"),
    ("rightShoulder", "rightElbow"),
    ("rightElbow", "rightHand"),
    ("neck", "leftShoulder"),
    ("leftShoulder", "leftElbow"),
    ("leftElbow", "leftHand"),
    ("neck", "hips"),
    ("hips", "rightHip"),
    ("rightHip", "rightKnee"),
    ("rightKnee", "rightFoot"),
    ("hips", "leftHip"),
    ("leftHip", "leftKnee"),
    ("leftKnee", "leftFoot"),
    ("head", "neck"),
]
COLORS = [
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
    (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
    (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255),
]


def _decode_reference(data_url: str) -> Image.Image:
    value = (data_url or "").strip()
    match = re.match(r"^data:image/(?:png|webp|jpeg);base64,(.+)$", value, re.I | re.S)
    if not match:
        raise gr.Error("A PNG/WebP/JPEG master-character data URL is required.")
    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)), validate=True)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    # Keep aspect ratio and center on white so the identity encoder does not receive
    # a stretched character.
    image.thumbnail((CANVAS, CANVAS), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    canvas.paste(image, ((CANVAS - image.width) // 2, (CANVAS - image.height) // 2))
    return canvas


def _to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _safe_point(value):
    if not isinstance(value, (list, tuple)) or len(value) < 2:
        return None
    try:
        x = max(0.0, min(1.0, float(value[0])))
        y = max(0.0, min(1.0, float(value[1])))
    except (TypeError, ValueError):
        return None
    return (int(round(x * (CANVAS - 1))), int(round(y * (CANVAS - 1))))


def _pose_frames(raw_json: str):
    try:
        payload = json.loads(raw_json or "null")
    except json.JSONDecodeError as exc:
        raise gr.Error(f"Invalid pose JSON: {exc}") from exc
    if isinstance(payload, dict) and isinstance(payload.get("frames"), list):
        frames = payload["frames"]
    elif isinstance(payload, list):
        frames = payload
    elif isinstance(payload, dict) and payload.get("keypoints"):
        frames = [payload]
    else:
        raise gr.Error("Pose payload must contain frames[].")
    if len(frames) < 4:
        raise gr.Error("Real skeleton direction generation requires four pose frames.")
    return frames[:4]


def _render_pose(frame: dict) -> Image.Image:
    points = dict(frame.get("keypoints") or {})
    # Backward-compatible aliases from V3 semantic templates.
    points.setdefault("neck", points.get("chest"))
    points.setdefault("leftHip", points.get("hips"))
    points.setdefault("rightHip", points.get("hips"))
    points.setdefault("leftHand", points.get("leftWrist"))
    points.setdefault("rightHand", points.get("rightWrist"))
    points.setdefault("leftFoot", points.get("leftAnkle"))
    points.setdefault("rightFoot", points.get("rightAnkle"))
    xy = {name: _safe_point(value) for name, value in points.items()}
    pose = Image.new("RGB", (CANVAS, CANVAS), (0, 0, 0))
    draw = ImageDraw.Draw(pose)
    width = max(5, CANVAS // 64)
    radius = max(5, CANVAS // 80)
    for index, (a, b) in enumerate(LIMBS):
        pa, pb = xy.get(a), xy.get(b)
        if pa and pb:
            draw.line([pa, pb], fill=COLORS[index % len(COLORS)], width=width)
    for index, name in enumerate(("head", "neck", "rightShoulder", "rightElbow", "rightHand", "leftShoulder", "leftElbow", "leftHand", "rightHip", "rightKnee", "rightFoot", "leftHip", "leftKnee", "leftFoot")):
        point = xy.get(name)
        if point:
            color = COLORS[index % len(COLORS)]
            draw.ellipse((point[0]-radius, point[1]-radius, point[0]+radius, point[1]+radius), fill=color)
    return pose


def _frame_prompt(subject: str, direction: str, action: str, phase: str, style_hint: str, retry_hint: str) -> str:
    return (
        f"{subject}\n"
        f"One full-body game character facing {direction}, performing {action}, animation phase {phase}. "
        "Preserve EXACTLY the identity, face, hair, clothing, armor, weapon, body proportions and color palette from the reference image. "
        "Follow the supplied pose skeleton for limb placement. Do not redesign the character. "
        "Crisp pixel art, strong readable silhouette, separated limbs, consistent feet baseline, plain uniform white background, no scenery, no text, no border, no shadow. "
        f"{style_hint or ''} {retry_hint or ''}"
    ).strip()


def _sample(prompt: str, reference: Image.Image, pose_image: Image.Image, seed: int) -> Image.Image:
    generator = torch.Generator(device="cuda").manual_seed(seed)
    result = pipe(
        prompt=prompt,
        negative_prompt="photorealistic, 3d render, blurry, painterly, extra limbs, missing limbs, deformed hands, duplicate character, multiple characters, text, label, border, scenery, gradient background",
        image=pose_image,
        ip_adapter_image=reference,
        width=CANVAS,
        height=CANVAS,
        num_inference_steps=22,
        guidance_scale=5.5,
        controlnet_conditioning_scale=1.0,
        generator=generator,
    ).images[0].convert("RGB")
    return result.resize((CELL, CELL), Image.Resampling.NEAREST)


@spaces.GPU(duration=180)
def generate_pose(subject_prompt: str, source_image_data_url: str, seed: int = 0, direction: str = "S", action: str = "walk", pose_template_json: str = "", style_hint: str = "", retry_hint: str = ""):
    seed = int(seed or 0)
    if seed <= 0:
        seed = random.randint(1, MAX_SEED)
    seed %= MAX_SEED
    direction = (direction or "S").strip().upper()
    action = (action or "walk").strip().lower()
    reference = _decode_reference(source_image_data_url)
    frames = _pose_frames(pose_template_json)
    row = Image.new("RGB", (CELL * 4, CELL), (255, 255, 255))
    pose_previews = []
    for index, frame in enumerate(frames):
        pose_image = _render_pose(frame)
        phase = str(frame.get("phase") or frame.get("name") or f"frame-{index+1}")
        prompt = _frame_prompt(subject_prompt or "Premium dark-fantasy MMORPG character", direction, action, phase, style_hint, retry_hint)
        output = _sample(prompt, reference, pose_image, (seed + index) % MAX_SEED)
        row.paste(output, (index * CELL, 0))
        pose_previews.append(pose_image.resize((CELL, CELL), Image.Resampling.NEAREST))
    metadata = json.dumps({
        "version": "kelo-real-skeleton-v1",
        "conditioning": "controlnet-openpose+ip-adapter",
        "baseModel": BASE_MODEL,
        "controlNet": CONTROLNET_MODEL,
        "ipAdapter": IP_ADAPTER_MODEL,
        "pixelLoRA": PIXEL_LORA_MODEL,
        "direction": direction,
        "action": action,
        "frames": 4,
        "seed": seed,
    })
    return _to_data_url(row), row, metadata


with gr.Blocks(title="Kelo Sprite Pose · Real Skeleton") as demo:
    gr.Markdown("# Kelo Sprite Pose · Real Skeleton\nSDXL + OpenPose ControlNet + IP-Adapter identity conditioning. Kelo Sprite Compiler remains the final QA authority.")
    subject = gr.Textbox(label="Character description", value="Premium dark-fantasy MMORPG character")
    source = gr.Textbox(label="Master reference data URL", visible=False)
    seed = gr.Number(label="Seed", value=0, precision=0)
    direction = gr.Dropdown(["N","NE","E","SE","S","SW","W","NW"], value="S", label="Direction")
    action = gr.Textbox(label="Action", value="walk")
    pose_json = gr.Textbox(label="Kelo skeleton JSON", lines=6)
    style = gr.Textbox(label="Style hint", value="pixel art game sprite")
    retry = gr.Textbox(label="QA retry hint", visible=False)
    button = gr.Button("Generate pose-conditioned row", variant="primary")
    preview = gr.Image(label="4-frame direction row", type="pil")
    encoded = gr.Textbox(label="Server data URL", visible=False)
    metadata = gr.Textbox(label="Metadata", visible=False)
    button.click(generate_pose, inputs=[subject, source, seed, direction, action, pose_json, style, retry], outputs=[encoded, preview, metadata], api_name="generate_pose")

demo.queue(default_concurrency_limit=1).launch()

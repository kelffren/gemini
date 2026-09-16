# KELO-INDEX
# area: DEPLOY / SPRITE AI / REAL SKELETON
# owner: Kelo Sprite Pose Space
# purpose: generate one 4-frame directional row using batched OpenPose ControlNet + IP-Adapter identity guidance
# online: exposed through Gradio /generate_pose; optimized for free ZeroGPU large (48 GB, 1x quota)
# do-not: no gameplay state, no Kelo auth, no provider secrets, no xlarge-only assumptions

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
REFERENCE_SIZE = 512
CELL = 128
MAX_SEED = 2**31 - 1
NEGATIVE = "photorealistic, 3d render, blurry, painterly, extra limbs, missing limbs, deformed hands, duplicate character, multiple characters, text, label, border, scenery, gradient background"

controlnet = ControlNetModel.from_pretrained(CONTROLNET_MODEL, torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
    BASE_MODEL,
    controlnet=controlnet,
    torch_dtype=torch.float16,
    use_safetensors=True,
)
pipe.load_ip_adapter(IP_ADAPTER_MODEL, subfolder="sdxl_models", weight_name="ip-adapter_sdxl.bin")
pipe.set_ip_adapter_scale(0.82)
pipe.load_lora_weights(PIXEL_LORA_MODEL, weight_name=PIXEL_LORA_WEIGHT, adapter_name="pixel_art")
pipe.set_adapters(["pixel_art"], adapter_weights=[1.15])
pipe.to("cuda")

LIMBS = [
    ("neck", "rightShoulder"), ("rightShoulder", "rightElbow"), ("rightElbow", "rightHand"),
    ("neck", "leftShoulder"), ("leftShoulder", "leftElbow"), ("leftElbow", "leftHand"),
    ("neck", "hips"), ("hips", "rightHip"), ("rightHip", "rightKnee"), ("rightKnee", "rightFoot"),
    ("hips", "leftHip"), ("leftHip", "leftKnee"), ("leftKnee", "leftFoot"), ("head", "neck"),
]
COLORS = [
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0),
    (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255),
]


def _decode_reference(data_url: str) -> Image.Image:
    value = (data_url or "").strip()
    match = re.match(r"^data:image/(?:png|webp|jpeg);base64,(.+)$", value, re.I | re.S)
    if not match:
        raise gr.Error("A PNG/WebP/JPEG master-character data URL is required.")
    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)), validate=True)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    image.thumbnail((REFERENCE_SIZE, REFERENCE_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (REFERENCE_SIZE, REFERENCE_SIZE), (255, 255, 255))
    canvas.paste(image, ((REFERENCE_SIZE - image.width) // 2, (REFERENCE_SIZE - image.height) // 2))
    return canvas


def _to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _safe_point(value, size):
    if not isinstance(value, (list, tuple)) or len(value) < 2:
        return None
    try:
        x = max(0.0, min(1.0, float(value[0])))
        y = max(0.0, min(1.0, float(value[1])))
    except (TypeError, ValueError):
        return None
    return (int(round(x * (size - 1))), int(round(y * (size - 1))))


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


def _render_pose(frame: dict, size: int) -> Image.Image:
    points = dict(frame.get("keypoints") or {})
    points.setdefault("neck", points.get("chest"))
    points.setdefault("leftHip", points.get("hips"))
    points.setdefault("rightHip", points.get("hips"))
    points.setdefault("leftHand", points.get("leftWrist"))
    points.setdefault("rightHand", points.get("rightWrist"))
    points.setdefault("leftFoot", points.get("leftAnkle"))
    points.setdefault("rightFoot", points.get("rightAnkle"))
    xy = {name: _safe_point(value, size) for name, value in points.items()}
    pose = Image.new("RGB", (size, size), (0, 0, 0))
    draw = ImageDraw.Draw(pose)
    width = max(4, size // 64)
    radius = max(4, size // 80)
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
        f"{subject}\nOne full-body game character facing {direction}, performing {action}, animation phase {phase}. "
        "Preserve EXACTLY the identity, face, hair, clothing, armor, weapon, body proportions and color palette from the reference image. "
        "Follow the supplied pose skeleton for limb placement. Do not redesign the character. "
        "Crisp pixel art, strong readable silhouette, separated limbs, consistent feet baseline, plain uniform white background, no scenery, no text, no border, no shadow. "
        f"{style_hint or ''} {retry_hint or ''}"
    ).strip()


def _quality_profile(retry_hint: str):
    if (retry_hint or "").strip():
        return {"tier": "repair", "size": 448, "steps": 16, "guidance": 5.2, "duration": 105}
    return {"tier": "draft", "size": 384, "steps": 12, "guidance": 4.6, "duration": 75}


def _gpu_duration(subject_prompt: str, source_image_data_url: str, seed: int = 0, direction: str = "S", action: str = "walk", pose_template_json: str = "", style_hint: str = "", retry_hint: str = ""):
    return _quality_profile(retry_hint)["duration"]


def _batch_sample(prompts, reference, pose_images, seed: int, profile):
    generators = [torch.Generator(device="cuda").manual_seed((seed + index) % MAX_SEED) for index in range(len(prompts))]
    result = pipe(
        prompt=prompts,
        negative_prompt=[NEGATIVE] * len(prompts),
        image=pose_images,
        ip_adapter_image=reference,
        width=profile["size"],
        height=profile["size"],
        num_inference_steps=profile["steps"],
        guidance_scale=profile["guidance"],
        controlnet_conditioning_scale=1.0,
        generator=generators,
    ).images
    return [image.convert("RGB").resize((CELL, CELL), Image.Resampling.NEAREST) for image in result]


@spaces.GPU(duration=_gpu_duration)
def generate_pose(subject_prompt: str, source_image_data_url: str, seed: int = 0, direction: str = "S", action: str = "walk", pose_template_json: str = "", style_hint: str = "", retry_hint: str = ""):
    seed = int(seed or 0)
    if seed <= 0:
        seed = random.randint(1, MAX_SEED)
    seed %= MAX_SEED
    direction = (direction or "S").strip().upper()
    action = (action or "walk").strip().lower()
    reference = _decode_reference(source_image_data_url)
    frames = _pose_frames(pose_template_json)
    profile = _quality_profile(retry_hint)

    # Walk draft uses three unique frames and reuses passing-a as frame 4 (0→1→2→1).
    # A QA retry automatically switches to four unique frames at higher quality.
    synthesize_fourth = action == "walk" and profile["tier"] == "draft"
    source_frames = frames[:3] if synthesize_fourth else frames
    prompts, pose_images = [], []
    for index, frame in enumerate(source_frames):
        phase = str(frame.get("phase") or frame.get("name") or f"frame-{index+1}")
        prompts.append(_frame_prompt(subject_prompt or "Premium dark-fantasy MMORPG character", direction, action, phase, style_hint, retry_hint))
        pose_images.append(_render_pose(frame, profile["size"]))

    outputs = _batch_sample(prompts, reference, pose_images, seed, profile)
    final_outputs = [outputs[0], outputs[1], outputs[2], outputs[1]] if synthesize_fourth else outputs[:4]
    row = Image.new("RGB", (CELL * 4, CELL), (255, 255, 255))
    for index, output in enumerate(final_outputs):
        row.paste(output, (index * CELL, 0))

    metadata = json.dumps({
        "version": "kelo-real-skeleton-v3-free-max",
        "conditioning": "controlnet-openpose+ip-adapter",
        "baseModel": BASE_MODEL,
        "controlNet": CONTROLNET_MODEL,
        "ipAdapter": IP_ADAPTER_MODEL,
        "pixelLoRA": PIXEL_LORA_MODEL,
        "direction": direction,
        "action": action,
        "frames": 4,
        "uniqueGpuFrames": len(source_frames),
        "synthesizedFourth": synthesize_fourth,
        "loopPattern": "0-1-2-1" if synthesize_fourth else "0-1-2-3",
        "batchSize": len(source_frames),
        "seed": seed,
        "qualityTier": profile["tier"],
        "workingResolution": profile["size"],
        "steps": profile["steps"],
        "zeroGpuSizeTarget": "large-48gb-1x-quota",
    })
    return _to_data_url(row), row, metadata


with gr.Blocks(title="Kelo Sprite Pose · Real Skeleton") as demo:
    gr.Markdown("# Kelo Sprite Pose · Real Skeleton\nQuota-aware batched SDXL + OpenPose + IP-Adapter. Walk drafts use 3 unique GPU frames; Frame Doctor escalates only failing rows to 4-frame repair quality.")
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

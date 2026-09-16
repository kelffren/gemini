# Kelo Sprite AI V3 — Identity + Skeleton Pipeline

## Goal

V3 moves Sprite AI away from one-shot atlas generation toward a staged workflow inspired by production character-animation systems:

```text
master character
  -> identity-locked rotations
  -> direction + pose-conditioned frames
  -> Frame Doctor
  -> selective repair
  -> deterministic atlas composition
  -> final compiler QA
```

The AI output is always a candidate. `Sprite Compiler` + `Frame Doctor` remain the technical authority.

## Public boundary

The browser still calls only:

```text
POST /api/sprite-generate
```

V2 remains compatible. V3 is selected with:

```json
{
  "pipeline": "identity-skeleton-v3",
  "mode": "master|rotations|direction|repair"
}
```

No Hugging Face or OpenAI token is exposed to GitHub Pages.

## Stages

### 1. master

Creates the canonical identity anchor. Later stages should preserve:

- face/head identity;
- hair;
- clothing/armor;
- weapon/equipment;
- body proportions;
- palette;
- scale and silhouette.

### 2. rotations

Uses the master as a reference and creates directional candidates for:

`N, NE, E, SE, S, SW, W, NW`.

Rotation changes orientation only. It must not redesign the character.

### 3. direction

Generates one four-frame row for one direction and action. The canonical walk sequence is:

1. contact;
2. passing;
3. opposite-contact;
4. passing.

`src/creators/sprite-compiler/pose-templates.mjs` owns provider-neutral normalized pose intent. This keeps the contract ready for future real skeleton/ControlNet conditioning without coupling the compiler to one model.

### 4. repair

Frame Doctor can target only the defective frame/region instead of regenerating the whole atlas. Repair regions currently include semantic targets such as:

- head;
- weapon;
- arms;
- legs;
- character identity;
- clipping edges.

## Deterministic composition

`src/creators/sprite-compiler/sprite-sheet-composer.mjs` composes approved directional rows into the canonical atlas. The AI is not trusted to perform final atlas layout.

Canonical order:

```text
N
NE
E
SE
S
SW
W
NW
```

Each row contains 4 frames.

## Frame Doctor V3 signals

Frame Doctor preserves the existing mechanical checks and can additionally consume optional semantic scores:

- `identityScore`;
- `headConsistencyScore`;
- `weaponConsistencyScore`;
- `limbReadabilityScore`;
- `motionContinuityScore`.

These scores are optional so V2 and legacy compiler callers remain compatible. When a future local or server-side vision scorer supplies them, Frame Doctor can isolate art defects and generate selective repair targets.

## Hugging Face Space

The reference Space exposes:

- `/generate` — backward-compatible V2 atlas;
- `/generate_v3` — staged V3 endpoint.

V3 Space inputs include:

- mode;
- prompt;
- master/reference image;
- seed;
- QA retry hint;
- direction;
- action;
- pose/keypoint intent JSON;
- target frame;
- repair regions.

## Current conditioning level

The first V3 implementation uses semantic keypoint intent in the prompt plus reference-image conditioning. The architecture is deliberately prepared for a future true skeleton-conditioned backend (ControlNet/OpenPose or equivalent), but that is not claimed as implemented until a compatible open model is deployed and validated.

This distinction matters: V3 architecture is production-oriented now, while the exact open inference model can evolve independently.

## Cost and fallback

`KELO_SPRITE_AI_ALLOW_PAID_FALLBACK=0` remains the default. A ZeroGPU queue/error/quota event must not silently create paid usage.

## Rollout rule

`KELO_SPRITE_AI_PIPELINE=atlas-v2` remains the default until a real V3 Space completes end-to-end QA. Individual authenticated requests can explicitly exercise `identity-skeleton-v3` before global promotion.

Promotion to V3 default requires:

1. real Space build succeeds;
2. master generation succeeds;
3. all 8 directions can be produced;
4. four-frame rows pass compiler geometry checks;
5. selective repair returns a valid replacement frame;
6. final composed atlas passes Frame Doctor and compiler QA;
7. identity drift is measurably better than V2 on a fixed evaluation set.

## Invariants

1. One public server endpoint.
2. No provider secrets in browser code.
3. No AI output auto-publishes.
4. Healthy frames are preserved when repair is possible.
5. Final atlas layout is deterministic.
6. No silent paid fallback.
7. V2 remains available until V3 proves better in measured tests.

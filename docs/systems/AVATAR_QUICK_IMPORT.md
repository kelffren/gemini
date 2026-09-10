# Avatar Quick Import V1

## Status
- owner: `KeloCreatorAvatars` adapter over `KeloAvatar`
- creator UI: `src/creators/ui/avatar-workspace.mjs`
- ingest owner: `src/creators/avatar/avatar-quick-import-service.mjs`
- analyzer/compiler: `src/creators/avatar/avatar-spritesheet-analyzer.mjs`
- persistence: Supabase `characters.active_avatar_content_id` + Universal Content Registry
- playerVisible: false
- status: creator-online-active-v1

## Product contract
The normal path is intentionally three visible actions: **upload → preview → use**. Spreadsheet import remains the batch/pro workflow; it is not required to change one avatar.

The UI must hide asset IDs, Storage paths, hashes, revisions, rigs and Supabase details. Grid correction and background removal live under `Ajustes avanzados`.

## Pipeline
1. User chooses PNG/WebP/JPEG from phone Files/Photos/Drive.
2. Analyzer validates <=5 MB and <=2048 px and infers a simple sprite grid. Square large sheets default to 4×4.
3. A local canvas preview animates before any upload.
4. Runtime compiler optionally removes a uniform light background, downsizes to <=1024 px and encodes a <=2 MB WebP/PNG derivative.
5. Public runtime derivative is uploaded to the existing public `avatars` bucket under the authenticated user folder.
6. The original source still goes through `UniversalContentService` and produces immutable asset/content revisions.
7. The character revision payload stores `avatarRuntime` metadata: bucket/path/public URL/grid/row map/frame timing.
8. `set_active_character_avatar` verifies the caller owns both the character and a valid character-content revision, then writes `characters.active_avatar_content_id`.
9. `KELO_CREATOR_CONTENT_REGISTRY` dispatches character quick-avatar content to `KeloCreatorAvatars`.
10. `KeloCreatorAvatars` uses `KeloAvatar.use(...)`; it never wraps or replaces `renderAvatar` itself.

## Runtime contract
Default row order for a 4-row sheet:
- row 0: down/front
- row 1: left
- row 2: right
- row 3: up/back

Frame 0 is idle. While the actor is moving, frames advance using `frameMs` (default 140 ms). The runtime derives facing from velocity first and existing actor facing second.

The selected manifest is cached in localStorage so the same device restores the avatar during normal boot. Supabase remains the durable per-character selection source.

## Security and online boundary
- browser uses publishable key + user JWT only;
- `avatars` is a public-read delivery bucket because equipped avatars are visible content;
- writes are folder-scoped by existing Storage RLS (`/<auth.uid()>/...`);
- source revisions remain in the normal Creator content pipeline;
- browser cannot approve creator content globally;
- selection RPC accepts only owned `character` content containing a valid `avatarRuntime` manifest.

## Reuse rules
Do not create a second character renderer. Do not store raw blob URLs in character state. Do not make avatar selection point at filenames. Do not make the quick UI write directly to game state outside the `KeloAvatar` middleware adapter.

## V1 limits
- images only: PNG/WebP/JPEG;
- source <=5 MB, <=2048×2048;
- runtime derivative <=2 MB, max dimension 1024;
- automatic grid inference intentionally favors the common 4×4 character sheet; unusual sheets use Advanced controls;
- light uniform backgrounds can be removed; complex backgrounds require an already-transparent asset or a future segmentation service.

## Audit
`npm run audit:avatar-quick`

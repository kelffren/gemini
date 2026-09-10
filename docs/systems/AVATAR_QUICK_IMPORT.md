# Avatar Quick Import V2 — Auto-Detect

## Status
- owner: `KeloCreatorAvatars` adapter over `KeloAvatar`
- creator UI: `src/creators/ui/avatar-workspace.mjs`
- ingest owner: `src/creators/avatar/avatar-quick-import-service.mjs`
- analyzer/compiler: `src/creators/avatar/avatar-spritesheet-analyzer.mjs`
- persistence: Supabase `characters.active_avatar_content_id` + Universal Content Registry
- playerVisible: false
- status: creator-online-active-v2-autodetect

## Product contract
The normal path is deliberately **upload → preview → use**. A creator should not need to know columns, rows, file paths, hashes, rigs, Supabase or revision IDs.

V2 makes auto-detection the default authority for presentation preparation. Manual controls remain a fallback under `Ajustes avanzados` and open automatically only when detection confidence is low.

Spreadsheet import remains the batch/pro workflow; it is not required for one avatar.

## Auto-Detect V2 pipeline
1. Decode PNG/WebP/JPEG locally. Source remains <=5 MB and <=2048 px per dimension.
2. Downsample only for analysis; original pixels remain the source of the compiled runtime.
3. Inspect border pixels to classify transparent vs uniform-color background and estimate background noise/tolerance.
4. Build a foreground mask without globally deleting white or any other color.
5. Run connected-component segmentation.
6. Use large components as frame seeds, cluster their X/Y centers, and infer a variable `columns × rows` grid.
7. Attach smaller nearby components back to the nearest frame so detached details can remain inside a frame.
8. Produce per-frame `sourceRects`. Rectangles may overlap; the source does not need exact equal cells.
9. Score the detection. High confidence keeps Advanced collapsed; low confidence exposes correction controls.
10. For four-row character sheets, infer side rows from silhouette symmetry and head-vs-torso horizontal shift. Front/back is resolved from upper-body detail when confidence supports it; otherwise the safe conventional row order remains the fallback.
11. Compile the source into a normalized equal-cell runtime sheet. Each detected frame is cropped independently, centered horizontally and bottom-aligned so generated/collage sheets with uneven margins do not bleed across frames.
12. Optionally remove only background connected to image edges. Interior white clothing/details are preserved.
13. Show the normalized runtime as an animated local preview before network upload.
14. Only after `USAR COMO AVATAR` does the normal online ingest/persistence pipeline run.

## Detection result contract
`analyzeAvatarSpriteSheet(...)` returns stable preparation metadata including:

- `columns`, `rows`
- `confidence` + numeric `confidenceScore`
- `detectionMode`: normally `components`, fallback `regular`, or `manual` after creator correction
- `autoCrop`
- `sourceRects`
- `contentBounds`
- `backgroundKind`, `backgroundRgb`, `backgroundThreshold`
- `removeBackground`
- `rowMap`
- `directionConfidence` + `directionMode`

No detection field is an identity. Content identity still comes from Universal Content immutable revisions.

## Runtime compiler contract
When `sourceRects` match the detected grid, `compileAvatarRuntime(...)` repacks the source into a normalized sheet:

- one equal runtime cell per detected source frame;
- relative sprite size preserved;
- horizontal centering;
- bottom alignment;
- maximum runtime dimension 1024;
- runtime derivative <=2 MB;
- WebP preferred, PNG fallback.

If a creator manually changes rows/columns, the UI intentionally drops the auto `sourceRects` and uses regular-grid compilation instead of applying stale detection geometry.

## Default/fallback direction order
When visual direction confidence is insufficient:

- row 0: down/front
- row 1: left
- row 2: right
- row 3: up/back

Advanced controls allow explicit row correction without exposing any other engine internals.

## Persistence
After local validation:

1. Runtime derivative goes to the existing public `avatars` bucket under the authenticated user folder.
2. Original source goes through `UniversalContentService`.
3. The character content revision stores `avatarRuntime` plus an `metadata.autoDetect` summary.
4. `set_active_character_avatar` verifies ownership and writes only immutable `content_id` into `characters.active_avatar_content_id`.
5. `KeloCreatorAvatars` registers/selects the manifest and reuses `KeloAvatar.use(...)`.

Re-import remains hash/idempotency driven; no filename becomes content identity.

## Security and online boundary
- browser uses publishable key + user JWT only;
- `avatars` is public-read delivery because equipped avatars are visible art;
- user writes remain folder-scoped through existing Storage RLS;
- browser cannot approve global Creator content;
- selection RPC validates character ownership and owned `character` content;
- Auto-Detect is presentation preparation only and owns no gameplay authority.

## Ownership invariants
- `KeloAvatar` remains the single avatar render owner.
- `KeloCreatorAvatars` remains an adapter/middleware, not a second renderer.
- UI never writes character/gameplay state directly.
- Auto-detection is pure/local until the creator presses USE.
- Supabase stores durable selection; local cache is only fast restore.
- Source asset and runtime derivative remain separate concerns.

## Failure behavior
V2 does not pretend every arbitrary image is perfectly segmentable.

If component segmentation is weak:
- a conservative regular-grid fallback is proposed;
- confidence drops;
- Advanced opens automatically;
- the creator can correct columns, rows, four direction rows, and background removal;
- preview is always the final gate before USE.

Complex photographic/non-uniform backgrounds can still require a transparent source or a future dedicated segmentation capability; they do not justify embedding arbitrary ML/remote authority into this owner.

## Tests / CI
- `npm run audit:avatar-quick`
- `Avatar Quick Import CI`
- mobile browser proof at 390×844
- irregular 1254×1254 4×4 sheet whose sprites cross naive equal-cell boundaries
- transparent non-square 3×4 sheet
- verifies high-confidence component detection, 16/12 source rects, normalized runtime, direction inference, animated preview, edge-only background cleanup, preservation of interior white, and USE callback
- `npm run audit:universal-content`
- `npm run audit:docs`

## Extension rule
New detection heuristics extend this analyzer/compiler. Do not create `AvatarDetector2`, a second uploader, a second renderer, or per-format runtime owners.

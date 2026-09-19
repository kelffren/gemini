# Kelo World — World Building x1000

Status: research + execution roadmap (2026-09-18)

## Thesis

The x1000 jump is **not** “place objects faster.” It is moving the authoring unit upward:

1. object → one prefab
2. palette → many compatible prefabs
3. semantic brush → “forest / plaza / village edge”
4. rule system → adjacency, exclusions, transitions, density, hierarchy
5. recipe → a whole area that can be regenerated deterministically
6. world compiler → only bakes changed chunks into ordinary Studio commands

Kelo should keep its existing authority model. Procedural systems remain local authoring tools; final durable edits compile to reversible entity.place / terrain / collision commands through Studio CommandBus.

## External patterns worth stealing conceptually

### Unity: Random Brush + Rule Tile
Useful idea: a brush owns a set of alternatives, while neighbor rules choose the correct visual result. Random variation and rule-aware adjacency are separate responsibilities.

Sources:
- https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@6.0/manual/RandomBrush.html
- https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@6.0/manual/RuleTile.html

### Godot: Terrain sets
Useful idea: the creator paints semantic terrain and the editor chooses corners, sides and transitions automatically. The user should not manually select edge variants.

Source:
- https://docs.godotengine.org/en/latest/tutorials/2d/using_tilesets.html

### Tiled: Automapping while drawing
Useful idea: rule inputs and outputs can rewrite repetitive decoration continuously while the designer paints.

Source:
- https://doc.mapeditor.org/en/stable/manual/automapping/

### Unreal PCG: points, density and hierarchical generation
Useful idea: represent generation as points with attributes (density, transform, seed, bounds), then run different detail scales on different grids/chunks. Large objects and tiny decoration should not use the same generation resolution.

Sources:
- https://dev.epicgames.com/documentation/unreal-engine/procedural-content-generation-overview
- https://dev.epicgames.com/documentation/unreal-engine/using-pcg-generation-modes-in-unreal-engine

## Architecture

### 1. Build Palette — IMPLEMENT NOW
Input: 2–12 assets from the active Library page.

Compiler:
- Persist through Mi Baúl.
- Integrate through personal content.
- Expand each selected asset into placeable Studio prefabs.
- Cap palette variants to a mobile-safe working set.
- Seeded selection makes the same stroke reproducible.
- One pointer gesture = one CompositeCommand = one Undo.

This is the bridge from “asset browsing” to “world painting.”

### 2. Semantic Brush
A palette gets a semantic role such as canopy, understory, detail, roadside, waterside or architecture.

Immediate controls:
- density
- radius
- seed
- scale range
- allowed rotations
- minimum spacing
- role proportions

The brush paints intent, not an arbitrary bag of objects.

### 3. Constraint Layer
Every generated point passes cheap rules before becoming a preview:

- surface tag: grass / dirt / water / road / interior
- minimum distance from roads
- minimum distance from entrances / spawn / NPC routes
- avoid collision rectangles
- slope / height when those data exist
- district / biome include-exclude tags
- edge only, inside only, near water, near wall

Rules should be declarative data. Do not hard-code “tree behavior” into the brush.

### 4. Rule Resolver
After points exist, resolve relationships:

- path edge → lamp / bench candidates
- water edge → reeds / stones
- building edge → crates / signs
- forest interior → dense canopy
- forest edge → bushes + flowers
- terrain corners / transitions → correct tile variants

Run only on dirty cells around the stroke, not the whole map.

### 5. Biome Recipe
A biome is a versioned recipe, not thousands of handcrafted placements.

Core properties:
- schema
- seed
- bounds
- semantic layers
- density per layer
- grid size per layer
- palette references
- constraints

Key property: **same recipe + same seed + same inputs = same preview**.

That makes Undo, collaboration, caching and server validation dramatically cheaper.

### 6. Hierarchical generation
Use different grids by visual importance:

- 128–256 px: buildings / giant trees / landmarks
- 64–128 px: trees / rocks / props
- 24–64 px: bushes / flowers / debris
- cosmetic-only detail: runtime/local decoration when safe

Never generate every detail at the finest resolution.

### 7. Recipe-first preview, bake-later commit
Do not instantly create 5,000 document entities while the finger is moving.

During gesture:
- hold compact point records
- render capped previews
- update only affected chunks
- cancel cheaply

On commit:
- resolve rules
- diff against previous recipe/chunk
- compile only changed points into canonical Studio commands
- preserve one history entry per intentional operation

### 8. Smart macro tools
Once the recipe engine exists, higher-level builders become thin presets:

- FOREST: paint polygon → canopy + understory + detail
- VILLAGE: road spline → lots → houses → lamps → props
- RIVER: spline → water → banks → reeds → stones
- PLAZA: polygon → floor → perimeter → lights → benches
- FARM: polygon → rows → crop mix → paths → fence
- DUNGEON: room graph → rooms → doors → dressing

These are not six separate engines. They are six recipes over the same point/rule/compiler infrastructure.

## Mobile rules

Hard constraints for iPhone:
- never preload full external libraries
- cap active palette to 12 selected source assets
- cap resolved working variants to 24 initially
- cap live stroke preview to 120 initially; hard ceiling 180
- deterministic generation so previews can be discarded/recreated
- no full-world scans during pointermove
- spatial queries only in affected chunk/radius
- cancel superseded generation
- yield between heavyweight asset integrations
- recipe metadata is tiny; binaries remain in Baúl/CAS

## Data model to add next

WorldBrushRecipe:
- id
- version
- seed
- semanticRole
- palette[]
- constraints[]
- layers[]
- bounds
- sourceAssetIds[]

GeneratedPoint:
- x
- y
- prefabId
- role
- density
- seed
- chunkKey

## Failure boundaries

Keep these as separate capability switches:

- libraryPalette
- semanticBrush
- constraintResolver
- adjacencyRules
- biomeRecipe
- recipeCompiler

If Biome Recipe breaks, ordinary Placement and Build Palette must still work.

## Execution order

### Phase A — Build Palette
Select assets → paint mixed deterministic stroke → one Undo.

### Phase B — Smart density
Radius, density, seed, min spacing, optional overlap avoidance.

### Phase C — Semantic roles
Tree / bush / detail grouping and proportions.

### Phase D — Constraints
Road, water, collision, district and surface filters.

### Phase E — Biome Recipe V1
Paint an area and regenerate it from a small recipe.

### Phase F — Hierarchical chunks
Different generation grids per layer; only dirty chunks regenerate.

### Phase G — Macro builders
Forest / village / river / plaza become recipe presets.

## North-star UX

The final user interaction should be:

“Use these 8 assets. Make this area feel like a dense enchanted forest, keep 2 tiles clear around the road, put flowers near the edge, and make it reproducible.”

Then the user paints one region.

Kelo produces the preview locally, keeps the recipe deterministic, and commits ordinary authoritative Studio edits only when accepted.

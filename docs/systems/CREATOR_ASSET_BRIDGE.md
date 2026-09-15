# Creator Asset Bridge V1.2 — Asset Bytes to Runtime Catalog

## Status

- owner: `Kelo Creator Asset Bridge`
- PNG byte optimizer: `src/creators/assets/png-space-optimizer.mjs`
- PNG adaptive search: `src/creators/assets/png-adaptive-optimizer.mjs`
- deterministic quality agent: `src/creators/assets/png-quality-agent.mjs`
- sheet compiler: `src/creators/assets/asset-sheet-compiler.mjs`
- foreground: `src/creators/sprite-compiler/sprite-foreground-analysis.mjs`
- world profile: `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs`
- semantic bridge: `src/creators/assets/kelo-creator-asset-bridge.mjs`
- CLI ingest surface: `scripts/asset-space-compiler.mjs`
- byte transport: `CHATGPT_ASSET_UPLOAD_BRIDGE.md`
- runtime consumers: `KELO_ATLAS_CONTRACT` + `KELO_PROPERTY_CATALOG`
- playerVisible: false
- status: creator-local-file-bridge-v1.2-space-gate-candidate

## Contract

El bridge recibe bytes de imagen, puede reducir su representación PNG con un gate de fidelidad y después toma sheets con piezas heterogéneas para producir metadata de atlas irregular. No posee renderer, World mutations, publicación final ni storage persistente remoto.

Flujo:

`RAW PNG → PNG SPACE GATE → ANALYZE → COMPONENTS/GROUPS → REVIEW → MANIFEST → ATLAS/CATALOG → STUDIO`

La etapa `PNG SPACE GATE` es previa al análisis geométrico. Nunca cambia dimensiones ni sourceRects. El compilador de sheets sigue siendo dueño de grouping/metadata; el optimizador de bytes no se convierte en un segundo asset compiler de gameplay.

## PNG Space Gate

### Strict / default

`optimizePngLossless()` explora varias representaciones PNG y solo acepta candidatos cuyo RGBA decodificado sea idéntico byte por byte al original.

Búsqueda actual:

- PNG filters 0..4 + selección adaptativa por fila;
- varios perfiles DEFLATE de Node/zlib;
- conversión exacta a PNG indexado cuando la imagen tiene `<=256` colores RGBA y no contiene chunks cuya semántica dependa del color type;
- el original siempre participa como baseline, por lo que nunca se reemplaza por un archivo mayor o visualmente distinto.

El gate duro es `changedPixels === 0`. El screenshot/capture no sustituye esta prueba: la igualdad de píxel decodificado es más fuerte que una inspección visual.

### Adaptive / opt-in

`optimizePngAdaptive()` puede generar candidatos de paleta con Sharp y someterlos al `png-quality-agent.mjs`. Esta ruta es deliberadamente opt-in porque una cuantización puede cambiar colores aunque el cambio sea difícil de ver.

El Quality Agent calcula, entre otras métricas:

- PSNR RGB;
- error RGB medio;
- cambio máximo RGB;
- cambios de alpha;
- error de bordes/luminancia;
- proporción de píxeles con delta RGB grande.

Política pixel-art inicial: alpha exacto, PSNR muy alto y tolerancia mínima en bordes. Si ningún candidato adaptativo pasa, el resultado vuelve automáticamente al baseline strict lossless.

La opinión de un modelo visual futuro puede añadirse como veto/advisory, pero nunca puede aprobar un candidato que falle los hard metrics.

## Captura y evidencia

`scripts/asset-space-compiler.mjs` puede ejecutarse sin escribir (default) o con `--write`. Con `--capture` produce copias `before/after`, `report.json` e `index.html` para inspección lado a lado con `image-rendering: pixelated`.

Ejemplos:

```bash
node scripts/asset-space-compiler.mjs --input=assets --mode=strict --capture
node scripts/asset-space-compiler.mjs --input=assets --mode=strict --capture --write
node scripts/asset-space-compiler.mjs --input=C --mode=adaptive --capture --write
```

El input es configurable porque el repositorio no debe depender de un nombre de carpeta concreto. Una futura carpeta de ingestión puede apuntarse con `--input` sin cambiar el owner ni el runtime.

Los reemplazos son atómicos: el archivo original solo se sustituye después de que el candidato haya superado el gate correspondiente y sea menor.

## Ownership

- byte-space optimization + quality evidence: `Kelo Creator Asset Bridge` support capability;
- foreground/background: `sprite-foreground-analysis.mjs`;
- heterogeneous grouping + sourceRects: `asset-sheet-compiler.mjs`;
- anchor/footprint/scale profile: `sprite-world-asset-compiler.mjs`;
- semantic review: file bridge;
- atlas runtime: Atlas Contract;
- templates: Property Catalog;
- map placement: Studio/World/Map Forge owners.

## Semantic review rule

Names, family, category, layer, confidence and notes may change. Stable sourceRects/identity must not be silently re-cut by a semantic review. PNG byte optimization must preserve dimensions; strict mode also preserves every decoded RGBA pixel.

## Forest Plaza production proof

`assets/world/plaza/forest-plaza-tileset-v2.png` remains the current large real-world proof for the sheet-to-runtime side of the bridge:

- image dimensions: 1448×1086;
- 146 irregular frames registered;
- stable legacy IDs `asset-001..asset-146`;
- semantic `fp_*` names;
- 7 creator categories;
- runtime manifest loaded from `src/environment/generated/forest-plaza-tileset-v2-manifest.js`;
- templates registered by `src/property/forest-plaza-asset-catalog.js`;
- Studio Asset Palette can filter the resulting templates by visual folders.

Byte-optimizer savings on production assets must be recorded by the new report before claiming a real-world percentage.

## Categories in reference set

`plaza_core`, `architecture`, `garden_decor`, `water_features`, `terrain_paths`, `market_props`, `nature_trees_rocks`.

## Failure policy

- invalid/corrupt PNG → skip, never rewrite;
- unsupported PNG encoding → skip, never rewrite;
- strict pixel mismatch → candidate rejected;
- adaptive alpha/edge/quality gate failure → candidate rejected;
- no adaptive candidate approved → strict fallback;
- no smaller approved candidate → keep original;
- no foreground → zero assets / block publish;
- ambiguous semantics → review required;
- invalid review JSON → apply nothing;
- collider heuristic → review-required, never production by default;
- unsupported/oversized source → reject before decode;
- duplicate ID → preserve canonical existing identity and report conflict.

## Online boundary

Local analysis, byte optimization and Studio preview are drafts/build-time operations. Durable publication crosses existing repo/content authority. No browser-only publication state and no gameplay authority is introduced.

## Tests / CI

- `node scripts/asset-space-compiler-audit.mjs` — proves a representative low-color RGBA fixture becomes smaller while `changedPixels=0` and alpha remains exact;
- `scripts/asset-space-compiler.mjs` dry-run against real assets — measures savings without replacing files;
- keep `audit:asset-sheet`, documentation audit, compiler CI and runtime/catalog checks green;
- for mobile World integration, real-device QA remains required because asset size reductions can help Safari memory but do not by themselves prove runtime stability.

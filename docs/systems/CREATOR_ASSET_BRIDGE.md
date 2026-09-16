# Creator Asset Bridge V1.3 — Source → Authoring → Delivery

## Status

- owner: `Kelo Creator Asset Bridge`
- PNG byte optimizer: `src/creators/assets/png-space-optimizer.mjs`
- PNG external tournament: `src/creators/assets/png-codec-tournament.mjs`
- PNG adaptive search: `src/creators/assets/png-adaptive-optimizer.mjs`
- deterministic quality agent: `src/creators/assets/png-quality-agent.mjs`
- asset image profiler: `src/creators/assets/asset-image-profiler.mjs`
- runtime variant lab: `src/creators/assets/runtime-image-variants.mjs`
- sheet compiler: `src/creators/assets/asset-sheet-compiler.mjs`
- foreground: `src/creators/sprite-compiler/sprite-foreground-analysis.mjs`
- world profile: `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs`
- semantic bridge: `src/creators/assets/kelo-creator-asset-bridge.mjs`
- CLI ingest surface: `scripts/asset-space-compiler.mjs`
- deep tournament CLI: `scripts/asset-codec-tournament.mjs`
- byte transport: `CHATGPT_ASSET_UPLOAD_BRIDGE.md`
- runtime consumers: `KELO_ATLAS_CONTRACT` + `KELO_PROPERTY_CATALOG`
- playerVisible: false
- status: creator-local-file-bridge-v1.3-meta-space-gate-candidate

## Contract

El bridge optimiza cómo se representa y entrega el arte sin convertirse en un renderer ni en un segundo asset system. Después, el compiler existente continúa detectando sourceRects, grupos, anchors y manifest.

Flujo objetivo:

`SOURCE PNG → PROFILE → LOSSLESS TOURNAMENT → QUALITY GATE → AUTHORING PNG → SHEET COMPILER → MANIFEST/CATALOG`

En paralelo, sin mutar la fuente:

`AUTHORING/SOURCE → RUNTIME CODEC LAB → QUALITY GATE → DELIVERY VARIANT(S)`

Tres niveles quedan separados:

1. **SOURCE** — evidencia/canónico. Nunca se destruye por una optimización adaptativa.
2. **AUTHORING** — PNG menor demostrado equivalente; sigue siendo apto para herramientas, manifests y debugging.
3. **DELIVERY** — formato de descarga/runtime opcional. Puede ser PNG, WebP o AVIF según perfil, soporte y evidencia. Elegir una variante no modifica geometría, identidad ni metadata de gameplay.

La publicación de una variante DELIVERY al runtime es una decisión separada del laboratorio. Este sistema genera y demuestra candidatos; no reescribe automáticamente `KELO_ATLAS_CONTRACT` ni el boot.

## Image Profiler

`asset-image-profiler.mjs` inspecciona nombre/ruta y píxeles para elegir política antes de comprimir. Mide colores, alpha, densidad de bordes, cobertura de paleta, bordes exteriores y señales de pixel art.

Perfiles actuales:

- `tile` → `seam-safe`;
- `pixel-art`, `pixel-sprite`, `pixel-atlas` → `pixel-art`;
- `ui` → `ui-crisp`;
- `fx` → `fx-alpha`;
- sprites/ilustraciones restantes → `balanced` cuando corresponda.

El profiler no tiene autoridad visual/runtime: solo selecciona restricciones y candidatos.

## Quality Agent

`png-quality-agent.mjs` es el gate duro. Compara RGBA decodificado, no el nombre del encoder ni la apariencia del archivo comprimido.

Métricas actuales:

- igualdad de píxel;
- píxeles cambiados y ratio;
- MAE/RMSE/PSNR RGB;
- delta RGB máximo;
- cambios y delta máximo de alpha;
- error de bordes/luminancia;
- ratio de deltas grandes;
- píxeles del borde exterior modificados;
- error RGB medio/máximo del borde exterior.

### Strict

`strict` exige `changedPixels === 0`. Un encoder externo nunca es confiado por su exit code: su resultado vuelve a decodificarse y debe probar igualdad exacta.

### Seam-safe

Los tiles repetibles son tratados de forma especial. El borde exterior debe permanecer exacto (`borderMeanAbsRgb=0`, `borderMaxRgbDelta=0`) para evitar seams visibles al repetir la textura.

### Adaptive

Las políticas `pixel-art`, `ui-crisp`, `fx-alpha` y `balanced` tienen límites diferentes. Alpha continúa bloqueado por defecto. Si un candidato falla cualquier hard metric, queda fuera aunque pese mucho menos.

Una revisión visual/LLM futura puede funcionar como veto o advisory, pero jamás puede sobreescribir un hard gate fallido.

## PNG lossless tournament

### Kelo optimizer

`optimizePngLossless()` explora:

- PNG filters 0..4 + selección adaptativa por fila;
- varios perfiles DEFLATE;
- conversión exacta a PNG indexado cuando existen `<=256` colores RGBA compatibles;
- original como baseline.

### External tournament

`optimizePngTournament()` puede hacer competir, cuando estén instalados:

- Kelo lossless;
- OxiPNG;
- ZopfliPNG;
- Efficient Compression Tool (ECT).

La razón de competir es que no existe un preset universalmente ganador. El torneo elige el menor **después** de validar:

- dimensiones;
- RGBA exacto;
- chunks visuales sensibles (`gAMA`, `cHRM`, `sRGB`, `iCCP`, `sBIT`).

Los candidatos usan archivos temporales. La fuente nunca se pasa a un external optimizer para modificación en sitio.

## Adaptive PNG

`optimizePngAdaptive()` usa Sharp/libimagequant para explorar paletas. La cantidad de colores a probar se reduce o amplía según el profiler. Para pixel art se mantiene dithering 0 en esta fase para evitar ruido no deseado.

Sharp conserva metadata en los candidatos. Cada salida se vuelve a apretar lossless y después se evalúa. Siempre existe un baseline `strict-lossless`; si adaptive no demuestra una mejora permitida, no gana.

## Runtime codec lab

`runtime-image-variants.mjs` investiga formatos de entrega sin cambiar el SOURCE:

- PNG strict;
- WebP lossless con preservación de RGB transparente (`exact`);
- AVIF lossless;
- WebP adaptativo, solo en perfiles donde está permitido;
- AVIF adaptativo 4:4:4, solo en perfiles donde está permitido.

Cada formato se decodifica nuevamente a RGBA y pasa por el mismo Quality Agent. Un formato moderno no gana por ser moderno: gana por bytes + gate.

Actualmente los assets `pixel-critical` y `seam-critical` se mantienen conservadores: no entran automáticamente en tracks adaptativos WebP/AVIF. Lossless sí puede competir.

## KTX2 / Basis — horizonte WebGL

KTX2/Basis es una futura pista de DELIVERY para cuando una superficie de Kelo World use WebGL/WebGPU como textura GPU. Puede reducir descarga **y** memoria GPU porque evita mantener todas las texturas como RGBA completas después de la carga.

No se activa para el Canvas 2D actual: meter KTX2 ahora obligaría a introducir un consumidor/runtime distinto y violaría la regla de owner. Se añadirá únicamente cuando exista una ruta gráfica que pueda consumir texturas GPU comprimidas de forma nativa y tenga medición iPhone real.

## Captura y evidencia

`scripts/asset-space-compiler.mjs` funciona dry-run por defecto y permite `--write` únicamente después del gate.

Con `--capture` genera:

- `ANTES` — bytes fuente;
- `DESPUÉS` — candidato elegido;
- `DIFERENCIA ×8` — mapa transparente donde solo aparecen píxeles modificados;
- cantidad de píxeles cambiados + delta máximo;
- perfil detectado y policy;
- `report.json` completo;
- `index.html` mobile-friendly para auditoría humana.

En STRICT, el diff debe quedar vacío.

Ejemplos:

```bash
node scripts/asset-space-compiler.mjs --input=assets --mode=strict --capture
node scripts/asset-space-compiler.mjs --input=assets --mode=strict --capture --write
node scripts/asset-space-compiler.mjs --input=C --mode=adaptive --capture --write
node scripts/asset-codec-tournament.mjs --input=assets --max-files=6 --emit-variants
```

El input es configurable. Una futura carpeta `C` puede conectarse sin introducir otro owner.

## Ownership

- bytes/profile/quality/tournament/delivery candidates: `Kelo Creator Asset Bridge` support capability;
- foreground/background: `sprite-foreground-analysis.mjs`;
- heterogeneous grouping + sourceRects: `asset-sheet-compiler.mjs`;
- anchor/footprint/scale profile: `sprite-world-asset-compiler.mjs`;
- semantic review: file bridge;
- atlas runtime: Atlas Contract;
- templates: Property Catalog;
- map placement: Studio/World/Map Forge owners.

## Invariants

- nunca cambiar dimensiones durante optimización;
- nunca permitir que ahorro de bytes ignore un hard quality gate;
- strict siempre preserva RGBA exacto;
- seam-safe preserva borde exterior exacto;
- SOURCE nunca se sobrescribe por DELIVERY variants;
- metadata de color sensible debe preservarse o demostrarse visualmente equivalente;
- sourceRects y IDs del asset compiler no dependen del codec de entrega;
- publicación runtime permanece separada de generación de candidatos.

## Semantic review rule

Names, family, category, layer, confidence and notes may change. Stable sourceRects/identity must not be silenciosamente re-cut. Byte optimization preserva dimensiones; strict preserva cada RGBA decodificado.

## Forest Plaza production proof

`assets/world/plaza/forest-plaza-tileset-v2.png` sigue siendo la prueba real del bridge sheet→runtime:

- 1448×1086;
- 146 frames irregulares;
- IDs legacy `asset-001..asset-146` preservados;
- nombres `fp_*` y 7 categorías;
- manifest generado consumido por Atlas Contract/Property Catalog/Studio.

Cualquier porcentaje de ahorro del nuevo Space Compiler sobre producción debe salir del reporte real; nunca se extrapola desde fixtures.

## Failure policy

- PNG inválido/corrupto/unsupported → skip, nunca rewrite;
- mismatch strict → reject;
- cambio de metadata visual sensible en tournament → reject;
- cambio de borde en `seam-safe` → reject;
- adaptive alpha/edge/border/quality fail → reject;
- no adaptive candidate → strict fallback;
- no candidato menor aprobado → conservar original;
- external tool absent/falla → continuar con candidatos válidos;
- no foreground → bloquear publish de sheet;
- review semántico inválido → aplicar nada.

## Online boundary

Optimización, profiling y variantes son operaciones build/publish-time. No introducen gameplay authority ni estado duradero de navegador. Publicación durable cruza la autoridad de contenido existente.

## Tests / CI

- `scripts/asset-space-compiler-audit.mjs` — lossless exact fixture;
- `scripts/asset-space-meta-audit.mjs` — profiler, seam hard gate y tournament fallback;
- `scripts/asset-space-compiler.mjs` — dry-run de PNG reales;
- `scripts/asset-codec-tournament.mjs` — laboratorio profundo manual con variantes;
- `audit:asset-sheet` y `audit:docs` deben permanecer verdes;
- runtime/boot no cambia en este pass, por lo que la validación iPhone de gameplay se reserva para el futuro pass que realmente promueva DELIVERY variants al runtime.

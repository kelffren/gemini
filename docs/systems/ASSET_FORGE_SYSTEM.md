# Kelo World — Asset Forge System

## Propósito
Asset Forge es el editor local/mobile-first para crear, revisar, reparar, empaquetar y preparar assets 2D de Kelo World. Su objetivo no es copiar Photoshop: debe reducir el trabajo que un creador necesita para convertir pixel art en un asset compatible con el juego.

## Owner
- **Owner:** Kelo Asset Forge dentro de Kelo Creators.
- **Composition root:** `src/creators/workspaces/asset-forge-workspace.mjs`.
- **UI base:** `src/creators/ui/asset-forge-workspace.mjs`.
- **Contrato:** `src/creators/assets/kelo-asset-contract.mjs`.
- **Plantillas:** `src/creators/assets/asset-template-registry.mjs`.
- **Controles de plantilla:** `src/creators/ui/asset-forge-template-controls.mjs`.
- **Drawing primitives:** `src/creators/assets/asset-forge-drawing-engine.mjs`.
- **Drawing controls:** `src/creators/ui/asset-forge-drawing-controls.mjs`.

Asset Forge no posee gameplay rendering, equipamiento runtime, pagos, moderación global ni credenciales remotas.

## Estado actual
Activo como workspace lazy de Kelo Creators. El editor posee canvas pixel-art, import, local QA, safe auto-repair, IndexedDB library, export de paquete y preview local de listing.

Sobre el canvas base se cargan enhancers fail-open. El enhancer de templates hace el editor consciente del tipo de asset. El Drawing Engine V2 mejora el trazo sin crear un editor paralelo.

### Drawing Engine V2
- interpolación Bresenham entre muestras del dedo para evitar huecos cuando iOS entrega movimientos espaciados;
- consumo de `PointerEvent.getCoalescedEvents()` cuando el navegador lo ofrece;
- `Pixel Perfect` de 1 px que elimina dobles en esquinas tipo L;
- pincel de 1–4 px;
- pencil / eraser / exact-color fill / picker;
- line / rectangle / ellipse;
- mirror horizontal y vertical combinables;
- alpha lock;
- grid toggle;
- historial local de 60 pasos para las operaciones del enhancer;
- nearest-neighbor/pixelated rendering preservado por el canvas base.

El drawing engine no tiene timers, observers ni render loop. Sólo trabaja durante eventos de puntero y restaura/previsualiza un `ImageData` de máximo 64×64 en Asset Forge V1.

### Templates V1
- `prop`: asset libre, preserva categorías como `nature`, `structure`, `floor`, etc.
- `wearable`: base genérica de equipo visual.
- `helmet`: slot `head`, hair occlusion, face safe area, capas recomendadas y 4 direcciones.
- `pants`: slot `legs`, pelvis/legs safe area, capas recomendadas y 4 direcciones.

La selección puede ser explícita desde `GAME TEMPLATE` o inferida por nombre/tags (`casco`, `helmet`, `pantalón`, `pants`, `jeans`, etc.).

## Contrato / API
### `asset-forge-drawing-engine.mjs`
Funciones puras reutilizables:
- `linePoints()`;
- `appendInterpolatedPath()`;
- `simplifyPixelPerfect()`;
- `mirrorPixelPoints()`;
- `brushStampPoints()`;
- `rectangleOutlinePoints()`;
- `ellipseOutlinePoints()`;
- `floodFillImageData()`;
- helpers RGBA/unique points.

### `asset-template-registry.mjs`
- `listAssetTemplates()`;
- `getAssetTemplate(id)`;
- `inferAssetTemplateId(input)`;
- `applyAssetTemplateMetadata(input)`;
- `evaluateTemplateCompliance(input)`;
- `createAssetTemplateSeed(id)`.

### `kelo-asset-contract.mjs`
`createKeloAssetManifest()` conserva `kelo.asset.v1` y añade metadata aditiva `authoring` con template, slot, capas previstas, direcciones, estados de preview y oclusiones.

`evaluateAsset()` reutiliza el QA existente y suma advertencias de zona segura, tamaño/categoría/template cuando corresponda.

## Flujo visible
1. El creador abre el mismo Asset Forge.
2. Los enhancers de templates y dibujo se cargan lazy; si uno falla, el editor base sigue abriendo.
3. Selecciona un template o empieza libre.
4. Dibuja con el dedo/lápiz; el motor interpola el trazo y opcionalmente aplica Pixel Perfect/symmetry/alpha lock.
5. `SELF CHECK` combina QA de píxeles + QA del template.
6. `AUTO REPAIR` mantiene sólo reparaciones locales conservadoras.
7. `SAVE` persiste localmente; `EXPORT` produce el paquete existente.
8. `LIST MARKET` sigue siendo un listing local; no implica pagos/moderación reales.

## Por qué PixelLab funciona y qué reutilizamos
Investigación actualizada 2026-09:

PixelLab.ai separa dos responsabilidades. Su editor avanzado no intenta reemplazar todo el conocimiento acumulado de un editor: integra **Pixelorama**, un editor open source con licencia MIT, y añade encima sus herramientas propietarias de generación/edición asistida. PixelLab ofrece además un creador web ligero para móvil, mientras su integración Pixelorama completa se orienta a desktop.

Las ideas transferibles al runtime local de Kelo son:
- dibujo determinista instantáneo primero;
- IA como capa opcional encima, no dentro de cada movimiento del pincel;
- Pixel Perfect;
- mirror/symmetry;
- alpha lock;
- selección/inpainting mediante máscara;
- palette targeting;
- referencia/init image;
- 4/8 directional generation;
- skeleton-guided animation;
- iteración manual → generación → corrección → nueva generación.

PixelLab documenta que su Rotate genera vistas direccionales y recomienda corregir manualmente resultados parciales y reutilizarlos como init images, congelando regiones con inpainting. Su animador por skeleton usa poses reutilizables y el mismo ciclo de corrección progresiva. Eso encaja con el roadmap de Kelo: el artista conserva control y la automatización reduce trabajo repetitivo.

### Límite de copia
No se copian modelos, pesos, prompts internos ni backend propietario de PixelLab. El comportamiento del drawing engine local se inspira en técnicas estándar de raster/pixel art y en Pixelorama, cuyo código se publica bajo MIT. La implementación JavaScript de Kelo es propia y está adaptada al canvas móvil del juego.

## Referencias de dibujo
- Pixelorama docs: Pencil/Eraser, Pixel Perfect, Bucket, shapes, picker, symmetry y selección.
- Pixelorama `Drawers.gd`: referencia MIT para la lógica conceptual de eliminación de dobles de esquina y mirror-aware drawing.
- PixelLab docs: Pixelorama integration, Rotate, Inpaint/Inpaint v3, 8-directional sprite, skeleton animation, target palette/init image.
- Aseprite: timeline/tags/slices/indexed palettes/sprite-sheet export.
- Pro Motion NG: pixel-perfect, multi-frame transforms, palette/dithering/tile tooling.

## Local vs online authority
Todo el authoring de este pass es local. Ninguna herramienta de dibujo concede ownership económico ni publica a un marketplace remoto. El servidor/commerce deberá validar cualquier publicación real futura.

## Persistencia
No se crea una base adicional. Se reutilizan los stores IndexedDB existentes de Asset Forge. La metadata `authoring` viaja dentro del manifest guardado/exportado. El historial del Drawing Engine V2 vive sólo durante la sesión de edición.

## Invariantes
1. No crear otro pixel editor paralelo.
2. Ninguna herramienta de dibujo puede alterar gameplay authority.
3. El drawing enhancer debe ser lazy y fail-open.
4. El trazo básico debe funcionar offline y sin IA.
5. No aplicar smoothing/bilinear al pixel art.
6. `prop` debe preservar categorías no-wearable existentes.
7. Las reglas de safe area son QA/authoring; no son hitboxes ni collision authority.
8. No simular publicación remota ni pagos.

## Roadmap derivado de la investigación
### P0 — Dibujo móvil sólido
- [x] interpolación sin huecos;
- [x] Pixel Perfect 1 px;
- [x] brush size;
- [x] mirror X/Y;
- [x] alpha lock;
- [x] line/rectangle/ellipse;
- [x] grid toggle;
- [ ] pan/zoom táctil dedicado sin pelear con el pincel;
- [ ] cursor/brush preview;
- [ ] filled shapes + dithering patterns.

### P1 — Pixel editor profesional mínimo
- layers + groups + visibility/lock/opacity;
- clipping mask;
- marquee + lasso + select-by-color/magic wand;
- move/flip/rotate/nearest-neighbor scale;
- palette panel + replace color + shading ramp + dithering;
- custom brushes.

### P2 — Kelo-aware automation
- body/reference mask real por dirección y frame;
- preview sobre avatar existente;
- recolor variants sobre paleta indexada;
- inpainting mask local/AI-adapter contract;
- generar/propagar 4 u 8 direcciones;
- frame confidence + sólo pedir corrección humana donde falle;
- skeleton/anchor-guided clothing propagation.

### P3 — Animación y productividad
- timeline de layers/frames;
- onion skin;
- tags `idle/walk/run/attack` y direction sets;
- linked cels/reuse de partes;
- multi-frame transform/selection;
- sprite-sheet export por tags + metadata/pivots.

### P4 — Economía de creadores
- versionado del asset/source;
- variant bundles sin duplicar raster cuando sea posible;
- preview animado de marketplace;
- licensing/attribution fields;
- moderation + server validation + commerce authority antes de venta real.

## Extension points
Las nuevas primitivas de dibujo deben entrar en `asset-forge-drawing-engine.mjs` como funciones puras y ser consumidas por el enhancer. Un nuevo tipo de ropa debe añadirse al template registry, no como workspace nuevo. La futura IA debe entrar por adapters explícitos y nunca ser requisito para el pincel local.

## Anti-patrones
- Duplicar Photoshop entero antes de resolver compatibilidad con Kelo World.
- Hacer una llamada de IA por movimiento del dedo.
- Aplicar bilinear filtering a pixel art.
- Usar auto-repair agresivo que invente arte.
- Hardcodear casco/pantalón dentro de gameplay.
- Exportar sprites sin metadata de slot/dirección/estado.
- Meter credenciales o secretos de proveedores en el cliente.

## Tests / CI
- `tests/asset-template-registry.test.mjs`: inferencia/manifest/QA de templates.
- `tests/asset-forge-drawing-engine.test.mjs`: Bresenham, interpolación, Pixel Perfect, mirror, shapes, flood fill y alpha-lock.

El repositorio no tenía un workflow GitHub Actions de esta capacidad en el snapshot revisado; las pruebas se pueden ejecutar con Node en un checkout del branch.

## Observabilidad
Los fallos de cada enhancer se registran como warning desde el workspace manifest y el editor base permanece disponible. `SELF CHECK` continúa siendo la verificación visible canónica del asset.

## Deuda conocida
- El enhancer todavía se acopla a algunos selectores DOM del editor base; conviene exponer un API formal de drawing/session state desde `asset-forge-workspace.mjs`.
- No existe aún pan/zoom multitouch dedicado.
- No existen layers/timeline reales de authoring.
- No existe body-mask raster real por frame/dirección.
- No existe preview real `TEST IN GAME` desde Asset Forge todavía.
- Los listings actuales son locales.

## Checklist al extender
- [ ] Reutilizar Kelo Creators/Asset Forge.
- [ ] Añadir primitiva al drawing engine o template al registry; no crear editor paralelo.
- [ ] Confirmar touch/iPhone.
- [ ] Mantener editor lazy y fail-open.
- [ ] Añadir test puro para toda nueva geometría de píxeles.
- [ ] Mantener nearest-neighbor/pixelated rendering.
- [ ] Separar authoring QA de gameplay authority.

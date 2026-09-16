# Kelo World — Asset Forge System

## Propósito
Asset Forge es el editor local/mobile-first para crear, revisar, reparar, empaquetar y preparar assets 2D de Kelo World. Su objetivo no es copiar Photoshop: debe reducir el trabajo que un creador necesita para convertir pixel art en un asset compatible con el juego.

## Owner
- **Owner:** Kelo Asset Forge dentro de Kelo Creators.
- **Composition root:** `src/creators/workspaces/asset-forge-workspace.mjs`.
- **UI existente:** `src/creators/ui/asset-forge-workspace.mjs`.
- **Contrato:** `src/creators/assets/kelo-asset-contract.mjs`.
- **Plantillas:** `src/creators/assets/asset-template-registry.mjs`.
- **Controles de plantilla:** `src/creators/ui/asset-forge-template-controls.mjs`.

Asset Forge no posee gameplay rendering, equipamiento runtime, pagos, moderación global ni credenciales remotas.

## Estado actual
Activo como workspace lazy de Kelo Creators. El editor existente posee canvas pixel-art, pencil/eraser/fill/pick, undo/redo, import, local QA, safe auto-repair, IndexedDB library, export de paquete y preview local de listing.

Este pass añade **game-aware templates** sin crear un editor/runtime paralelo.

### Templates V1
- `prop`: asset libre, preserva categorías como `nature`, `structure`, `floor`, etc.
- `wearable`: base genérica de equipo visual.
- `helmet`: slot `head`, hair occlusion, face safe area, capas recomendadas y 4 direcciones.
- `pants`: slot `legs`, pelvis/legs safe area, capas recomendadas y 4 direcciones.

La selección puede ser explícita desde `GAME TEMPLATE` o inferida por nombre/tags (`casco`, `helmet`, `pantalón`, `pants`, `jeans`, etc.).

## Contrato / API
### `asset-template-registry.mjs`
- `listAssetTemplates()`
- `getAssetTemplate(id)`
- `inferAssetTemplateId(input)`
- `applyAssetTemplateMetadata(input)`
- `evaluateTemplateCompliance(input)`
- `createAssetTemplateSeed(id)`

### `kelo-asset-contract.mjs`
`createKeloAssetManifest()` conserva `kelo.asset.v1` y añade metadata aditiva `authoring`:
- schema de template;
- `templateId`;
- `slot`;
- `layerPlan`;
- `directions`;
- `previewStates`;
- `occludes`.

`evaluateAsset()` reutiliza el QA existente y suma advertencias de zona segura, tamaño/categoría/template cuando corresponda.

## Flujo visible
1. El creador abre el mismo Asset Forge.
2. Selecciona `Free Asset`, `Wearable`, `Helmet / Casco` o `Pants / Pantalón`.
3. El template completa metadata necesaria y muestra slot/capas/preview esperado.
4. El creador dibuja o importa una imagen.
5. `SELF CHECK` combina QA de píxeles + QA del template.
6. `AUTO REPAIR` mantiene sólo reparaciones locales conservadoras.
7. `SAVE` persiste localmente; `EXPORT` produce el paquete existente.
8. `LIST MARKET` sigue siendo un listing local; no implica pagos/moderación reales.

## Local vs online authority
Todo el authoring de este pass es local. Ningún template concede ownership económico ni publica a un marketplace remoto. El servidor/commerce deberá validar cualquier publicación real futura.

## Persistencia
No se crea una base adicional. Se reutilizan los stores IndexedDB existentes de Asset Forge. La metadata `authoring` viaja dentro del manifest guardado/exportado.

## Invariantes
1. No crear otro pixel editor paralelo.
2. Ninguna plantilla puede alterar gameplay authority.
3. `prop` debe preservar categorías no-wearable existentes.
4. Las reglas de safe area son QA/authoring; no son hitboxes ni collision authority.
5. Las mejoras visuales deben ser lazy y no entrar al boot normal del juego.
6. Fallar al cargar los template controls no debe impedir abrir Asset Forge.
7. No simular publicación remota ni pagos.

## Investigación de herramientas (2026-09)
Referencias revisadas:
- Aseprite docs: timeline, tags, slices/pivots, indexed palettes, shading, pixel-perfect, sprite-sheet export y scripting.
- Pixelorama docs: layer groups, clipping masks, non-destructive layer effects, indexed mode, animation y tilemaps.
- Pro Motion NG: pixel-perfect drawing, animation/image layers, multi-frame selections, custom/animated brushes, symmetry, dithering, palette tooling y tilemaps.
- Lospec Palette List: interoperabilidad de paletas (`PNG`, `PAL`, Photoshop `ASE`, `GPL`, `HEX`).
- Discusiones recientes de creadores: modular equipment/paper-doll workflows siguen sufriendo por copiar cambios a muchos frames, separar ropa plana manualmente y sincronizar equipamiento con animaciones.

## Roadmap derivado de la investigación
### P0 — Creator usable para ropa/equipo
- Template registry extensible: hair, shirt, shoes, cape, sword, shield.
- Body/reference mask real por dirección y frame.
- Preview sobre avatar existente; no mock.
- Validar missing directions/frames antes de export.
- Recolor variants sobre paleta indexada.

### P1 — Pixel editor profesional mínimo
- Layers + groups + visibility/lock/opacity.
- Clipping mask / alpha lock.
- Marquee + lasso + select-by-color.
- Move/flip/rotate/nearest-neighbor scale.
- Symmetry/mirror.
- Pixel-perfect freehand.
- Palette panel + replace color + shading ramp + dithering.

### P2 — Animación y productividad
- Timeline de layers/frames.
- Onion skin.
- Tags `idle/walk/run/attack` y direction sets.
- Linked cels/reuse de partes para evitar editar 100 frames a mano.
- Multi-frame transform/selection.
- Sprite-sheet export por tags + metadata/pivots.

### P3 — Economía de creadores
- Versionado del asset/source.
- Variant bundles sin duplicar raster cuando sea posible.
- Preview animado de marketplace.
- Licensing/attribution fields.
- Moderation + server validation + commerce authority antes de venta real.

## Extension points
Un nuevo asset tipo ropa debe añadirse como definición al registry, no como workspace nuevo. La plantilla puede definir slot, safe bounds, anchor, tags, occlusion, layer plan, directions y preview states. El futuro avatar preview debe consumir ese contrato y mapearlo al owner real de apariencia/equipment.

## Anti-patrones
- Duplicar Photoshop entero antes de resolver compatibilidad con Kelo World.
- Hardcodear casco/pantalón dentro de gameplay.
- Exportar una spritesheet sin metadata de slot/dirección/estado.
- Aplicar bilinear filtering a pixel art.
- Usar auto-repair agresivo que invente arte.
- Convertir warnings de authoring en hitboxes o collision runtime.
- Meter servicios AI/API en el cliente con secretos.

## Tests / CI
`tests/asset-template-registry.test.mjs` cubre inferencia de casco/pantalón, metadata, tags/slots, seeds y template safe-area QA. El repositorio no contiene workflows en `.github/workflows` en el snapshot revisado; la prueba puede ejecutarse con Node en un entorno que tenga el checkout del branch.

## Observabilidad
Los fallos del enhancer se registran como warning y el workspace base permanece disponible. El QA visible sigue usando el panel `SELF QA + REPAIR` ya existente.

## Deuda conocida
- El template selector es una mejora progresiva sobre el DOM existente; conviene promover un API explícito de fields/template en `asset-forge-workspace.mjs` cuando se refactorice ese editor.
- Todavía no existe body-mask raster real por frame/dirección en Asset Forge V1.
- No existe timeline/layers de authoring todavía.
- No existe preview real `TEST IN GAME` desde Asset Forge todavía; no debe fingirse hasta conectar el renderer/avatar owner.
- Los listings actuales son locales.

## Checklist al extender
- [ ] Reutilizar Kelo Creators/Asset Forge.
- [ ] Añadir template, no workspace paralelo.
- [ ] Definir slot/safe area/anchor/layers/directions/states.
- [ ] Añadir test de inferencia + manifest + QA.
- [ ] Confirmar mobile touch.
- [ ] Mantener editor lazy.
- [ ] Confirmar que categorías legacy no cambian.
- [ ] Separar authoring QA de gameplay authority.

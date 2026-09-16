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
- **Editor Pro:** `src/creators/ui/pixelorama-pro-bridge.mjs`.
- **Lifecycle pesado:** `src/creators/core/creator-exclusive-runtime.mjs`.

Asset Forge no posee gameplay rendering, equipamiento runtime, pagos, moderación global ni credenciales remotas.

## Estado actual
Activo como workspace lazy de Kelo Creators. El editor base posee canvas pixel-art, import, local QA, safe auto-repair, IndexedDB library, export de paquete y preview local de listing.

Sobre el canvas base se cargan enhancers fail-open. El enhancer de templates hace el editor consciente del tipo de asset. Drawing Engine V2 mejora el trazo sin crear un editor paralelo. **Pixelorama Pro** es la superficie profesional opcional para layers, timeline, onion skin, selection, palettes, tilemaps, efectos y demás capacidades completas de Pixelorama Web sin reconstruirlas dentro del editor ligero.

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

El drawing engine no tiene render loop propio. Sólo trabaja durante eventos de puntero y restaura/previsualiza un `ImageData` de máximo 64×64 en Asset Forge V1/V2.

### Pixelorama Pro V2
- se abre únicamente tras una acción explícita `PIXELORAMA PRO`;
- todo ocurre dentro de Kelo World; el flujo de producto no navega a una pestaña externa;
- antes de arrancar Godot/WASM adquiere `Creator Exclusive Runtime`: input bloqueado, movement/render interceptados, simulation suspendida y atlases no-core sin referencias expulsables;
- el runtime Web vive en `tools/pixelorama/index.html` dentro de un iframe aislado y destruible;
- el build pesado no entra al boot normal ni se versiona como WASM/PCK dentro de `gemini`;
- Canvas/PXO se transfieren como `ArrayBuffer` cuando el bridge aplicable lo permite;
- exports de imagen vuelven al import/QA canónico de Asset Forge;
- `.pxo` se conserva en IndexedDB como source project, con máximo 5 revisiones por asset;
- al cerrar se solicita `requestQuit`, `Engine.unload`, se destruye el iframe y se liberan todos los claims del juego.

Detalles y limitaciones: `docs/systems/PIXELORAMA_PRO_BRIDGE.md` y `docs/systems/CREATOR_EXCLUSIVE_RUNTIME.md`.

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
1. El creador abre Asset Forge.
2. Templates/drawing/Pixelorama bridge se cargan lazy y fail-open; si un enhancer falla, Asset Forge base sigue disponible.
3. Puede dibujar rápido en el canvas local o abrir `PIXELORAMA PRO` para authoring avanzado.
4. Pixelorama Pro hiberna trabajo pesado del juego antes de levantar Godot/WASM.
5. El arte que regresa pasa por `SELF CHECK`, QA/template rules y `AUTO REPAIR` conservador.
6. `SAVE` persiste el asset local; `.pxo` profesional se guarda como source project separado.
7. `EXPORT` produce el paquete existente.
8. `LIST MARKET` sigue siendo un listing local; no implica pagos/moderación reales.

## Local vs online authority
Todo el authoring de este sistema es cliente/local. Ninguna herramienta de dibujo, Pixelorama, un `.pxo` ni un listing local concede ownership económico o autoridad gameplay. El servidor/commerce deberá validar cualquier publicación real futura.

## Persistencia
- Asset Forge reutiliza `kelo-asset-forge-v1` para assets/listings.
- Pixelorama Pro usa `kelo-pixelorama-projects-v1` para source projects `.pxo` con historial acotado.
- La metadata `authoring` viaja dentro del manifest guardado/exportado.
- El historial del Drawing Engine V2 vive sólo durante la sesión de edición.
- El runtime WASM de Pixelorama no se conserva residente al cerrar; cache HTTP/disco y RAM son contratos separados.

## Invariantes
1. No crear otro Kelo engine ni otro editor de mundo.
2. Ninguna herramienta de dibujo puede alterar gameplay authority.
3. Enhancers y Pixelorama deben ser lazy y fail-open.
4. El trazo básico debe funcionar offline y sin IA.
5. No aplicar smoothing/bilinear al pixel art.
6. `prop` debe preservar categorías no-wearable existentes.
7. Las reglas de safe area son QA/authoring; no son hitboxes ni collision authority.
8. No simular publicación remota ni pagos.
9. Pixelorama pesado y gameplay pesado no deben competir activamente; usar Creator Exclusive Runtime.
10. No eliminar capacidades authoring de Pixelorama para ahorrar RAM: optimizar lifecycle, buffers, history, FPS y residency.
11. No declarar Pixelorama Pro `VERIFIED` en móvil sin prueba real iPhone/LIVE.

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

### P1 — Editor profesional
- [x] integrar Pixelorama Pro como editor avanzado lazy dentro del juego;
- [x] layers/timeline/onion skin/palettes/selection disponibles mediante Pixelorama Web;
- [x] lifecycle de cierre destruye runtime Godot/WASM;
- [ ] desplegar el build custom Kelo-patched cuando vuelva a ser seguro activar su pipeline;
- [ ] validar auto-open/export bridge en Safari iPhone real.

### P2 — Kelo-aware automation
- body/reference mask real por dirección y frame;
- preview sobre avatar existente;
- recolor variants sobre paleta indexada;
- inpainting mask local/AI-adapter contract;
- generar/propagar 4 u 8 direcciones;
- frame confidence + sólo pedir corrección humana donde falle;
- skeleton/anchor-guided clothing propagation.

### P3 — Integración profunda Pixelorama ↔ Kelo
- metadata Kelo dentro de project/layer/cel user data;
- template projects por slot/dirección/estado;
- export preset directo a paquete Kelo;
- virtualizar proyectos inactivos si una sesión multi-tab demuestra presión de RAM;
- medición real de peak RAM y repeated open/close en Safari.

### P4 — Economía de creadores
- versionado del asset/source;
- variant bundles sin duplicar raster cuando sea posible;
- preview animado de marketplace;
- licensing/attribution fields;
- moderation + server validation + commerce authority antes de venta real.

## Extension points
Las nuevas primitivas ligeras entran en `asset-forge-drawing-engine.mjs`. Un nuevo tipo de ropa entra al template registry. Herramientas profesionales genéricas deben aprovechar Pixelorama Pro antes de duplicarse en Asset Forge. La futura IA entra por adapters explícitos y nunca es requisito para el pincel local.

## Anti-patrones
- Duplicar Photoshop/Pixelorama entero dentro del canvas ligero.
- Hacer una llamada de IA por movimiento del dedo.
- Aplicar bilinear filtering a pixel art.
- Usar auto-repair agresivo que invente arte.
- Hardcodear casco/pantalón dentro de gameplay.
- Exportar sprites sin metadata de slot/dirección/estado.
- Meter credenciales o secretos de proveedores en el cliente.
- Precargar WASM/PCK de Pixelorama durante boot.
- Mantener Pixelorama oculto en RAM después de cerrar.

## Tests / CI
- `tests/asset-template-registry.test.mjs`.
- `tests/asset-forge-drawing-engine.test.mjs`.
- `tests/creator-exclusive-runtime.test.mjs`.
- `scripts/pixelorama-runtime-audit.mjs`.

El build custom de Pixelorama tiene un workflow blueprint bajo `.github/workflows-paused-2026-09-15/`; permanece pausado deliberadamente por la política actual de recuperación de Pages.

## Observabilidad
- Los fallos de cada enhancer se registran como warning desde el workspace manifest y el editor base permanece disponible.
- `SELF CHECK` continúa siendo la verificación visible canónica del asset.
- `getCreatorExclusiveSnapshot()` expone claims/lifecycle mientras Pixelorama Pro está abierto.
- `KeloSimulation.snapshot()` expone `suspended`, claims y frames suspendidos.

## Deuda conocida
- El enhancer de dibujo todavía se acopla a algunos selectores DOM del editor base; conviene exponer API formal de session state.
- No existe aún pan/zoom multitouch dedicado en el editor ligero.
- No existe body-mask raster real por frame/dirección.
- No existe preview real `TEST IN GAME` desde Asset Forge todavía.
- Los listings actuales son locales.
- El fallback stock de Pixelorama requiere prueba Safari/iPhone para confirmar auto-open/export sin interacción adicional.
- El custom build Kelo está preparado pero no desplegado mientras los workflows sigan pausados.

## Checklist al extender
- [ ] Reutilizar Kelo Creators/Asset Forge.
- [ ] Evitar duplicar una capacidad profesional que Pixelorama ya proporciona.
- [ ] Confirmar touch/iPhone.
- [ ] Mantener editor lazy y fail-open.
- [ ] Añadir test puro/arquitectural para nueva geometría o lifecycle.
- [ ] Mantener nearest-neighbor/pixelated rendering.
- [ ] Separar authoring QA de gameplay authority.
- [ ] Garantizar teardown completo de runtimes pesados.

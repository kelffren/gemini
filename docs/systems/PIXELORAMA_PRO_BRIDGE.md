# Kelo World — Pixelorama Pro Bridge

## Propósito
Pixelorama Pro es una capacidad opcional de Asset Forge para abrir el editor web oficial de Pixelorama cuando el creador necesita capas, timeline, onion skin, paletas, selección y herramientas avanzadas que no conviene duplicar dentro del editor móvil ligero.

## Owner y frontera
- Owner Kelo: `src/creators/ui/pixelorama-pro-bridge.mjs` dentro de Asset Forge.
- Upstream: Orama Interactive / Pixelorama.
- Pixelorama sigue siendo software de terceros; Kelo no posee su runtime, persistencia ni disponibilidad.
- URL estable usada por el bridge: `https://orama-interactive.github.io/Pixelorama/`.

## Licencia
Pixelorama se publica bajo licencia MIT, copyright Orama Interactive and contributors. La integración actual no redistribuye su build: carga el sitio web oficial bajo demanda. Si en el futuro Kelo aloja una copia del build, deberá incluir el copyright y aviso MIT exigidos por la licencia.

## Rendimiento
No se empaqueta Pixelorama dentro del repositorio ni se precarga durante el boot. El build web oficial observado usa aproximadamente 6.4 MB de PCK y 39.5 MB de WASM, más recursos auxiliares. Por eso el bridge sólo crea el iframe después de una acción explícita `PIXELORAMA PRO`.

## Flujo actual
1. Abrir Asset Forge.
2. Pulsar `PIXELORAMA PRO`.
3. Pixelorama abre en una superficie full-screen aislada dentro del workspace.
4. El creador trabaja en Pixelorama.
5. Exporta PNG o spritesheet desde Pixelorama.
6. Pulsa `IMPORT BACK`.
7. Kelo cierra la superficie Pro y abre el selector `IMPORT` existente de Asset Forge.
8. El archivo vuelve a pasar por normalización, QA, manifest y packaging de Kelo.

`FULLSCREEN` abre el editor oficial en una pestaña separada como fallback para navegadores móviles donde un iframe WebAssembly/Godot tenga limitaciones.

## Invariantes
- Pixelorama nunca entra al boot normal del juego.
- Un fallo de Pixelorama o de la red no debe impedir abrir Asset Forge.
- Kelo no debe fingir que existe sincronización automática de `.pxo` mientras no haya un bridge de datos explícito.
- El archivo que vuelve a Kelo debe seguir pasando por el pipeline canónico de Asset Forge.
- No duplicar el build de ~46 MB+ en el repo salvo decisión explícita y medición de coste.

## Siguiente evolución
- intercambio automático de PNG/spritesheet sin paso manual de descarga/selección;
- soporte `.pxo` como source project preservado junto al asset compilado;
- metadata Kelo dentro de Pixelorama usando project/layer/cel user data;
- templates Kelo para casco, pantalón, armas y avatar;
- export preset de Pixelorama → `.keloasset`;
- investigar una build Kelo-pinned/autohospedada sólo si necesitamos API same-origin o independencia del upstream.

## Referencias
- Pixelorama Web oficial y rama `gh-pages`.
- Pixelorama README / features.
- Pixelorama LICENSE (MIT).
- Pixelorama save/export documentation.

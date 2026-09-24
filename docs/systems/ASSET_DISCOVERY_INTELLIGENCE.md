<!-- KELO-SYSTEM-DOC
system-id: asset-discovery-intelligence
owner: KeloAssetDiscovery
source: src/creators/assets/asset-discovery-intelligence.mjs
contract-version: 1
-->
# Asset Discovery Intelligence

## Propósito
Capa pura de inteligencia para la Asset Library/Studio. Convierte texto + metadata en resultados útiles para construir mapas: clasificación Dungeon/Room/Kit/Module/Prop, ranking por intención, compatibilidad modular, Smart Snap y planes **BUILD WITH THIS**.

## Ownership
**KeloAssetDiscovery** posee únicamente reglas de descubrimiento y composición efímera. No posee catálogo, renderer, World state, colisiones, persistencia ni descargas. Consume metadata existente y devuelve decisiones/planes.

## API
- `classifyAsset(asset)`
- `parseIntent(query)`
- `rankAssets(assets, query, context)`
- `snapCompatibility(source, candidate)`
- `compatibleAssets(source, assets, context)`
- `buildWithThisPlan(seed, assets, context)`

Todas son funciones puras: no fetch, DOM, localStorage ni descarga de GLB/PNG.

## Flujo
`provider metadata → normalize/classify → intent → rank → compatible/snap → BUILD WITH THIS plan → Studio consumer`.

La búsqueda no necesita descargar binarios. Thumbnail/preview/full asset continúan siendo responsabilidad del pipeline de assets y su política lazy.

## Invariantes
1. Buscar nunca descarga el asset original.
2. El ranking no modifica World.
3. Smart Snap devuelve compatibilidad; Studio/World authority decide placement.
4. BUILD WITH THIS es un plan efímero, no publicación.
5. El creador mantiene control: una incompatibilidad no bloquea por sí sola.
6. Coste proporcional al número de metadata records evaluados, no al peso de los assets.

## Online-first
Hoy puede ejecutarse localmente sobre metadata. Mañana el servidor puede devolver el mismo shape de resultados/planes. IDs estables son la frontera; no se envían binarios en consultas de búsqueda.

## Extensión
Siguientes capas compatibles: embeddings semánticos server-side, Dungeon DNA, visual similarity, Style Lock, room topology y telemetría de utilidad. Deben alimentar esta API o extender su contrato; no crear un buscador paralelo.

## Tests
`node tests/asset-discovery-intelligence.test.mjs` cubre clasificación, intención, ranking, snap y BUILD WITH THIS.

## Estado
V1 aislada y reversible. Integración visual con Asset Library/Studio requiere gate separado para no mezclarla con el boot ni con el incidente actual del World Editor.

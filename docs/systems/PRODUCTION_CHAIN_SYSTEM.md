# Kelo World — Production Chain V1

## Propósito
Añade la capa de transformación que faltaba entre recursos, profesiones y economía regional. Reutiliza los owners existentes: inventarios deben resolverse por KeloContainers/autoridad, reputación por KeloArtisanProfession y mercado por KeloRegionalEconomy/Commerce.

## Flujo
`SOURCE → EXTRACT → PROCESS → CRAFT → TRANSPORT → STORE → CONSUME/SELL`.

V1 incluye cadenas iniciales: oliva→pasta→aceite; trigo→harina→pan; uva→vino; mineral+carbón→lingote.

## Owner y API
Owner: `KeloProductionChain`.
API: `getRecipe`, `listRecipes`, `canCraft`, `previewQuality`, `craft`.

Las recetas son data-driven. El motor no contiene ramas por producto.

## Calidad
La calidad final combina calidad del material, expertise y nivel de estación. El resultado es 1..100. La fórmula es determinista y puede ejecutarse en servidor.

## Autoridad / online-first
`craft()` no toca STATE, DOM ni localStorage. Exige un adapter `authority.transact(command)`. Offline puede usar un adapter de KeloContainers; online el servidor valida inventario, estación, profesión, tiempo y entrega outputs. No hay fallback online silencioso.

## Extensión
Para añadir cerveza, queso, pociones o textiles se agrega una RecipeDefinition. Para automatización, logística envía inputs a estaciones y solicita el mismo comando de craft; no se crea otro motor.

## Tests
`node tests/production-chain-system.test.js`.

## Próximo pass
Adapter oficial KeloContainers + estaciones físicas + colas/repeat orders + UI móvil + persistencia server-authoritative.

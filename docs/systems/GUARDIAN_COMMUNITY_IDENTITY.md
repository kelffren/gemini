# Guardian Community Identity

## Objetivo

Hacer visible que los jugadores que donan cómputo forman parte de la construcción de Kelo World sin convertir la contribución en dinero, KC, poder PvP o una ventaja jugable.

## Flujo

1. `KeloGuardianGpuAssets` produce un candidato procedural y el Master valida el resultado por hash/quorum.
2. `KeloGuardianCommunity` escucha `kelo:guardian-asset-candidate`.
3. Se genera una provenance del asset con `assetHash`, cantidad de contribuidores y tokens anónimos.
4. Los tokens se derivan localmente como SHA-256 de `kelo-community-v1|nodeId` y se recortan a 12 hex chars. El `nodeId` no forma parte de la provenance ni del recibo P2P.
5. Si el candidato alcanzó consenso, el Master emite `guardian:community_receipt` con los tokens anónimos.
6. Cada nodo calcula su propio token y solo acepta el recibo si aparece en el conjunto y el mensaje viene del Master Guardian actual.
7. El recibo se guarda localmente y actualiza el panel **Community Builder**.

## Rangos de reconocimiento

Los rangos son reconocimiento visual local y no tienen valor económico:

- Spark: 0 contribuciones validadas.
- Builder: 1.
- Forge: 5.
- Architect: 20.
- Pillar: 100.

La métrica usada es el número de assets comunitarios aceptados por consenso en los que participó el nodo. No se premia hardware más caro ni GPUu anunciadas.

## Provenance para Asset Forge

Evento: `kelo:guardian-asset-provenance`.

Campos relevantes:

- `source: "kelo-community-compute"`
- `assetHash`
- `communityBuilt: true`
- `contributorCount`
- `anonymousContributorTokens`
- `consensus`
- `statement` (por ejemplo `Built with 2 Kelo Guardians`)
- `containsNodeIds: false`
- `requiresAssetForgeQA: true`

`KeloGuardianCommunity.provenanceFor(hash)` permite consultar la provenance efímera del runtime.

## Seguridad y privacidad

- No se publican nombres, IPs, hardware, ubicación ni `nodeId`.
- Los recibos comunitarios P2P tampoco contienen `nodeId` de los contribuidores.
- Solo el Master Guardian actual puede originar un recibo aceptado por un nodo.
- Solo candidatos con consenso generan reconocimiento.
- Los recibos son reconocimiento local; no son prueba económica ni autorizan KC.
- No existe leaderboard autoritativo en esta fase.
- El sistema no crea timers propios ni un segundo game loop.

## UX

Cuando Guardian está encendido aparece un botón `⚡ COMMUNITY BUILDER`. Tras la primera contribución validada muestra el rango y el número de assets ayudados. El panel explica explícitamente que el jugador forma parte del código y conserva un historial local de las contribuciones recientes.

## Evolución futura

Cuando el backend de pruebas de contribución esté conectado a persistencia autoritativa, se podrá añadir perfil cross-device y estadísticas globales. Esas estadísticas deberán derivarse de pruebas aceptadas por servidor, no de contadores del cliente ni de capacidad GPU anunciada.

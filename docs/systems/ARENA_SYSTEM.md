# Kelo Arena Ranked — System Contract

## Propósito

`KeloArena` añade una capa competitiva sobre el PvP action-combat existente sin crear un segundo combat engine. La primera regla publicada es una cola única `3v3 Control`, diseñada para funcionar desde población casi cero mediante bots transparentes y reducirlos progresivamente cuando existan suficientes humanos.

## OWNER

- Runtime/domain owner: `src/systems/arena-system.js` → `window.KeloArena`.
- UI consumer: `src/ui/arena-ui.js` → `window.KeloArenaUI`.
- Combat owner reutilizado: `KeloPvPWorld` + `KeloCombatEngine` + `KeloMeleeEngine` + `KeloHitResolver` + `KeloDamageResolver`.
- Simulation: `KeloSimulation.after(...)`; Arena no crea loop propio.
- Online final: server authority pendiente de completar para matchmaking/rating competitivo real.

## Estado que posee

`KeloArena` posee únicamente:

- lifecycle de cola/match Arena;
- ruleset Arena;
- roster del fallback local;
- score del objetivo Control;
- estado de decisión de bots Arena;
- profile/rating fallback local;
- resultado de la partida.

No posee:

- daño/HP resolution;
- hit geometry;
- movement core;
- ability delivery;
- VFX;
- input core;
- networking transport.

## API pública

- `joinQueue()` / `openQueue()` — entra en la única cola publicada.
- `leaveQueue()` — cancela mientras todavía no comenzó el match.
- `finishMatch(winner, reason)` — cierra una partida activa; en online final esta operación será server-only.
- `abort(reason)` — limpia un match incompleto.
- `getHostileActors(viewer)` — proveedor de actores hostiles para que `KeloPvPWorld` siga usando su mismo CombatEngine.
- `getActorById(id)` — resolución de actor para targeting/aim assist.
- `drawWorld(ctx)` — presentation support invocado desde el renderer PvP ya existente.
- `snapshot()` — snapshot read-only para UI/debug.
- `getRank(mmr?)` — proyección del rango visible.

## Ruleset V1

- modo: `Control`;
- equipos: 3v3;
- una sola cola;
- score objetivo: 100;
- duración máxima: 180 segundos;
- stats Arena normalizados inicialmente a 100 HP / 100 mana;
- bots rellenan huecos del fallback local y siempre llevan `[Bot]` en el nombre;
- el objetivo progresa únicamente cuando dentro de la zona hay presencia de un solo equipo.

## Ranking

El prototipo mantiene dos conceptos separados:

- MMR oculto: número de matchmaking interno;
- rango visible + RP: proyección player-facing.

Tiers V1:

Bronce → Plata → Oro → Platino → Esmeralda → Diamante → Mithril → Adamantita → Etéreo.

La fórmula local es una aproximación Elo para probar el flujo. No constituye la fórmula competitiva final.

## Match Quality

El sistema registra cuántos humanos componen el match. La variación de rating se multiplica por `quality` para que una partida completada principalmente con bots no otorgue el mismo progreso que una partida humana completa.

El fallback local actual tiene un humano y cinco bots, por lo que utiliza el quality floor del ruleset. Esto es deliberado: mantiene Arena jugable sin convertir bots en una granja de rango.

## Bots

Los bots son NPC competitivos transparentes. No se presentan como personas reales.

Cada bot posee una personalidad ligera:

- aggressor;
- guardian;
- tactician;
- assassin;
- support.

La decisión usa utility heuristics sencillas alrededor de:

- vida;
- distancia al enemigo;
- objetivo central;
- aggression/objective/retreat weights.

Cuando atacan reutilizan `KeloCombatEngine.attackSweep(...)`. No escriben HP directamente.

## Flujo local actual

`Arena UI → KeloArena.joinQueue → KeloPvPWorld.enter → transición PvP existente → KeloArena activa roster 3v3 → PvPWorld obtiene hostiles desde KeloArena → CombatEngine resuelve golpes → KeloArena calcula Control/respawns → resultado → restore stats/world → KeloPvPWorld.leave`.

## Online-first

El contrato está preparado para que `joinQueue()` pueda delegar a `KeloNetAuthority.requestArena(...)` cuando exista. Mientras el server Arena no esté implementado por completo, el prototipo usa local fallback.

Antes de permitir Ranked competitivo real, el servidor debe ser autoridad de:

- cola/match assignment;
- identidad human/bot;
- teams;
- normalized effective stats;
- score/control ownership;
- respawn;
- match result;
- MMR/RP;
- anti-abuse;
- disconnect/rejoin;
- bot simulation si el servidor decide rellenar huecos.

El cliente nunca debe poder enviar `winner`, `mmrDelta` o `score` como verdad final.

## Invariantes

1. Arena no crea otro CombatEngine.
2. Arena no crea otro Simulation loop.
3. Bots nunca mutan HP directamente.
4. UI nunca escribe MMR/score/roster.
5. Bots visibles se identifican como `[Bot]`.
6. Stats normalizados se restauran al salir.
7. PvPWorld puede seguir funcionando sin Arena.
8. Match Quality evita progreso completo contra una población mayoritariamente bot.

## Extensión

### Más humanos

La evolución esperada no cambia el client flow: el authority devuelve un roster con más `human` y menos `bot`. `KeloArena` consume el mismo contrato.

### Nuevos modos

No añadir lógica de Escort/Assault dentro del UI. Añadir rulesets/objective primitives reutilizables al owner Arena cuando exista evidencia y tests.

### 1v1 / 5v5

`teamSize` pertenece al ruleset. No hardcodear `3` dentro del combat engine.

## Anti-patrones

- crear `ArenaCombatEngine`;
- crear `RankedDamageResolver`;
- bots aplicando `target.hp -= damage`;
- esconder bots como humanos;
- dar 100% de RP en partidas casi completamente bot;
- meter matchmaking dentro de `arena-ui.js`;
- `setInterval()` propio para IA/score;
- usar localStorage como autoridad online final.

## Tests / CI

- `scripts/arena-system-audit.js` verifica ownership, 3v3 Control, Match Quality, normalized stats, uso de CombatEngine, integración actor-provider, carga runtime y documentación.
- `npm run audit:arena`.
- `npm run audit:docs` protege catálogo/guía.

## Deuda conocida

- El authority server de Arena todavía debe implementar matchmaking/rating persistente y bot simulation autoritativa para multiplayer real.
- El fallback V1 solo representa un humano local; no pretende simular una población online ficticia.
- El balance de bot utility, score rate, MMR K-factor y tier thresholds es tuning inicial, no balance final.

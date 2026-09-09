# Kelo Arena Ranked — System Contract

## Propósito

`KeloArena` añade una capa competitiva sobre el PvP action-combat existente sin crear un segundo combat engine. Publica dos modos reutilizando el mismo owner: `3v3 Control` y `1v1 MOBA`. Ambos pueden funcionar desde población casi cero mediante bots transparentes y reducirlos progresivamente cuando existan suficientes humanos.

## OWNER

- Runtime/domain owner: `src/systems/arena-system.js` → `window.KeloArena`.
- UI consumer: `src/ui/arena-ui.js` → `window.KeloArenaUI`.
- Combat owner reutilizado: `KeloPvPWorld` + `KeloCombatEngine` + `KeloMeleeEngine` + `KeloHitResolver` + `KeloDamageResolver`.
- Simulation: `KeloSimulation.after(...)`; Arena no crea loop propio.
- Online final: server authority pendiente para matchmaking/rating competitivo real.

## Estado que posee

Arena posee lifecycle de cola/match, ruleset seleccionado, roster fallback, objetivos del modo, estructuras MOBA, estado de bots, profile/rating fallback y resultado. No posee hit geometry, input core, movement core, ability delivery, render base ni networking transport.

## API pública

- `joinQueue(mode)` / `openQueue(mode)` — entra en Control por defecto o en el modo solicitado.
- `joinMobaQueue()` — acceso explícito a 1v1 MOBA.
- `leaveQueue()` — cancela antes del match.
- `finishMatch(winner, reason)` — cierre interno/fallback; en online final será server-only.
- `abort(reason)` — limpia un match incompleto.
- `getHostileActors(viewer)` — entrega héroes y, en MOBA, la estructura enemiga actualmente atacable.
- `getActorById(id)` — targeting de héroes/estructuras.
- `drawWorld(ctx)` — presentation support sobre el renderer PvP existente.
- `snapshot()` y `getRank(mmr?)` — lectura para UI/debug.

## Ruleset 3v3 Control

- equipos 3v3;
- score a 100;
- máximo 180 s;
- zona central disputable;
- 100 HP / 100 maná normalizados;
- fallback inicial: 1 humano + 5 bots `[Bot]`.

## Ruleset 1v1 MOBA

- equipos 1v1;
- un solo carril;
- una torre y un núcleo por equipo;
- la torre enemiga debe caer antes de que el núcleo aparezca como objetivo atacable;
- victoria al destruir el núcleo rival;
- máximo 300 s; si expira, se compara HP restante de los núcleos;
- respawn de héroes;
- torre defensiva con rango/cadencia propios;
- stats de héroes normalizados igual que en Control;
- fallback sin rival: 1 humano contra 1 bot `[Bot]`;
- Match Quality reducido en fallback bot para evitar farmear rating completo.

Las estructuras se representan como actores de objetivo compatibles con la geometría y resolución ya existentes. No existe `MobaCombatEngine` ni un resolver de daño paralelo.

## Ranking

MMR oculto y rango visible/RP permanecen compartidos por Arena. Tiers actuales: Bronce → Plata → Oro → Platino → Esmeralda → Diamante → Mithril → Adamantita → Etéreo. La fórmula local es de prototipo y no es autoridad competitiva final.

## Bots

Los bots siempre se identifican como `[Bot]`. Sus decisiones utilizan utility heuristics y sus ataques de héroe reutilizan `KeloCombatEngine.attackSweep(...)`. En MOBA el bot puede priorizar rival, torre o núcleo según contexto y vulnerabilidad del objetivo.

## Online-first

`joinQueue()` y `joinMobaQueue()` están preparados para delegar a `KeloNetAuthority.requestArena(...)`. Antes de Ranked real el servidor debe poseer matchmaking, humans/bots, equipos, stats efectivos, score/estructuras, respawns, resultado, MMR/RP, reconnect y anti-abuse. El cliente nunca debe declarar `winner`, `score`, `coreHp` o `mmrDelta` como verdad final.

## Invariantes

1. Un solo owner `KeloArena` para modos Arena.
2. Ningún segundo CombatEngine o Simulation loop.
3. UI no escribe gameplay/rating.
4. Bots no se presentan como humanos.
5. Stats normalizados se restauran al salir.
6. PvPWorld sigue funcionando sin Arena.
7. Match Quality reduce progreso de fallback bot.
8. 1v1 MOBA exige torre → núcleo; el núcleo no es target mientras vive su torre.

## Flujo actual

`Arena UI → elegir modo → KeloArena.joinQueue/joinMobaQueue → KeloPvPWorld.enter → Arena construye roster/objetivos → PvPWorld pide hostiles a KeloArena → CombatEngine resuelve ataques → Arena actualiza Control o MOBA → resultado → restore → PvPWorld.leave`.

## Anti-patrones

- `ArenaCombatEngine` / `MobaCombatEngine`;
- `RankedDamageResolver`;
- segundo game loop;
- matchmaking dentro de UI;
- bots disfrazados de jugadores;
- 100% RP contra bots;
- localStorage como autoridad online final.

## Tests / CI

- `scripts/arena-system-audit.js` valida 3v3 Control + 1v1 MOBA, torre/núcleo, cola MOBA, bots, Match Quality, normalización, integración con PvPWorld, runtime y docs.
- `npm run audit:arena`.
- Ranked Arena CI.

## Deuda conocida

- Falta authority server completo de Arena.
- El fallback MOBA actual usa un rival bot, no población ficticia.
- Torre/núcleo, daño de torre, tiempos, MMR y tiers son tuning inicial.
- Minions, shop, XP y jungla no forman parte de este 1v1; el objetivo es un duelo MOBA compacto centrado en héroe + torre + núcleo.

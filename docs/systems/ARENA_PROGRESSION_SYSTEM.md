# Arena Progression — System Contract

## Propósito

`KeloArenaProgression` posee la progresión competitiva persistente que existe **fuera** de una partida concreta: Mastery, objetivos de habilidad y rivalidades/series BO3. Consume resultados confirmados por `KeloArena`; nunca decide quién ganó, cuánto MMR cambia, cuánto daño se aplica ni qué actor es válido.

## OWNER

- Runtime owner: `src/systems/arena-progression.js` → `window.KeloArenaProgression`.
- Match owner consumido: `window.KeloArena`.
- UI consumer: `src/ui/arena-ui.js`.
- Persistencia local actual: `localStorage` como fallback de prototipo.
- Autoridad online final: servidor pendiente.

## Mastery

Mastery es independiente del Rank/MMR y no da estadísticas. Solo expresa experiencia/ejecución competitiva.

Tiers V1:

Iniciado → Combatiente → Duelista → Táctico → Maestro → Campeón → Leyenda de Arena.

La ganancia usa resultado + calidad de partida. Partidas dominadas por bots siguen dando algo de progreso de práctica, pero ponderado por Match Quality para evitar farming equivalente a una partida humana competitiva.

## Objetivos de habilidad

V1 publica objetivos verificables desde datos ya disponibles:

- Primera Victoria;
- Controlador — ganar 3v3 Control;
- Duelista MOBA — ganar 1v1 MOBA;
- Sangre Fría — ganar en OVERTIME;
- Nunca Rendirse — ganar una REMONTADA;
- Rompenúcleos — ganar MOBA destruyendo el núcleo;
- En Racha — 3 victorias consecutivas;
- Veterano I — 10 partidas;
- Veterano II — 25 partidas.

No se inventan métricas que todavía no estén instrumentadas de forma fiable.

## Rivalidades y BO3

Después de una partida se identifica el rival del equipo contrario a partir del roster de `KeloArena`.

Se persiste por `mode + opponentId`:

- partidas;
- victorias;
- derrotas;
- última fecha de enfrentamiento.

La serie activa es Best of 3: primero en llegar a 2 victorias. Si el rival es un bot, la UI la etiqueta como **Serie de práctica**; no se presenta como rivalidad humana.

`rematchSeries()` reutiliza `KeloArena.rematch()` y solo puede ejecutarse cuando Arena volvió a `idle`. No existe una segunda cola de revancha.

## API pública

- `snapshot()` — Mastery, objetivos, rivalidades, serie y última ganancia.
- `getMastery(xp?)` — tier/progreso visible.
- `getRivalry(id, mode)` — historial contra un rival.
- `rematchSeries()` — solicita siguiente partida de la misma serie reutilizando Arena.
- `resetSeries()` — limpia la serie activa local.

## Invariantes

1. No modifica HP, stats, abilities ni resources.
2. No modifica MMR/RP ni matchmaking.
3. No decide ganador/score/objetivos de partida.
4. No crea loop ni timer propios.
5. Bots se identifican como bots también en series.
6. Mastery no concede ventajas de combate.
7. Progreso local es fallback; producción online debe fallar cerrado hacia autoridad server.

## Flujo

`KeloArena termina match → kelo:arena-match-finished → KeloArenaProgression procesa resultado → Mastery/objetivos/rivalidad → Arena UI presenta → revancha opcional → KeloArena.rematch()`.

## Anti-patrones

- usar Mastery como daño/HP adicional;
- convertir objetivos en loot aleatorio;
- fingir un bot como rival humano;
- duplicar MMR dentro de Progression;
- crear `RivalryMatchmaker` o una cola BO3 separada;
- autoencadenar partidas sin decisión del jugador;
- usar localStorage como autoridad competitiva final online.

## Tests / CI

`npm run audit:arena` valida sintaxis, tiers, objetivos, BO3, ponderación por Match Quality, ausencia de buffs/MMR authority y orden LIVE Arena → Lane Pressure → Progression → UI.

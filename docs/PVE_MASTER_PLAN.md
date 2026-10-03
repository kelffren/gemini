# KELO WORLD — PVE MASTER PLAN / WORLD SIMULATION BIBLE V1

> Documento de continuidad. Antes de implementar PvE, leer AGENTS.md, docs/KELO_FOUNDATION.md, ENGINE_MAP.md, docs/ONLINE_FIRST.md y este archivo.
> Estado: MASTER PLAN. No confundir diseño pendiente con comportamiento LIVE.

## 0. Visión

PvE de Kelo World = mundo vivo, no una lista de monstruos.

Loop macro:
EXPLORE → DISCOVER → GATHER → PROCESS → CRAFT → SUPPLY → DEFEND/HUNT → LOOT → UPGRADE → TRADE → CHANGE REGION → NEW THREATS.

La economía y el PvE deben retroalimentarse. Un ataque puede reducir producción, crear escasez, generar contratos y aumentar precios. Los jugadores pueden resolver el problema combatiendo, transportando recursos o produciendo.

## 1. Ley arquitectónica

REUTILIZAR owners existentes:
- KeloCombatEngine: ataques/hit/damage.
- KeloAbilities: habilidades.
- KeloContainers: inventarios físicos.
- KeloRegionalEconomy: reservas, escasez, precios, contratos y rutas.
- KeloCaravans: transporte físico.
- KeloArtisanProfession: progresión artesana.
- KeloProductionChain: recetas/transformación.
- KeloStats/KeloEquipment: stats/equipo.
- KeloEvents: eventos semánticos.
- KeloMovement/KeloSimulation/KeloRender/KELO_COLLISION: infraestructura.
- KeloMapForge: generación/authoring de mapas.
- LiveOps NPC world: presentación/interacción de NPCs; NO convertirlo en AI engine.

CAPACIDADES PvE nuevas candidatas, solo donde no existe owner:
- KeloPvEActors: lifecycle/identidad de criaturas PvE.
- KeloPvEBrain: decisiones AI data-driven.
- KeloEncounterDirector: presupuesto/composición/estado de encuentros.
- KeloLootAuthority: tablas/roll/ownership de drops.
- KeloQuestAuthority: objetivos/estado/recompensas.
- KeloWorldEvents: crisis PvE regionales.
- KeloDungeonRun: lifecycle de runs/rooms/checkpoints.
- KeloGathering: nodos y extracción si no existe owner equivalente al implementar.

No crear segundo combat engine, inventory, renderer, ability engine, economy o NPC renderer.

## 2. Capas PvE

### A. Mundo pacífico
- aldeas, granjas, minas, bosques, ríos, puertos;
- NPC trabajadores con profesión/horario/puesto;
- fauna neutral;
- recursos recolectables;
- estaciones productivas;
- almacenes y rutas comerciales;
- rumores/avisos que señalan problemas reales.

### B. Frontera
- fauna hostil;
- bandidos;
- emboscadas;
- cuevas;
- ruinas;
- resource hotspots;
- patrullas;
- caravanas atacables/protegibles;
- mini-eventos.

### C. Zonas peligrosas
- camps persistentes;
- élites;
- bosses;
- corrupción/invasión;
- recursos raros;
- dungeons;
- world events;
- riesgo logístico elevado.

## 3. Recursos y gathering

Tipos iniciales:
- agricultura: wheat, grape, olive, herbs, vegetables;
- bosque: wood, resin, mushrooms;
- minería: stone, coal, iron_ore, copper_ore, silver_ore, rare_crystal;
- pesca: fish por bioma/rareza;
- criaturas: hide, meat, bone, venom, monster_parts;
- especiales: relic_fragment, boss_core, enchanted_material.

Cada ResourceNodeDefinition:
id, family, biomeTags, toolRequirement, skillRequirement, charges, respawnPolicy, qualityDistribution, dangerTags, outputs, worldEventModifiers.

Mecánicas:
- calidad del nodo;
- herramienta adecuada;
- expertise;
- sweet spot opcional;
- agotamiento;
- regeneración;
- nodos raros;
- weather/time modifiers futuros;
- ruido de extracción puede atraer amenazas;
- recursos pesados favorecen carretas.

## 4. Producción completa

Cadenas iniciales:
olive → olive_paste → olive_oil
wheat → flour → bread
grape → wine
iron_ore + coal → iron_ingot → weapon/tool
herbs → extract → potion
hide → leather → armor
wood → plank → furniture/cart parts
fish/meat → prepared_food

StationDefinition:
id/type/tier/location/owner/inputContainer/outputContainer/queueSlots/condition/efficiency.

ProductionOrder:
recipeId, batches, priority, assignedWorker, requiredInputs, outputs, startedAt, completesAt, state.

Mecánicas futuras:
- colas;
- repeat order;
- min-stock rules;
- workers;
- expertise;
- station upgrades;
- mantenimiento;
- energía/combustible donde aplique;
- calidad;
- fallos parciales, nunca RNG destructivo injusto;
- warehouse routing;
- automation logistics.

## 5. NPC workers / asentamientos

Roles:
farmer, miner, lumberjack, fisher, miller, baker, oil_maker, vintner, smith, alchemist, tanner, cook, merchant, guard, caravaner, healer.

WorkerProfile:
profession, expertise, stamina/availability, workplace, schedule, wage/upkeep opcional, productivity modifiers.

Simulación debe ser lazy/aggregate fuera de cámara. Nunca miles de NPCs pensando por frame.

Asentamientos:
- población abstracta;
- seguridad;
- prosperidad;
- food reserve;
- material reserves;
- production capacity;
- threat pressure;
- faction/reputation;
- active problems.

## 6. Criaturas

CreatureDefinition data-driven:
id, family, role, levelBand, statsProfile, abilityLoadout, brainProfile, senses, leash, socialRules, lootTableId, habitatTags, spawnCost, rarity, eliteVariants.

Familias ejemplo:
wolves, boars, spiders, undead, slimes, goblins, bandits, elementals, corrupted beasts, constructs.

Roles:
bruiser, skirmisher, ranged, support, controller, ambusher, tank, summoner.

No crear clase JS por monstruo.

## 7. AI PvE

BrainProfile con capas:
IDLE → PERCEIVE → INVESTIGATE → ENGAGE → TACTIC → RETREAT/CHASE → LEASH → RESET.

Sensores:
- distancia;
- línea de visión;
- ruido;
- daño recibido;
- aliado alertado;
- objetivo vulnerable;
- zona protegida.

Tácticas:
- melee approach;
- keep distance;
- flank;
- surround;
- charge;
- telegraph heavy attack;
- dodge/reposition;
- call allies;
- heal ally;
- protect caster;
- retreat;
- enrage;
- phase transition.

AI LOD:
- cerca: decisión táctica completa;
- media distancia: ticks reducidos;
- lejos: estado agregado;
- fuera de zona: simulación matemática/event-driven.

## 8. Aggro

Threat table por encounter, no global.
Fuentes: damage, healing, taunt, proximity, scripted objective.
Decay y target switching limitados para evitar ping-pong.

Reglas:
- leash por encounter/territory;
- mobs no persiguen infinito;
- reset seguro;
- anti-cheese de obstáculos mediante navegación/encounter bounds, no teleport arbitrario.

## 9. Spawn ecology

SpawnRegion:
habitatTags, capacity, respawnBudget, compositionPools, timeModifiers, eventModifiers.

Director usa presupuesto, no spawn infinito.

Variables:
- población actual;
- jugadores cercanos;
- kills recientes;
- presión de evento;
- seguridad regional;
- cooldown;
- rare spawn pity opcional.

Evitar farming explotable: diminishing ecological availability, pero nunca castigo invisible extremo.

## 10. Encounter Director

EncounterDefinition:
id, arena/region, budget, waveRules, compositionPool, objectives, failConditions, rewardProfile, scalingPolicy.

Tipos:
- patrol;
- ambush;
- camp;
- defense;
- escort;
- hunt;
- rescue;
- holdout;
- destroy targets;
- survive;
- boss;
- roaming elite.

Scaling:
- más jugadores = principalmente más composición/roles, no solo HP sponge;
- límites duros;
- boss mechanics preservadas;
- rewards por contribución.

## 11. Camps

CampState:
level, occupants, alarm, supplies, fortifications, leader, respawnPressure.

Mecánicas:
- scouts;
- alarm;
- reinforcements;
- supply crates;
- prisoners;
- destroyable objectives;
- leader/elite;
- camp puede crecer si ignorado;
- limpiar camp reduce amenaza/riesgo de ruta temporalmente;
- camp puede reaparecer en otro nodo, no exactamente instantáneo.

## 12. Loot

LootTableDefinition:
guaranteed, weightedPools, conditionalPools, quantity, quality, ownershipPolicy.

Drops:
- materiales;
- consumibles;
- equipo;
- recipes;
- cosmetics;
- relics;
- boss components;
- currency controlada.

Principios:
- boss valioso no imprime oro infinito;
- muchos drops son inputs económicos;
- rare drops pueden usar pity server-side;
- personal loot para contenido cooperativo cuando evita conflicto;
- world cargo/containers para objetivos físicos.

## 13. Equipment PvE

Equipo puede tener:
base stats + quality + crafter identity + sockets/stones + durability opcional + affixes controlados.

PvE affixes posibles:
monster-family damage, resistance, gathering bonus, threat, healing, stagger, elite damage.

Evitar multiplicadores infinitos y pay-to-win.

## 14. Quest system

Tipos:
- story;
- local problem;
- bounty;
- hunt;
- gather;
- production order;
- delivery;
- escort;
- defense;
- dungeon;
- investigation;
- chain quest;
- world-event contribution.

QuestDefinition separada de QuestState.

Objetivos escuchan eventos semánticos: kill, gather, craft, deliver, discover, interact, defend.

No polling continuo.

## 15. Dynamic contracts

Además de quests authored, el mundo genera necesidades:
- falta bread → supply contract;
- ruta atacada → escort/clear camp;
- mina infestada → clear/hunt;
- food reserve crítica → farming/fishing delivery;
- boss regional → bounty;
- estación dañada → material delivery.

Esto conecta KeloRegionalEconomy con PvE sin quests falsas desconectadas.

## 16. Reputation

Reputación por settlement/faction/profession.

Gana por:
- resolver crisis;
- supply;
- defender;
- comerciar;
- quests;
- crafting útil.

Desbloquea:
- recipes;
- vendors;
- services;
- cosmetics;
- contracts;
- areas/permissions.

No usar reputación como simple level duplicado.

## 17. Dungeons

DungeonDefinition:
theme, rooms, encounterDeck, traversalRules, bossId, lootProfile, modifiers.

Run:
CREATED → ACTIVE → CHECKPOINT → BOSS → COMPLETE/FAILED/ABANDONED.

Rooms:
combat, puzzle-lite, resource, elite, event, rest, treasure, boss.

Variación:
- layout authored/modular;
- encounter deck;
- optional side rooms;
- difficulty modifiers;
- secrets.

No proceduralizar hasta perder calidad visual.

## 18. Boss design

BossDefinition:
phases, abilities, telegraphs, breakpoints, adds, arenaRules, enragePolicy, rewardTable.

Reglas:
- ataques legibles;
- ventanas de castigo;
- movimiento importa;
- fases cambian comportamiento;
- evitar HP sponge;
- mecánicas reutilizan KeloAbilities/KeloCombatEngine.

Arquetipos:
guardian, beast, necromancer, warlord, elemental, construct.

## 19. Elite / champion

Mutator system:
- armored;
- berserk;
- poisonous;
- shielding;
- summoner;
- vampiric limitado;
- explosive death telegraphed;
- commander.

Mutators data-driven y compatibles por tags.

## 20. World events

Estados:
DORMANT → WARNING → ACTIVE → ESCALATED → RESOLVED/FAILED → RECOVERY.

Eventos:
- bandit blockade;
- undead outbreak;
- corrupted forest;
- mine infestation;
- caravan crisis;
- monster migration;
- siege;
- world boss;
- resource boom;
- famine/supply emergency.

Efectos reales:
production modifier, route risk, NPC availability, spawn tables, prices/contracts, resource nodes.

## 21. Regional threat

ThreatPressure por región.
Sube por camps/eventos/bosses ignorados.
Baja por patrullas/players/quests.

Thresholds cambian:
- spawn density;
- caravan risk;
- contracts;
- guard presence;
- rare encounter chance.

Debe tener caps y decay para no destruir una región permanentemente.

## 22. Exploration

Fog/discovery opcional.
POI:
village, cave, ruin, shrine, mine, resource grove, camp, dungeon entrance, boss lair, fishing spot.

Discovery puede dar:
- mapa;
- fast-travel unlock futuro;
- codex;
- quest hooks;
- small XP/reputation.

## 23. Codex / bestiary

Registra:
creatures encountered, habitats, drops conocidos, resistances descubiertas, bosses, resources, recipes.

Información sensible se revela progresivamente; no mostrar loot oculto completo al primer encuentro.

## 24. Death / failure

PvE death debe doler sin expulsar al jugador.
Opciones a validar:
- respawn nearby settlement/checkpoint;
- durability/carrying cost moderado;
- cargo físico de contratos especiales puede quedar en riesgo;
- no perder equipo permanente por muerte normal.

Dungeon failure conserva aprendizaje, no duplica rewards.

## 25. Group PvE

Party:
2–5 objetivo inicial.
Shared encounter credit.
Contribution tracks damage/heal/objective/support.
Revive/downed state candidato.
Loot personal o reglas explícitas.

Roles emergentes, no obligar holy trinity rígida.

## 26. Difficulty

Open world: bandas por región + telegraph.
Dungeon: Normal / Veteran / Nightmare futuro.

Dificultad aumenta:
- patrones;
- composición;
- velocidad moderada;
- hazards;
- coordinación;
no solo HP/damage.

## 27. Endgame PvE

- rotating regional crises;
- world bosses;
- veteran dungeons;
- rare crafting components;
- master production contracts;
- elite hunts;
- reputation prestige cosmético;
- seasonal LiveOps modifiers.

No resetear valor económico completo cada temporada.

## 28. Anti-exploit / authority

SERVER debe decidir online:
spawn truth, HP/damage final, loot rolls, quest completion, rewards, resource depletion, crafting valuable outputs, contracts, dungeon completion, world-event state.

Cliente:
input, prediction, UI, VFX.

Stable IDs + revision/idempotency para rewards.

## 29. Performance móvil

Reglas:
- spatial buckets;
- actor pooling;
- no DOM por mob;
- no AI full-rate offscreen;
- no timers por actor;
- Simulation hooks;
- Render culling;
- assets lazy;
- encounter budgets;
- aggregate distant simulation.

Objetivo: densidad percibida alta con actores activos limitados.

## 30. Telemetría

Medir:
time-to-kill, deaths, damage received, encounter completion, abandonment, loot/hour, resource/hour, craft throughput, contract completion, route losses, boss wipes, device FPS.

Balancear con datos, no inflar números manualmente.

## 31. Roadmap de implementación

PHASE 1 — FOUNDATION
1. ProductionChain adapter KeloContainers.
2. ResourceDefinition + Gathering owner.
3. PvEActorDefinition/lifecycle.
4. PvEBrain básico.
5. LootAuthority.
6. EncounterDirector.
7. tests deterministas.

PHASE 2 — PLAYABLE LOOP
8. 3 resource families.
9. 3 monster families.
10. patrol + camp + elite.
11. kill/gather/craft/deliver quests.
12. drops → production → market.
13. mobile UI.
14. iPhone QA.

PHASE 3 — WORLD REACTIVITY
15. threat pressure.
16. dynamic contracts.
17. camp growth.
18. route attacks.
19. settlement consequences.
20. world events.

PHASE 4 — DUNGEONS/BOSSES
21. DungeonRun.
22. room deck.
23. first boss.
24. party contribution.
25. loot protection/pity.

PHASE 5 — DEEP SIMULATION
26. worker schedules/aggregate simulation.
27. production queues/automation.
28. warehouse routing.
29. ecology.
30. codex/bestiary.
31. endgame rotations.

## 32. Primer vertical slice obligatorio

VERDANTIA CRISIS:
- recoger wheat/olive;
- producir flour/bread y olive oil;
- wolves hostigan granjas;
- bandit camp aumenta route risk;
- settlement pierde producción si amenaza crece;
- aparecen contratos de bread/oil;
- jugador puede combatir o producir;
- limpiar camp baja riesgo;
- caravan entrega supply;
- reservas se recuperan;
- precios/contratos reaccionan;
- elite bandit leader da componente de crafting.

Este slice prueba que PvE + economía + producción + logística forman UN sistema.

## 33. Definition schemas a crear

PvEActorDefinition
BrainProfile
SpawnRegionDefinition
EncounterDefinition
LootTableDefinition
ResourceNodeDefinition
QuestDefinition
WorldEventDefinition
DungeonDefinition
BossDefinition
EliteMutatorDefinition

Todos data-driven. Nada de if(actorId === ...).

## 34. Definition of Done PvE

Una feature PvE NO está terminada hasta:
- owner correcto;
- online-first;
- deterministic tests;
- docs + catalog;
- player guide si visible;
- no segundo loop;
- no timers masivos;
- mobile performance;
- Playwright iPhone gate si toca runtime/UI;
- integración económica comprobada cuando aplique;
- rewards idempotentes;
- server authority preparada;
- evidencia de comportamiento, no solo unit tests.

## 35. Próxima ejecución recomendada

Implementar PHASE 1 en este orden:
Gathering → PvEActor definitions/lifecycle → Brain basic → LootAuthority → EncounterDirector → Quest event objectives → integración ProductionChain/RegionalEconomy.

NO empezar por dungeon/boss antes de que el loop recurso→combate→loot→producción→mercado funcione.

# Kelo World PvE Foundation

Data-driven PvE foundation inspired by proven survival/action-RPG loops without copying protected content.

## Loop
Explore -> encounter/POI -> readable combat -> loot/materials/stones -> craft/equip/trade -> dungeon/boss -> unlock world tier -> harder biome content.

## Contracts
- Creature families are content data, not hardcoded AI.
- Enemy attacks expose telegraph and recovery timings for AbilityEngine/AI adapters.
- Party scaling increases density first and HP second; it avoids pure HP-sponge scaling.
- Elite ranks compose reusable affixes.
- Boss first kills can unlock tiers, recipes, regions, NPCs or systems.
- Loot is deterministic when supplied the same seed, making future server authority/replays practical.
- Night state is a PvE director modifier and emits semantic events.
- PvE does not own rendering, navigation, editor state, inventory persistence or networking.

## Next adapters
AI behavior adapter; AbilityEngine damage/status adapter; world-biome spawner; dungeon encounter graph; authoritative server loot commit; stone/equipment loot bridge.

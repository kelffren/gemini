# KELO WORLD — PVP WORLD V1

Status: vertical slice / local authority

## Owners

- Social/world input, movement, physics and camera remain owned by `engine-a.js` with the existing later movement wrappers.
- Ability definitions remain owned by `src/abilities/abilityData.js`.
- Ability loadout/cooldowns remain owned by `src/abilities/stone-system.js` + `src/abilities/kelo-ability-boot.js`.
- PvP world mode, combat permission, target selection, basic-attack command/result boundary and PvP presentation are owned by `src/systems/pvp-world.js`.
- Multiplayer transport remains owned by `engine-net.js` and `server/index.js`.

## World boundary

Social mode:
- `window.KELO_COMBAT_ENABLED = false`
- body keeps `social-mode`
- action bar is hidden
- PvP dummy/arena overlay is inactive

PvP mode:
- `window.KELO_COMBAT_ENABLED = true`
- player is moved into the isolated PvP test space
- action bar becomes visible
- one existing simulated player is temporarily reused as the combat dummy so the current Ability Engine can interact with the same entity contract
- leaving restores the social position and dummy state

## Command boundary

The first local-authority slice uses:

`Input -> Combat Command -> Local Combat Authority -> Combat Result -> Presentation`

Commands currently implemented by the PvP layer:
- `SELECT_TARGET`
- `BASIC_ATTACK`
- `CAST_ABILITY`

The basic attack modifies HP only inside the local combat simulation/authority path, never directly from the pointer handler or renderer.

## Mobile interaction

- Tap an enemy: select it and attempt a basic attack.
- Tap a skill slot: arm it.
- Tap enemy/ground: submit the ability request according to its targeting type.
- Self-target abilities execute immediately.
- Existing left-side joystick remains the movement system; PvP does not introduce a second movement engine.

## Multiplayer migration rule

The components intended to survive server-authoritative multiplayer are:
- ability definitions
- loadout and cooldown representation
- combat command shape
- combat result shape
- targeting semantics
- HUD
- VFX/presentation

The layer expected to change is the execution authority:

`Local Combat Authority -> Server Combat Authority`

The current server already has an authoritative `combat:resolve` path for Nobleza damage modifiers, but it is not yet a complete authoritative PvP simulation for targets, cooldowns, projectiles, positions or deaths.

## Known V1 limitation

The current Ability Engine itself predates this world-permission layer. The social UI hides all ability input, and the PvP system owns the intended combat input path, but `KeloAbilities.engine.cast()` does not yet independently reject a direct programmatic cast while outside PvP. Before competitive/network PvP, world permission must be enforced inside the combat/ability validation boundary or its future server authority, not only by input routing.

## Next verification

A dedicated LIVE PvP audit should prove:
- social -> PvP -> social
- action bar hidden/visible/hidden
- dummy selection
- basic attack damage
- ability arm + tap cast
- cooldown visible
- death
- movement/reversal/diagonal unchanged
- 0 JS/network failures
- mobile and desktop

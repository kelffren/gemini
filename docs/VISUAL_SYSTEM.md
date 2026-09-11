# Kelo World — Visual System V1

**Estado:** LIVE validado en móvil · Kelo World V6.26  
**Propósito:** permitir que animaciones, VFX, proyectiles visuales, sonidos y sequences existan y se reutilicen sin depender de una habilidad o piedra.

## Regla de arquitectura

```text
ASSET
  ↓
COMPONENTE independiente
  ↓
SEQUENCE opcional
  ↓
VISUAL PROFILE opcional
  ↓
ABILITY EVENT opcional
```

Nunca al revés. Un FX no necesita una Ability. Una AnimationClip no necesita una Stone. Un ProjectileVisual no necesita hacer daño.

## Owners LIVE

| Responsabilidad | Owner |
|---|---|
| Manifiestos data-driven | `src/visuals/visual-manifests.js` |
| Asset IDs / preload / lazy load | `src/visuals/asset-registry.js` |
| AnimationClip / channels / anchors | `src/visuals/animation-system.js` |
| VFX / projectile visuals / SFX / screen FX | `src/visuals/fx-system.js` |
| Sequences / timeline | `src/visuals/sequence-system.js` |
| Ability → visual profile | `src/visuals/ability-visuals.js` |
| Event bus / context / audit / layer orchestration | `src/visuals/visual-system.js` |
| World layer insertion | `engine-c.js` |
| Final actor bridge | `src/visuals/visual-integration.js` |
| Visual Lab | `src/visuals/visual-lab.js` |
| Semantic network relay | `engine-net.js` + `server/index.js` |
| Ability gameplay actual | `src/abilities/kelo-ability-boot.js` (client/fallback actual) |
| Stone schema/loadout/affixes | `src/abilities/stone-system.js` |

## Public contracts

```js
KeloAssetRegistry.get(id)
KeloAssetRegistry.load(id)
KeloAssetRegistry.preload(ids)

KeloAnimation.play(actor, clipId, options)
KeloAnimation.stop(actor, channel)
KeloAnchors.get(actor, socket)

KeloFX.spawn(fxId, context, options)
KeloFX.stop(instanceId)
KeloFX.stopAll()

KeloProjectileVisuals.attach(gameplayObject, visualId, context)
KeloProjectileVisuals.preview(visualId, context)
KeloProjectileVisuals.stop(instanceId)

KeloSFX.play(soundId, context)
KeloScreenFX.shake(id)
KeloScreenFX.flash(id)

KeloSequence.play(sequenceId, context)
KeloSequence.stop(sequenceInstanceId)

KeloAbilityVisuals.resolveProfile(abilityId, abilityKey)
KeloAbilityVisuals.playCue(abilityId, cue, context)
KeloAbilityVisuals.setEnabled(bool)

KeloVisualEventBus.on(eventName, fn)
KeloVisualEventBus.emit(eventName, payload)
```

## Render layers

Orden de mundo:

```text
groundFX
belowActor
actorBackFX
actor
actorFrontFX
worldFX
foregroundFX
screenFX
UI
```

`engine-c.js` posee los puntos de inserción de mundo. `visual-integration.js` instala una única frontera final sobre el `renderAvatar` definitivo para `actorBackFX/actorFrontFX` y transform de acción.

No se añadió otro wrapper global de `render()` para el Visual System.

## Animation channels

```text
locomotion
activity/action
reaction
overlay
```

La implementación expone `locomotion`, `action`, `reaction`, `overlay`. La prioridad vive en configuración del sistema, no en AbilityEngine.

La animación NO modifica `x`, `y`, velocidad, collider ni reglas de movimiento. El gameplay decide cualquier lock/reducción de movimiento.

## Anchors / sockets

Los sockets se derivan del contrato real `KELO_AVATAR_PRESENTATION` y su `footRoot`:

```text
foot
ground
center
chest
head
hand
weapon
castOrigin
target
```

No se dispersan offsets de mano/cabeza dentro de cada habilidad.

## Fireball piloto

Gameplay:

```text
abilityData.fireball
  → targeting/resource/cooldown/delivery/effects
```

Visual:

```text
visualProfileId: ability_visual_fireball_01
  → sequence_fire_cast_01
      → cast_magic_01
      → fire_hand_charge_small
      → fire_cast_01
      → fire_muzzle_flash
  → projectile_fire_orb_01
      → fire_trail_01
  → sequence_fire_impact_01
      → fire_explosion_medium
      → fire_impact_01
      → impact_medium
  → burn_body_small
```

`fire_explosion_medium`, `cast_magic_01`, el projectile visual y cualquier otra pieza pueden ejecutarse sin Fireball.

## Familias LIVE (V1.4)

Los perfiles reutilizan primitives de FX (`expanding_ring`, `area_disk`, `crystal_burst`, `sigil`, `streak`) en vez de hardcodear cada habilidad:

| Ability | Delivery | Profile | Qué comunica |
|---|---|---|---|
| fireball | projectile | `ability_visual_fireball_01` | cast → orb + trail → impacto + anillo |
| ice_nova | self_aoe | `ability_visual_ice_nova_01` | carga → disco/anillo 130px → shards |
| wind_dash | dash | `ability_visual_wind_dash_01` | burst + rastro → afterimage → aterrizaje |
| poison_trap | trap | `ability_visual_poison_trap_01` | place → sigilo + radio persistente → trigger |

El Visual Lab (`?visualLab=1`, `visual-lab-v1.6.0`) tiene dos pestañas. **SKILL** reproduce un VisualProfile con `playCue` / eventos semánticos (`PLAY FULL`, cues honestas por familia incluyendo AREA/ARM/END, `TEST IN GAME` via `engine.predict`). **PIEZAS** sigue siendo la galería de componentes sueltos y comparte Dirección/Escala/Velocidad/Loop. En móvil el panel se ancla abajo para no tapar el cast. `PLAY` compacta a una barra con `■` y se reabre al terminar; `PIN` lo deja abierto. `LOOP` repite hasta STOP. Un dummy de impacto marca el target y parpadea al IMPACT. `GHOST` pinta rango/radio con los mismos números de delivery del combate. El dropdown lista todo el catálogo y marca `MISSING`. `■` en la barra para el preview (usa `KeloFX.stopAll`).

Eventos nuevos del adapter: `ABILITY_IMPACT`, `DASH_STARTED`, `DASH_ENDED`, `TRAP_PLACED`, `TRAP_ARMED`, `TRAP_TRIGGERED`, `TRAP_EXPIRED`.

## Compatibilidad temporal

`kelo-ability-boot.js` aún contiene el gameplay cliente/fallback y sus primitives visuales antiguas. `ability-visuals.js` actúa como adapter:

- genera `castId` + visual seed;
- convierte el bus actual a eventos semánticos;
- oculta únicamente el primitive antiguo de una Ability que ya tenga VisualProfile;
- si `KeloAbilityVisuals.setEnabled(false)`, restaura el fallback antiguo;
- no toca StoneSystem.

Esto permite migrar habilidad por habilidad sin big-bang rewrite.

## Online First

Viajan eventos semánticos compactos, por ejemplo:

```json
{
  "t": "visual:event",
  "name": "CAST_CONFIRMED",
  "context": {
    "castId": "cast_p123_abc",
    "abilityId": 1,
    "origin": { "x": 520, "y": 410 },
    "direction": { "x": 1, "y": 0 },
    "visual": { "seed": 92817, "scale": 1 }
  }
}
```

Nunca viajan:

- frames de animación;
- partículas;
- nombres de sprites cada tick;
- objetos Canvas/Image/Audio;
- coordenadas individuales de chispas.

`server/index.js` sanea y retransmite estos eventos visuales. Ese relay es **presentation-only** y NO convierte el gameplay actual de abilities en server-authoritative. La autoridad futura de casts/hits/cooldowns deberá sustituir el adapter cliente conservando los mismos IDs/eventos.

## Prediction / remote

Local:

```text
input
→ CAST_STARTED (predicted presentation)
→ gameplay/authority
→ CAST_CONFIRMED o CAST_REJECTED
→ mismo Visual Resolver
```

Remote:

```text
server visual event
→ KeloVisualEventBus
→ mismo Visual Resolver
```

No existen `playLocalFireballAnimation()` y `playRemoteFireballAnimation()` separados.

## Performance mobile

- object pools para FX/projectile visuals;
- offscreen culling;
- spawn budgets reutilizan `KELO_PERF.canSpawn`;
- assets se registran/cargan una vez, nunca `new Image()` por cast;
- `LOW/MEDIUM/HIGH` se deriva del performance governor;
- calidad gráfica no modifica gameplay.

## Visual Lab

Activar únicamente en desarrollo:

```text
?visualLab=1
```

Permite:

- pestaña **SKILL**: PLAY FULL / TEST IN GAME / cues honestas por profile / dummy de impacto / MISSING;
- pestaña **PIEZAS**: AnimationClip, VFX, ProjectileVisual, Sequence, Status, SFX, shake/flash;
- `■` en la barra (no se esconde al minimizar);
- dirección, escala, velocidad.

## QA validada

LIVE móvil `390×844` validó:

- APIs visuales presentes;
- Visual Lab activo solo por flag;
- `footRootY = physicsRootY + 10` antes y después;
- Animation/FX/Projectile/Sequence/SFX ejecutables sin Ability;
- ejecutar visuales no cambió `x`, `y` ni collider del jugador;
- Fireball siguió funcionando con Visual Resolver apagado: mana `100 → 80`, cooldown `4`, cast válido;
- al reactivar Visual Resolver, Fireball resolvió `ability_visual_fireball_01`;
- actor remoto reprodujo cast/projectile con el mismo pipeline;
- `stoneSystemVisualKnowledge = false`;
- cero console errors, failed requests y HTTP errors.

## Deuda deliberada

1. `kelo-ability-boot.js` todavía mezcla gameplay, UI/input y primitives legacy. Es fallback durante la migración, no arquitectura objetivo.
2. Fireball, Ice Nova, Wind Dash y Poison Trap tienen profile LIVE. Chain / Shield / Tornado / Wall / Blink / Aura siguen en MISSING del Visual Lab.
3. Los FX y SFX piloto son representación procedural/synth de validación. El siguiente paso es sustituirlos por assets finales authored sin cambiar APIs.
4. Ability gameplay aún no es server-authoritative. El relay visual online ya usa la frontera correcta, pero cast/hit/cooldown reales deben migrar al server más adelante.

## Regla de cierre

Si para usar un FX hace falta equipar una Stone, la arquitectura está rota.
Si para previsualizar un ProjectileVisual hace falta hacer daño, la arquitectura está rota.
Si quitar Visual Resolver rompe una Ability, la arquitectura está rota.

El contrato V1 está diseñado y auditado para que esas tres condiciones sean falsas.

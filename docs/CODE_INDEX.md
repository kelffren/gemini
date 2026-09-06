# ÍNDICE DE CÓDIGO — palabras clave

Busca en el repo: `KELO-INDEX` o la clave (`NET`, `CAST`, `POSE`, …).

Formato obligatorio en JS (el motor **no lo ejecuta**):

```js
/* KELO-INDEX
 * area: NET
 * keys: POSE CAST AUTHORITY PLAYERKEY WS
 * hace: puente WebSocket; el cliente pide, el server decide si hay ws
 * online: request() misma boca local/server
 */
```

Encima de una función:

```js
// KELO-INDEX NET/POSE envia x y face gait zone al room
function sendPose() { ... }
```

No uses `/*` para apagar código. Los comentarios solo documentan.

---

## Claves → archivo dueño LIVE

| Clave | Qué es | Dónde
|---|---|---|
| CORE | estado, input, física, loop | `engine-a.js` |
| LOOP | requestAnimationFrame | `engine-b.js` |
| MOVE JOY GAIT | joystick, walk/run | `engine-ac.js` |
| HERO SPRITE | hoja del personaje | `engine-ab.js` |
| MELEE TAP | ataque por toque (APAGADO) | `engine-n.js` |
| PLAZA GROUND | suelo authored | `engine-l.js` |
| HOUSES | casas legacy | `engine-y.js` |
| TILES REGISTRY | atlas + prefabs | `src/environment/tile-registry.js` |
| WORLD CHUNKS | renderer 512 | `src/environment/world-map.js` |
| LUXE BOUTIQUE | tienda | `src/environment/luxe-kiosk-atlas.js` `src/ui/luxe-boutique.js` |
| HUD LUXE | shell menú | `src/ui/luxe-shell.js` |
| MOBILE ORIENTATION | vertical/horizontal, viewport y botón GIRAR | `src/ui/mobile-orientation.js` |
| STONES RECIPE | piedras data-driven | `src/abilities/stone-system.js` `abilityData.js` |
| CAST ABILITY | delivery VFX/daño cliente | `src/abilities/kelo-ability-boot.js` |
| NET WS POSE | online room | `engine-net.js` |
| VISUAL ASSET REGISTRY | IDs / preload / lazy visual | `src/visuals/asset-registry.js` |
| ANIMATION CLIP ANCHOR | clips, channels, foot-root sockets | `src/visuals/animation-system.js` |
| VFX PROJECTILE SFX SCREEN | FX reutilizable / projectile visual / sonido | `src/visuals/fx-system.js` |
| VISUAL SEQUENCE | timelines/composición opcional | `src/visuals/sequence-system.js` |
| ABILITY VISUAL PROFILE | Ability event → presentation | `src/visuals/ability-visuals.js` |
| VISUAL EVENT AUDIT | bus/context/layers/audit | `src/visuals/visual-system.js` |
| VISUAL LAB | galería dev `?visualLab=1` | `src/visuals/visual-lab.js` |
| VISUAL ACTOR BRIDGE | actorBackFX/actorFrontFX final | `src/visuals/visual-integration.js` |
| NET VISUAL EVENT | relay semántico presentation-only | `engine-net.js` + `server/index.js` |
| AUTHORITY | boca única client→server | `engine-net.js` `KeloNetAuthority` |
| PROPERTY CATALOG | templates placeables desde props/prefabs | `src/property/property-asset-catalog.js` |
| PROPERTY PARCEL UNITS | balances, placements, autoridad reemplazable | `src/property/property-system.js` |
| MAP EDITOR | editor mundo/parcela, export/import | `src/ui/property-editor.js` |
| NOBLEZA | rangos donación | `src/systems/nobility.js` `nobility-authority.js` |
| FORGE EQUIP | forja / gear | `src/systems/forge-system.js` `equipment-system.js` |
| SERVER ROOM | autoridad Node | `server/index.js` |

---

## Áreas (primera palabra después de KELO-INDEX)

`CORE` `NET` `AUTH` `CAST` `STONES` `MOVE` `HERO` `PLAZA` `LUXE` `HUD` `ECON` `COMBAT` `SERVER` `UI` `PROPERTY`

Grep rápido:

```
KELO-INDEX NET
KELO-INDEX CAST
KELO-INDEX MOVE
KELO-INDEX PROPERTY
KELO-INDEX UI
```

## INSTANCE SYSTEM V1
- `src/instances/instance-system.js`: manager/lifecycle/contexto genérico.
- `src/instances/instance-runtime-bridge.js`: transición world/house y bounds visuales.
- `src/instances/house-instance.js`: autoridad, persistencia, snapshot y permisos House.
- `src/instances/property-house-bridge.js`: contrato Property ↔ House.
- `src/ui/house-instance-ui.js`: entrada/salida y acceso al mismo Property Editor.


## ADMIN KEY / WORLD CREATOR V1
- `src/systems/admin-key-system.js`: objeto/entitlement Llave Admin, scopes y autoridad reemplazable.
- `src/ui/property-editor.js`: modo MUNDO visible únicamente con `world.edit`.
- Parcela de jugador conserva unidades/ownership; Llave Admin no altera esa economía.

## MOBILE ORIENTATION V1
- `src/ui/mobile-orientation.js`: detecta portrait/landscape, sincroniza `innerWidth/innerHeight` con canvas/UI y expone `KELO_ORIENTATION`.
- Botón `↻ GIRAR` vive en el rail móvil de Luxe; intenta `ScreenOrientation.lock()` cuando el navegador lo permite.
- iOS/WebKit u otros navegadores sin lock conservan fallback seguro: giro físico + reajuste automático.
- `scripts/mobile-orientation-audit.mjs`: certifica 390×844 y 844×390, cambio dinámico y ausencia de errores.

<!-- CODE-INDEX-VISUAL-V1:START -->
## VISUAL SYSTEM V1

Regla: visuales son piezas reutilizables; StoneSystem no conoce Animation/VFX/Sequence. El gameplay emite eventos y la presentación los consume.

Orden de carga relevante:
`visual core/manifests/registries → abilityData → stone-system → ability boot → ability-visuals → engine-net → sistemas tardíos → visual-lab → visual-integration final`.

Render: `groundFX → belowActor → actorBackFX → actor → actorFrontFX → worldFX → foregroundFX → screenFX → UI`.

APIs clave: `KeloAnimation.play`, `KeloAnchors.get`, `KeloFX.spawn`, `KeloProjectileVisuals.preview/attach`, `KeloSFX.play`, `KeloSequence.play`, `KeloAbilityVisuals.playCue`, `KeloVisualEventBus.emit`.

QA: `scripts/visual-system-contract-audit.js` + `scripts/live-visual-system-audit.mjs`; workflows `visual-system-ci.yml` y `visual-system-live.yml`.

Detalle: `docs/VISUAL_SYSTEM.md`.
<!-- CODE-INDEX-VISUAL-V1:END -->

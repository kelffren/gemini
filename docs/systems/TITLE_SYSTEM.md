# KeloTitles — títulos desbloqueables e identidad de prestigio

## Propósito

`KeloTitles` es el OWNER único de los títulos personales desbloqueables de Kelo World. Nobleza y Títulos son responsabilidades diferentes:

- `KeloNobility` decide el rango automático de Nobleza (`Caballero`, `Barón`, `Conde`, `Duque`, `Príncipe`, `Rey`).
- `KeloTitles` gestiona títulos personales ganados por logros (`Combatiente`, `Cazador`, `Asesino`, etc.) y cuál de ellos está equipado.

El jugador puede mostrar ambas capas al mismo tiempo:

```text
♛ REY ♛
Kelo
《Asesino》
```

## Owner

**Owner:** `window.KeloTitles`  
**Fuente:** `src/systems/title-system.js`  
**Catálogo puro:** `src/systems/title-catalog.js`  
**Presentación:** `src/ui/player-nameplate.js` consume el estado mediante `KeloAvatar.use(...)`.

## Arquitectura

```text
Combat/Server Event
       │
       ▼
KeloPlayerStats
       │ player:stat_changed
       ▼
KeloTitles evaluator
       │
       ├─ unlocked IDs
       └─ equippedTitleId
                │
                ▼
      KeloActorNameplate
        (presentación)
```

`KeloTitles` no conoce HP, hitboxes, víctimas ni resolución de daño.

## Catálogo data-driven

Los títulos se registran como DATA en `src/systems/title-catalog.js`.

Ejemplo:

```js
{
  id: 'pvp_assassin',
  name: 'Asesino',
  category: 'pvp',
  rarity: 'epic',
  styleKey: 'epic',
  requirement: {
    stat: 'openWorldPlayerKills',
    operator: 'gte',
    value: 200
  }
}
```

Agregar un título futuro no requiere editar el evaluator, el combate ni el nameplate.

El catálogo crea una vez un índice `requirement.stat → títulos relacionados`; el evaluator solo revisa los títulos afectados cuando cambia esa stat. No existe un recorrido del catálogo dentro del frame loop.

## Títulos PvP iniciales

| ID | Título | Requisito |
| --- | --- | ---: |
| `pvp_combatant` | Combatiente | 10 bajas Mundo Abierto |
| `pvp_hunter` | Cazador | 50 |
| `pvp_assassin` | Asesino | 200 |
| `pvp_executioner` | Verdugo | 500 |
| `pvp_realm_scourge` | Azote del Reino | 1.000 |

También quedan registradas las categorías futuras: PvP, PvE, bosses, exploración, comercio, economía, profesiones, construcción, Nobleza, clanes, facciones, caravanas, eventos, temporadas, secretos y colecciones.

## API pública

- `KeloTitles.getCatalog()`
- `KeloTitles.getTitle(id)`
- `KeloTitles.getUnlocked()`
- `KeloTitles.isUnlocked(id)`
- `KeloTitles.getProgress(id)`
- `KeloTitles.getEquipped()`
- `KeloTitles.equip(id)`
- `KeloTitles.unequip()`
- `KeloTitles.ingestServerSnapshot(snapshot)`
- `KeloTitles.evaluate(stat)`
- `KeloTitles.refresh()`

La UI del panel de Nobleza consume además `renderNobilityPane()` y `bindNobilityPane()`; estas funciones no convierten Nobleza en owner de títulos.

## Offline

Offline usa:

```text
STATE.titles.unlocked
STATE.titles.equippedTitleId
STATE.playerStats
```

y persiste mediante el `saveState()` existente.

El helper `?titleDev=1` permite probar 199 → una baja válida → 200 → unlock `Asesino` sin exponer comandos de progreso en producción.

## Online

El transporte público permite solamente:

- `titles:get`
- `titles:equip`
- `titles:unequip`

No existe `titles:unlock` ni una llamada cliente para declarar kills.

El snapshot server es compacto:

```js
{
  version: 'server-titles-v1',
  equippedTitleId: 'pvp_assassin',
  unlocked: ['pvp_combatant', 'pvp_hunter', 'pvp_assassin'],
  progress: { openWorldPlayerKills: 217 }
}
```

El estado público de otros jugadores replica únicamente `equippedTitleId`; los clientes resuelven nombre/rareza contra el catálogo local.

Antes de que llegue el primer snapshot online, el cliente falla cerrado: no utiliza títulos ni progreso offline como autoridad temporal.

## Autoridad server

`server/title-store.js` posee el contrato autoritativo de progreso/equipamiento. Su entrada de kill es `recordConfirmedKill(...)`, llamada únicamente desde código server. La WebSocket pública no ofrece ese método.

Una kill válida exige, como mínimo:

- killer y víctima distintos;
- víctima tipo `player`;
- `confirmed === true`;
- `worldPvP === true`;
- contexto `open-world-pvp`;
- no NPC;
- no dummy;
- no training;
- no arena.

El ledger conserva metadata mínima (`victimId`, timestamp, zona, modo) para poder añadir posteriormente ventanas anti-farming, diminishing returns o detección de win-trading sin cambiar el contrato de títulos.

### Persistencia

Por defecto el server usa RAM autoritativa para desarrollo, igual que otros contratos existentes. Para persistencia durable se incluye `server/title-schema.sql`; después de aplicarlo se activa con `KELO_TITLES_SUPABASE=1`. El cliente nunca recibe credenciales de service-role ni escribe la tabla directamente.

## Nameplate

`src/ui/player-nameplate.js` registra middleware con `KeloAvatar.use('actor-nameplate', ...)`.

No envuelve `renderAvatar` directamente.

El layout colapsa líneas vacías:

```text
Nobleza (si existe)
Nombre
Título equipado (si existe)
```

Las rarezas usan estilos compartidos (`common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`) y no colores arbitrarios por título.

## Panel de Nobleza

El panel existente añade una pestaña `Títulos` con:

- título equipado;
- desequipar;
- títulos desbloqueados;
- títulos bloqueados;
- barra/progreso numérico;
- botón Equipar.

No se crea un segundo acceso principal.

## Invariantes

- Nobleza sigue siendo `KeloNobility`.
- Títulos personales siguen siendo `KeloTitles`.
- Stats siguen siendo `KeloPlayerStats`.
- `KeloTitles` no decide kills.
- El renderer no decide unlock/equip.
- Online nunca acepta progreso declarado por el cliente.
- `visual:event DEATH` jamás cuenta como kill.
- Nuevos títulos se registran como DATA.
- No se evalúan títulos cada frame.
- `equippedTitleId` es el ID estable replicado; el texto visible se resuelve localmente.

## Validación

- `npm run audit:titles`
- `npm run audit:foundation`
- `npm run audit:docs`
- `tests/title-system.spec.js` en 390×844 y 844×390.

## Estado

**FOUNDATION ACTIVE — IDENTITY / PRESTIGE OWNER**

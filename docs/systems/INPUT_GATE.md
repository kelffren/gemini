# INPUT GATE — KeloInputLocks → processInput

**Estado:** Foundation V1 · bridge temporal de compatibilidad.  
**Código:** `src/core/input-gate.js`  
**Owner:** `KeloInputLocks` es el owner de locks; Input Gate es SUPPORT.  
**API pública gameplay:** ninguna.  
**Auditoría:** `window.KELO_INPUT_GATE_AUDIT`.

## Propósito

Mientras `processInput()` siga viviendo dentro del core legacy, necesitamos un único punto donde el runtime respete `KeloInputLocks` sin pedir a cada panel que manipule movimiento directamente.

Input Gate hace exactamente eso:

```text
processInput solicitado
        ↓
KeloInputLocks.isLocked() ?
   ├─ sí → limpia intención temporal y NO delega al processInput legacy
   └─ no → ejecuta el processInput anterior sin modificarlo
```

No es un segundo sistema de input. Es un bridge temporal hacia el owner nuevo.

## Por qué existe

Antes de Foundation, paneles y hotfixes podían bloquear/desbloquear movimiento escribiendo globals o envolviendo `processInput`. Eso hacía imposible razonar sobre quién mandaba.

El objetivo de transición es:

```text
UI → KeloInputLocks.acquire/release
              ↓
         Input Gate
              ↓
      processInput legacy
```

Cuando Input sea extraído de `engine-a.js`, el nuevo owner podrá consultar `KeloInputLocks` directamente y este bridge deberá retirarse.

## Estado que posee

Ninguno.

Input Gate no guarda claims, no guarda owner de paneles y no decide cuánto dura un lock.

## Estado que puede poner a cero mientras hay lock

Para evitar que una intención previa siga desplazando al jugador, el bridge limpia temporalmente:

- `input.normX`
- `input.normY`
- `input.touchActive`
- `input.touchId`
- teclas activas de `input.keys`
- `localPlayer.vx`
- `localPlayer.vy`

No cambia posición, HP, cooldown, economía ni reglas PvP.

## Dependencias

- `KeloInputLocks`
- `processInput` legacy
- `input`
- `localPlayer`

No depende de DOM ni conoce nombres de paneles.

## Invariante principal

Si `KeloInputLocks.isLocked()` devuelve `true`, `processInput` legacy NO debe ejecutarse.

Si devuelve `false`, el bridge debe delegar exactamente al `processInput` anterior.

## Extension points

Ninguno.

No añadir aquí excepciones tipo:

```text
si inventory...
si PvP...
si emotes...
```

Los consumidores reclaman/rechazan locks mediante `KeloInputLocks`; el gate solo consulta estado agregado.

## Anti-patrones

No añadir timers.

No añadir reglas UI.

No usarlo para stun, root, knockback o slow: esos son estados gameplay.

No crear otro wrapper de `processInput` para una feature nueva.

## Tests

`scripts/input-gate-contract-audit.js` valida:

1. sin lock, delega al `processInput` anterior;
2. con lock, no delega;
3. con lock, limpia intención/velocidad residual;
4. al liberar token, vuelve a delegar.

## Retirada futura

Eliminar únicamente cuando:

1. exista un owner explícito de Input fuera de `engine-a.js`;
2. ese owner consulte `KeloInputLocks` directamente;
3. ningún consumidor dependa del bridge;
4. los smoke tests de movement/menu/PvP/touch pasen sin él.

Hasta entonces debe existir un solo Input Gate, no varios.

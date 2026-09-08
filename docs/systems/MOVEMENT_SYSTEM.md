# KeloMovement — sistema de extensión de movimiento

## Propósito

`KeloMovement` es el OWNER de los puntos de extensión del movimiento del jugador mientras la física base siga viviendo en `engine-a.js`.

Su objetivo no es reemplazar la física existente, sino impedir que cada feature vuelva a hacer esto:

```js
const old = updateMovement;
updateMovement = function(dt){ ... old(dt); ... };
```

Ese patrón crea una cadena de wrappers cuyo orden termina siendo parte accidental del gameplay.

Con Foundation, el patrón oficial es:

```text
updateMovement legacy
       │
       ▼
   KeloMovement
   ├─ before hooks
   ├─ física legacy exacta
   └─ after hooks
```

## Owner y responsabilidades

**Owner:** `window.KeloMovement`  
**Fuente:** `src/core/movement-system.js`

KeloMovement posee únicamente:

- registro de hooks `before`;
- registro de hooks `after`;
- orden determinista por prioridad;
- el único bridge permitido alrededor de `updateMovement` legacy.

No posee:

- input modal;
- joystick UI;
- colisiones;
- abilities;
- VFX;
- cámara;
- PvP;
- render.

La colisión y desplazamiento físico siguen ejecutándose exactamente en el `updateMovement` original de `engine-a.js` durante esta fase transitoria.

## API pública

### `KeloMovement.before(owner, fn, priority)`

Registra una función antes de la física base.

Uso adecuado:

- calcular gait;
- ajustar el speed cap actual;
- transformar intención ya procesada;
- preparar telemetría del frame.

Devuelve un ID de hook.

### `KeloMovement.after(owner, fn, priority)`

Registra una función después de la física base.

Uso adecuado:

- calcular distancia realmente recorrida;
- actualizar estado visual dependiente del desplazamiento;
- aplicar reglas de compatibilidad post-movimiento ya existentes;
- emitir telemetría.

### `KeloMovement.unregister(id)`

Elimina un hook previamente registrado.

### `KeloMovement.snapshot()`

Devuelve la lista de hooks registrados, owner y prioridad. Es observabilidad/debug, no gameplay.

## Orden

Menor prioridad se ejecuta primero.

Estado Foundation inicial:

```text
before
  10 engine-ac:gait-speed

física engine-a

after
  20 engine-ac:visual-motion
  30 engine-ah:release-brake
```

Ese orden preserva la intención histórica:

1. `engine-ac` decide gait/speed antes del movimiento;
2. `engine-a` mueve y colisiona;
3. `engine-ac` calcula stride usando distancia real;
4. `engine-ah` conserva el stop inmediato al soltar.

## Por qué es mejor que wrappers encadenados

Antes, cada archivo capturaba la versión de `updateMovement` existente en el momento de carga. Para entender el resultado final había que reconstruir el orden de `<script>` y cada wrapper.

Ahora un humano o IA puede consultar:

```js
KeloMovement.snapshot()
```

y ver quién participa y en qué orden.

## Regla para nuevas features

Antes de tocar movimiento, pregunta:

1. ¿La feature solo necesita observar o ajustar el ciclo actual? → usa un hook existente.
2. ¿La feature es una regla de input? → pertenece a Input, no a Movement.
3. ¿La feature cambia colisiones? → pertenece a Collision.
4. ¿La feature es un dash/blink/ability? → debe pasar por el owner de abilities y su primitive, no meter reglas especiales aquí.
5. ¿Se necesita una nueva capacidad de movimiento reutilizable? → ampliar el contrato de `KeloMovement`, no crear otro wrapper.

## Invariantes

- Solo existe un wrapper Foundation directo alrededor de `updateMovement` legacy.
- `engine-ac.js` no asigna `updateMovement`.
- `engine-ah.js` no asigna `updateMovement`.
- Los hooks no dependen de DOM/UI.
- La física original de `engine-a.js` se ejecuta exactamente una vez por llamada.
- El orden de hooks es determinista.

## Qué se preservó de engine-ac

- WALK speed y curva actual;
- RUN transition;
- gait idle/walk/run;
- stride por distancia real;
- cadence V2;
- stop V2;
- plant frame;
- reversal audit;
- `KELO_MOVEMENT_AUDIT`.

## Qué se preservó de engine-ah

- detección de ausencia de input;
- `vx/vy = 0` al soltar;
- limpieza de `normX/normY` al soltar.

## Online-first

El movimiento local actual sigue siendo client-side. `KeloMovement` no debe convertirse en autoridad de posición online.

En multiplayer autoritativo:

```text
Input intent
  → client prediction/movement request
  → server authority
  → authoritative position
  → reconciliation
```

Los hooks de presentación/telemetría pueden permanecer en cliente, mientras la autoridad final de posición se sustituye sin cambiar el contrato de contenido.

## Tests requeridos

El contrato debe comprobar:

- física base llamada exactamente una vez;
- before se ejecuta antes;
- after se ejecuta después;
- prioridades deterministas;
- unregister funciona;
- engine-ac/engine-ah no vuelven a envolver `updateMovement`;
- `index.html` carga KeloMovement después de `engine-a` y antes de `engine-ac`.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE**

La arquitectura final podrá mover la física base fuera de `engine-a.js`. Cuando eso ocurra, la API `KeloMovement` debe mantenerse o migrarse de manera compatible, y el wrapper temporal podrá desaparecer.

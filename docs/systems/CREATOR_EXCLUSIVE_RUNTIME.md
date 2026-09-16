# Kelo World — Creator Exclusive Runtime

## Propósito

Permitir que un workspace Creator pesado, como Pixelorama Pro, use la pantalla y presupuesto de CPU/GPU del teléfono sin mantener gameplay, simulación y render del mundo trabajando debajo.

No es un segundo engine ni un lifecycle manager global. Es una capacidad de **Kelo Creators** que adquiere claims temporales en owners Foundation existentes.

## Owner

- **Owner:** Kelo Creators.
- **Fuente:** `src/creators/core/creator-exclusive-runtime.mjs`.
- **Consumidor inicial:** `src/creators/ui/pixelorama-pro-bridge.mjs`.
- **Simulation claim owner:** `KeloSimulation`.
- **Input:** `KeloInputLocks` / `KeloInput`.
- **Movement:** `KeloMovement.intercept`.
- **Render:** `KeloRender.intercept`.
- **Assets:** `KELO_ATLAS_CONTRACT` para eviction segura de atlases no-core sin refs.

## Estado que posee

Sólo claims efímeros del modo Creator exclusivo y los tokens/hook IDs adquiridos a los owners anteriores.

No posee posición, inventario, cámara, render, simulación base, networking, economía ni assets publicados.

## API

```js
enterCreatorExclusiveMode({ root, owner, meta }) -> token
leaveCreatorExclusiveMode(token, { root }) -> boolean
releaseCreatorExclusiveOwner(owner, { root }) -> number
getCreatorExclusiveSnapshot() -> snapshot
```

`KeloSimulation` añade el contrato owner-native:

```js
suspend(owner, meta) -> token
resume(token) -> boolean
resumeOwner(owner) -> number
isSuspended() -> boolean
```

Mientras existe al menos un claim de suspensión, `KeloSimulation` no ejecuta base simulation, legacy bridge ni hooks.

## Flujo

```text
Creator pesado abre
  → KeloInputLocks.acquire
  → KeloMovement.intercept
  → KeloRender.intercept
  → KeloSimulation.suspend
  → KELO_ATLAS_CONTRACT.evict(no-core + refs=0)
  → CREATOR_EXCLUSIVE_ENTER

Creator pesado cierra
  → unregister movement/render intercepts
  → KeloSimulation.resume
  → KeloInputLocks.release
  → CREATOR_EXCLUSIVE_LEAVE
```

El `engine-b` legacy conserva su único `requestAnimationFrame`. El shell del loop sigue vivo, pero los owners hacen que el trabajo pesado quede saltado. No se monkey-patchea ni se crea un segundo scheduler.

## Persistencia

Ninguna. Los claims viven sólo durante la sesión. Si la UI desaparece inesperadamente, el consumidor debe liberar su claim; Pixelorama Pro añade observación de lifecycle del shell para cubrir cierre por Escape/removal.

## Online authority

N/A para gameplay. Esta capacidad únicamente suspende presentación/simulación cliente mientras el usuario edita. No confirma operaciones económicas ni estado compartido.

## Invariantes

1. Un claim Creator no puede escribir gameplay state.
2. Nunca detener/reemplazar directamente `engine-b`.
3. Input se bloquea mediante `KeloInputLocks`.
4. Movimiento/render se interceptan mediante owners públicos.
5. Simulation se suspende mediante `KeloSimulation`, no con un wrapper externo.
6. Sólo atlases no-core con `refs===0` pueden expulsarse.
7. Al soltar el último claim se deben liberar todos los tokens/hook IDs.
8. No timers de vigilancia/polling.

## Eventos

- `CREATOR_EXCLUSIVE_ENTER` / `kelo:creator-exclusive-enter`
- `CREATOR_EXCLUSIVE_CHANGED` / `kelo:creator-exclusive-changed`
- `CREATOR_EXCLUSIVE_LEAVE` / `kelo:creator-exclusive-leave`

## Tests

- `tests/creator-exclusive-runtime.test.mjs` valida claims anidados, lifecycle owner, lock/unlock y eviction segura.
- `scripts/pixelorama-runtime-audit.mjs` valida que Pixelorama consume esta capacidad y no vuelve al iframe externo.

## Observabilidad

`getCreatorExclusiveSnapshot()` muestra claims, owners, estado de input/movement/render/simulation, número de transiciones y atlases expulsados.

`KeloSimulation.snapshot()` expone `suspended`, `suspensions` y `suspendedFrames`.

## Deuda / siguiente fase

- Medir memoria/freeze en Safari iPhone real antes de afirmar ahorro cuantificado.
- Si otros Creators pesados adoptan esta capacidad, añadir tests de claims concurrentes entre workspaces.
- No intentar expulsar atlases `core` hasta que su owner defina una política segura de cold restore.

## Checklist de extensión

- [ ] ¿El editor realmente necesita modo exclusivo?
- [ ] ¿Adquiere/libera token en todos los exits?
- [ ] ¿No crea loop propio de gameplay?
- [ ] ¿No escribe state ajeno?
- [ ] ¿Usa owner estable como `owner` del claim?
- [ ] ¿Tiene prueba de apertura/cierre repetido en iPhone?

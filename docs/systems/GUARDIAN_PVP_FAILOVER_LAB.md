# Guardian PvP Failover Lab

## Objetivo

Este laboratorio valida el relevo real de una sala PvP temporal cuando el Guardian Master desaparece sin liberar voluntariamente su lease.

No mide un `stopMasterHost()` limpio. La prueba cierra el contexto completo de **Master A**, mantiene **Candidate B** vivo y espera a que el backend permita una nueva lease con un `epoch` estrictamente mayor.

## Topología LIVE

```text
Master A
  physical iPhone 14 Pro / Safari / iOS 26 (BrowserStack)
       |
       | WebRTC DataChannel Guardian
       |
Candidate B
  Chromium concurrente en el runner

Supabase Guardian RPC
  -> identidad de test
  -> heartbeat
  -> lease Master
  -> epoch fencing
  -> signaling WebRTC
```

Se reutilizan las cuentas dedicadas de QA Guardian que ya usa `guardian-community-live-verification`. Las credenciales solo viven en GitHub Actions secrets y nunca se imprimen ni se guardan en el repositorio.

## Secuencia

1. Autenticar las dos cuentas de QA.
2. Abrir dos nodos con IDs Guardian distintos.
3. Activar Guardian en A y B.
4. A reclama Master.
5. Esperar a que B vea el mismo `master.nodeId` y `epoch`.
6. Esperar DataChannel directo A↔B.
7. Iniciar la misma room temporal en ambos.
8. Registrar ambos actores en el core PvP y esperar snapshots con ACK.
9. Guardar el último snapshot del epoch de A.
10. Cerrar el contexto completo de A **sin** llamar `stopMasterHost()`.
11. B mantiene heartbeat y prueba a reclamar Master hasta que la lease anterior expire.
12. Exigir un `newEpoch > oldEpoch`.
13. Esperar `workerReady` en B y el primer snapshot del nuevo epoch.
14. Verificar takeover y enviar el siguiente input `ACK + 1`.
15. Limpiar los nodos de QA mediante RPC incluso si A ya no existe.

## Métricas

El test imprime un único objeto `GUARDIAN_PVP_FAILOVER_LIVE` con:

- `oldEpoch`
- `newEpoch`
- `failoverMs`: caída de A → primer snapshot del nuevo epoch
- `snapshotGapMs`: último snapshot de A → primer snapshot de B
- `leaseAcquireMs`: caída de A → B obtiene Master
- `positionDriftPx`: diferencia de la posición del actor B entre la semilla anterior y el primer snapshot restaurado
- `blockedInputsDuringOutage`: intents que no pudieron llegar mientras no existía una ruta Master válida
- `claimErrors`: intentos de B rechazados antes de vencer la lease anterior
- `rejects`: rechazos autoritativos recibidos
- `playersRestored`
- `transientActionsReset`
- `projectilesReset`
- eventos de cierre de peer observados

Los límites por defecto son configurables en CI:

```text
KELO_GUARDIAN_FAILOVER_MAX_MS=45000
KELO_GUARDIAN_FAILOVER_MAX_DRIFT_PX=12
```

Estos límites son un gate de laboratorio, no una promesa de SLA público. Primero se deben acumular varias ejecuciones LIVE antes de endurecerlos.

## Qué debe conservarse

- room ID
- estado seguro del snapshot
- posición
- HP / mana
- cooldowns
- recursos melee
- combo seguro
- ACK / secuencia
- `serverTick` monotónico mediante offset

## Qué debe resetearse

Un takeover nunca debe reanudar a mitad de frame:

- melee activo
- cast activo
- dash/dodge activo
- special hold
- input buffer
- proyectiles en vuelo
- iframe/invulnerabilidad transitoria

La pérdida corta de una acción es preferible a duplicar daño o revivir un proyectil ya consumido.

## Autoridad

Este laboratorio jamás convierte al dispositivo en autoridad de:

- KC/oro
- inventario
- mercado
- compras
- propiedades
- recompensas
- progresión persistente

El Guardian solo aloja gameplay PvP efímero mientras posee la lease Master válida.

## Archivos

- `tests/guardian-pvp-failover-live.spec.js`
- `scripts/guardian-pvp-failover-audit.mjs`
- `browserstack.guardian-failover.yml`
- `.github/workflows/guardian-pvp-failover-live.yml`
- `src/systems/guardian-pvp-host.js`
- `src/workers/guardian-pvp-authority-worker.js`

## Ejecución

El contrato estático corre en cada push que toca esta superficie. La prueba física corre por `workflow_dispatch` o después de un despliegue exitoso de GitHub Pages cuando las credenciales necesarias están configuradas.

El resultado LIVE solo se considera verificado cuando el job `physical-iphone-master-failover` realmente ejecuta el test; un job omitido por falta de secrets no cuenta como validación física.

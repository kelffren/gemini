# Kelo World — Guardian Network V2

## Propósito

Guardian permite que un jugador autorice a Kelo World a usar **capacidad disponible de su dispositivo** cuando el runtime pueda hacerlo. El sistema está diseñado como una red coordinada: el jugador ofrece recursos, pero **Kelo Guardian Coordinator decide qué trabajo es útil**, en qué región y durante qué lease.

La visión de producto/fundador completa está preservada en [`docs/GUARDIAN_NETWORK_VISION.md`](../GUARDIAN_NETWORK_VISION.md). Ese archivo mezcla intención y roadmap de forma explícita; este documento describe el contrato técnico actual.

## Estado actual

### V1 — implementado

- identidad estable de nodo;
- opt-in/opt-out;
- detección/saneamiento de capacidades;
- heartbeat y expiración;
- roles de disponibilidad;
- lease de host máster foreground para cuenta autorizada;
- Supabase bearer;
- mismo HTTP server y mismo simulation loop.

### V2 — foundation implementada

El coordinador ahora también posee contratos server-side para:

- observaciones confiables de región/calidad;
- presión de demanda regional;
- scoring y selección de candidatos;
- leases de workloads;
- planner de apoyo por CPU/upload/loss/tick;
- Verified Service Units;
- rangos Guardian y multiplicadores;
- separación estricta entre Service Units y KC.

**Todavía no está implementado el data plane P2P real**: no hay tráfico WebRTC Guardian↔Guardian, asset seeding efectivo, hot mirror de snapshots ni simulación regional delegada. V2 prepara el scheduler/proof contract para esas fases.

## Owners y archivos

- `src/systems/guardian-authority.js` — `KeloGuardianAuthority`: frontera HTTP autenticada hacia el mismo servidor de Kelo World. No crea otro WebSocket.
- `src/systems/guardian-system.js` — `KeloGuardian`: único owner cliente de preferencia de donación, node ID, capacidades anunciadas y estado recibido del coordinador.
- `src/ui/guardian-ui.js` — `KeloGuardianUI`: consumidor visual; abre/cierra el panel y llama APIs públicas.
- `server/guardian-coordinator.js` — `Kelo Guardian Coordinator`: owner server-side de nodos, observaciones, scheduling foundation, workloads y ledger de servicio verificado.
- `server/index.js` — sigue siendo el owner del proceso HTTP/WebSocket; solo delega `/api/guardian/*` al coordinador.
- `docs/GUARDIAN_NETWORK_VISION.md` — memoria de producto/arquitectura futura para no perder el hilo de diseño.

## Estado que posee

### Cliente

`KeloGuardian` posee:

- `nodeId` estable por instalación;
- preferencia local `enabled`;
- límites/preferencias de donación;
- última vista del estado que respondió el coordinador.

No posee autoridad sobre economía, inventario, PvP, HP, recompensas ni selección autoritativa de workload.

### Servidor

El coordinador mantiene en memoria:

- nodos autenticados activos;
- último heartbeat;
- capacidades saneadas;
- preferencias saneadas;
- readiness roles;
- lease máster;
- observaciones confiables de red/carga;
- demanda regional;
- workload leases activos;
- Verified Service Units y contadores de servicio por nodo.

La memoria sigue siendo efímera en V2. Persistencia histórica de reputación/rewards queda pendiente antes de producción económica.

## Readiness roles

`recommendedRoles(...)` puede declarar:

- `witness-ready`;
- `asset-seeder-ready`;
- `relay-ready`;
- `compute-candidate`;
- `host-ready`.

`host-ready` requiere WebRTC disponible, al menos 4 cores, runtime visible y `saveData` desactivado.

Readiness **no significa asignación**. El scheduler todavía debe elegir un workload y emitir una lease.

## Workload types V2

Contratos preparados:

- `primary-host`
- `hot-mirror`
- `relay`
- `asset-seeder`
- `compute-worker`
- `witness`

Cada assignment tiene:

- `id`;
- `type`;
- `region`;
- `purpose`;
- `epoch`;
- `assignedAt` interno;
- `expiresAt` público;
- costo de capacidad usado para evitar sobreasignación.

Weights actuales de scheduling:

```text
primary-host   1.00
hot-mirror     0.65
compute-worker 0.80
relay          0.40
asset-seeder   0.25
witness        0.15
```

No representan porcentajes físicos exactos; son pesos de admisión/scheduling.

## Observaciones regionales confiables

`observe(ref, observation)` es una API **server-internal**, no un endpoint de jugador.

Puede registrar:

- región observada;
- RTT;
- RTT por región;
- packet loss;
- upload observado;
- CPU load;
- tick Hz;
- conexiones;
- fuente/fecha de observación.

Estas observaciones pueden influir selección de host/relay. El cliente no puede convertir un string como `country=Spain` en autoridad o recompensa.

## Demanda regional

`setRegionalDemand(region, pressure)` acepta presión `0..1` desde un proceso confiable.

Foundation V2 usa un multiplicador de demanda:

```text
1.00 → región sin presión
1.75 → presión máxima
```

El objetivo es incentivar recursos donde la red realmente tiene escasez.

## Scheduler

APIs server-internal:

- `planWorkload(input)` — ranking sin mutar;
- `assignWorkload(input)` — asigna al mejor candidato elegible;
- `acknowledgeWorkload(ref, workloadId, observation?)` — renueva lease de workload explícita;
- `releaseWorkload(workloadId)` — libera y cuenta workload completado;
- `planSupport(input)` — recomienda ayuda según presión.

El score considera, cuando existe:

- frescura del nodo;
- readiness de rol;
- carga ya asignada;
- foreground/charging/save-data;
- CPU/memory;
- región;
- RTT regional;
- packet loss;
- CPU load observado;
- tick quality;
- upload para relay/assets.

### Planner de presión

`planSupport(...)` usa la regla conceptual:

```text
upload/loss alto → RELAY
CPU alto o tick bajo → PRIMARY spillover + HOT MIRROR
presión regional alta → PRIMARY regional
```

El planner no mueve gameplay por sí solo. El data plane/authority handoff futuro debe consumir el plan de forma segura.

## Verified Service Units

Guardian V2 introduce un ledger en memoria de **servicio verificado**.

Tipos foundation:

- `availability_seconds`;
- `host_seconds`;
- `mirror_seconds`;
- `relay_megabytes`;
- `asset_megabytes`;
- `compute_seconds`.

`recordVerifiedContribution(ref, proof)` es server-internal. **No existe endpoint HTTP para que el cliente se autoasigne trabajo o monedas.**

Rates foundation actuales:

```text
availability_seconds = 0.002 unit/s
host_seconds         = 0.200 unit/s
mirror_seconds       = 0.100 unit/s
relay_megabytes      = 0.500 unit/MB
asset_megabytes      = 0.250 unit/MB
compute_seconds      = 0.150 unit/s
```

La disponibilidad vale deliberadamente muchísimo menos que trabajo útil.

Estos rates son tuning. La frontera de confianza es el contrato importante.

## Rangos y multiplicadores

| Rank | Verified units | Multiplicador |
|---|---:|---:|
| Helper | 0 | ×1 |
| Guardian | 1,000 | ×1.25 |
| Sentinel | 10,000 | ×1.5 |
| Warden | 50,000 | ×2 |
| Pillar of Kelo | 250,000 | ×3 |

La intención de producto es permitir ×2 y ×3 a Guardianes históricamente confiables/útiles.

El cálculo foundation es:

```text
raw verified units
× regional demand multiplier
× rank multiplier
= weighted service units
```

### Invariante económica

`recordVerifiedContribution(...)` devuelve explícitamente:

```text
kcMinted: 0
```

Guardian **no acuña KC**. Una fase futura deberá conectar unidades elegibles con `KeloEconomy`/server economy mediante reglas de emisión, caps, persistencia y anti-abuso.

## API pública cliente

`KeloGuardian`

- `state()`
- `activate()`
- `deactivate()`
- `toggle()`
- `refresh()`
- `heartbeat()`
- `startMasterHost()`
- `stopMasterHost()`
- `updatePreferences(next)`
- `capabilities()`

`KeloGuardianAuthority`

- `status(nodeId)`
- `enable(payload)`
- `heartbeat(payload)`
- `disable(payload)`
- `startMaster(payload)`
- `stopMaster(payload)`

No se añaden endpoints públicos de reward/workload en V2.

## Endpoints server

Todos usan el mismo origen HTTP correspondiente al WSS actual y requieren Bearer Supabase:

- `GET /api/guardian/status?nodeId=...`
- `POST /api/guardian/enable`
- `POST /api/guardian/heartbeat`
- `POST /api/guardian/disable`
- `POST /api/guardian/master/start`
- `POST /api/guardian/master/stop`

## Flujo de jugador actual

1. El jugador pulsa **🛡 GUARDIAN**.
2. Pulsa **ENCENDER GUARDIAN**.
3. `KeloGuardian` guarda la preferencia local y anuncia capacidades al coordinador.
4. El coordinador autentica la cuenta, sanea el payload y registra el nodo.
5. Mientras el runtime está disponible, el nodo envía heartbeat reutilizando `KeloSimulation.after`; no existe un segundo loop.
6. Si el navegador/app se suspende y dejan de llegar heartbeats, el nodo expira automáticamente.
7. Al volver a abrir Kelo World, la preferencia persistida permite registrar el nodo otra vez.

La UI V2 aún no visualiza todos los nuevos campos de service/scheduler. Eso se considera una fase player-facing separada.

## Host máster

El botón especial no se desbloquea con un flag local. El servidor exige:

- rol `admin`, o
- permiso `guardian.master_host` / `guardian.master-host`.

La lease requiere foreground y expira si deja de renovarse.

### iPhone

“Usar este iPhone como server” significa host Guardian elegible/foreground, no un proceso Node permanente. iOS puede suspender el runtime en background. Por eso:

- `backgroundContinuousGuaranteed = false`;
- host máster requiere `visibility === visible`;
- la lease expira sin heartbeat;
- al regresar, el nodo puede volver a registrarse.

## Seguridad y autoridad

Invariantes:

1. UI no concede permisos máster.
2. `nodeId` no identifica la cuenta; JWT verificado lo hace.
3. Server sanea capabilities/preferences.
4. Métricas declaradas por cliente no acuñan rewards.
5. Observaciones de scheduling/reward son server-internal.
6. Guardian no acuña KC.
7. Guardian V2 no modifica autoridad de PvP, inventario o economía.
8. Workload lease no equivale todavía a autoridad gameplay; cada data plane deberá definir su propio contrato.
9. No existe segundo WebSocket ni segundo simulation loop.
10. Expirar una lease debe ser seguro; nunca mantener autoridad por watchdog cliente.

## Online-first

Frontera actual:

```text
UI
  → KeloGuardian
    → KeloGuardianAuthority
      → Kelo Guardian Coordinator
        ├→ regional scheduler foundation
        ├→ workload lease foundation
        └→ verified service ledger
              ↓ FUTURO
        WebRTC/data plane + server economy settlement
```

## Extensión futura — PENDIENTE

Todavía no está implementado como workload real:

- signaling/DataChannels WebRTC;
- TURN/NAT strategy;
- relay efectivo y receipts de terceros;
- asset chunks hash-addressed;
- hot mirror de snapshots/inputs;
- takeover/failover real;
- extracción transport-agnostic de simulación para host regional;
- autoridad regional por zona/instancia;
- persistencia histórica de Guardian reputation;
- anti-Sybil/device/account caps;
- settlement Verified Service Units → KC.

Ver `docs/GUARDIAN_NETWORK_VISION.md` para la visión canónica y ejemplos.

## QA

- `npm run audit:guardian`
- `npm run audit:docs`

El audit V2 cubre:

- registro/readiness;
- denegación máster a no-admin;
- lease máster/heartbeat/expiración;
- selección regional EU vs USA;
- planner de apoyo por CPU/upload/loss/tick;
- workload lease/ack/release;
- disponibilidad con valor pequeño;
- service units con demanda regional;
- rangos ×2/×3;
- `kcMinted === 0`;
- autoridad server preservada.

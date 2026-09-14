# Kelo World — Guardian Network V1

## Propósito

Guardian permite que un jugador autorice a Kelo World a usar **capacidad disponible de su dispositivo** cuando el runtime pueda hacerlo. V1 construye el control plane: identidad del nodo, preferencia persistente, detección de capacidades, heartbeat, clasificación de roles posibles y una lease especial de host para una cuenta administradora autorizada.

**Estado V1:** el control plane está implementado. La transferencia P2P real de assets, relay de tráfico y simulación distribuida son fases posteriores y no deben describirse como activas todavía.

## Owners y archivos

- `src/systems/guardian-authority.js` — `KeloGuardianAuthority`: frontera HTTP autenticada hacia el mismo servidor de Kelo World. No crea otro WebSocket.
- `src/systems/guardian-system.js` — `KeloGuardian`: único owner cliente de preferencia de donación, node ID, capacidades anunciadas y estado recibido del coordinador.
- `src/ui/guardian-ui.js` — `KeloGuardianUI`: consumidor visual; abre/cierra el panel y llama APIs públicas.
- `server/guardian-coordinator.js` — Kelo Guardian Coordinator: owner server-side de nodos activos, expiración, roles recomendados y lease de host máster.
- `server/index.js` — sigue siendo el owner del proceso HTTP/WebSocket; solo delega `/api/guardian/*` al coordinador.

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
- roles de disponibilidad (`witness-ready`, `asset-seeder-ready`, `relay-ready`, `compute-candidate`);
- una lease máster con `epoch` y expiración.

Esta memoria es efímera por diseño en V1. Reiniciar el servidor obliga a los nodos a registrarse otra vez.

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

## Endpoints server

Todos usan el mismo origen HTTP correspondiente al WSS actual y requieren Bearer Supabase:

- `GET /api/guardian/status?nodeId=...`
- `POST /api/guardian/enable`
- `POST /api/guardian/heartbeat`
- `POST /api/guardian/disable`
- `POST /api/guardian/master/start`
- `POST /api/guardian/master/stop`

## Flujo de jugador

1. El jugador pulsa **🛡 GUARDIAN**.
2. Pulsa **ENCENDER GUARDIAN**.
3. `KeloGuardian` guarda la preferencia local y anuncia capacidades al coordinador.
4. El coordinador autentica la cuenta, sanea el payload y registra el nodo.
5. Mientras el runtime está disponible, el nodo envía heartbeat reutilizando `KeloSimulation.after`; no existe un segundo loop.
6. Si el navegador/app se suspende y dejan de llegar heartbeats, el nodo expira automáticamente.
7. Al volver a abrir Kelo World, la preferencia persistida permite registrar el nodo otra vez.

## Host máster

El botón de host especial no se desbloquea con un flag local. El servidor exige una cuenta cuyo acceso autenticado contenga:

- rol `admin`, o
- permiso `guardian.master_host` / `guardian.master-host`.

El botón pide una **lease foreground**. Solo un host máster puede estar activo a la vez, salvo sustitución por otro dispositivo de la misma cuenta administradora. La lease se renueva con heartbeat y expira sola si el dispositivo deja de responder.

### Importante sobre iPhone

“Usar este iPhone como server” en V1 significa convertirlo en **host Guardian elegible con lease**, no convertir Safari en un proceso Node que pueda escuchar conexiones entrantes indefinidamente. iOS puede suspender el runtime cuando la pantalla se bloquea o la app pasa a background. Por eso:

- `backgroundContinuousGuaranteed = false`;
- el host requiere `visibility === visible` al tomar la lease;
- si iOS suspende la app, deja de renovar y la lease expira;
- al regresar al juego, Guardian puede registrarse de nuevo automáticamente si la preferencia sigue encendida.

## Seguridad y autoridad

Invariantes:

1. La UI nunca concede permisos máster.
2. Un `nodeId` no identifica una cuenta; la cuenta sale del JWT verificado.
3. El servidor sanea capacidades y límites anunciados.
4. Métricas declaradas por el cliente no pueden acuñar KC/recompensas.
5. Guardian V1 no modifica autoridad de PvP, economía o inventario.
6. El servidor central continúa siendo la verdad de gameplay compartido.
7. No se crea un segundo WebSocket ni un segundo simulation loop.

## Online-first

La frontera ya separa tres capas:

```text
UI
  → KeloGuardian
    → KeloGuardianAuthority
      → Kelo Guardian Coordinator
        → futuro scheduler/data plane verificado
```

Esto permite añadir WebRTC/relay/assets/compute después sin reescribir el botón, preferencias, identidad de nodo ni permisos.

## Extensión futura — PENDIENTE

Todavía no está implementado como workload real:

- signaling y DataChannels WebRTC Guardian↔Guardian;
- asset chunks con hash y verificación;
- relay útil medido desde terceros;
- snapshots/hot mirror;
- ejecución de simulaciones delegadas;
- Proof of Contribution y recompensas server-verified;
- persistencia/telemetría histórica de reputación Guardian.

Cuando se añada, cada workload debe tener contrato verificable y nunca confiar ciegamente en el nodo donante.

## QA

- `node scripts/guardian-system-audit.mjs`
- `npm run audit:guardian` cuando el script esté registrado.
- `npm run audit:docs` para catálogo/guía.

El audit V1 cubre: registro, roles recomendados, denegación máster a no-admin, adquisición de lease, renovación por heartbeat y expiración automática.

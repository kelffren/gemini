# WORLD BUILDER MEMORY — Kelo World

## Misión

World Builder convierte la **Llave Admin** en una herramienta de autor dentro del mundo normal de Kelo World. El jugador común conserva su parcela limitada por unidades; un creador autorizado puede editar el mundo principal sin tocar código.

## Regla principal

No existe un segundo sistema de muebles/objetos.

- **Objetos / estructuras / naturaleza / props** siguen viviendo en `KELO_PROPERTY_SYSTEM`.
- **Terreno / caminos / colisiones de autor** viven en `KELO_WORLD_BUILDER` porque no son inventario ni unidades compradas.
- La UI nunca decide autoridad. Toda mutación pasa por `request()`.

## V1 — capas editables

### SUELO
Overrides por tile de 32×32 sobre el mapa base.
Materiales actuales expuestos por `KELO_TERRAIN_CONTRACT`:
- `grass`
- `marble`

Pinceles V1: 1×1, 3×3 y 5×5.
`REVELAR BASE` elimina el override y vuelve a mostrar la composición inferior.

### CAMINOS
Usa el mismo motor de overrides de terreno con `role: path`. El rol queda guardado en el snapshot para que una autoridad/publisher futura pueda tratar caminos de forma distinta al suelo normal.

### OBJETOS
Reutiliza:
- `KELO_PROPERTY_CATALOG`
- `KELO_PROPERTY_SYSTEM`
- parcel estable `parcel:world:editor`

Un Admin puede colocar/mover/rotar/borrar templates registrados sin consumir unidades. La parcela normal del jugador conserva la economía de unidades.

Cuando `Decoration Reset` suprime las capas Property normales, `world-builder-property-renderer.js` dibuja esas mismas colocaciones directamente desde Property; no duplica estado ni identidad.

### COLISIONES
Rectángulos de autor independientes del inventario. Se guardan con IDs estables y se reflejan en `obstacles` como `noDraw`.

## Permisos

Fuente: `KELO_ADMIN_KEYS`.

- `world.edit`: pintar, colocar/mover/borrar objetos y editar colisiones.
- `world.export`: exportar borrador.
- `world.import`: importar borrador.
- `world.publish`: reservado para publicación autoritativa futura.
- `admin.issue`: emitir llaves.
- `admin.revoke`: revocar llaves.

Un jugador sin `world.edit` no debe ver ni poder abrir World Builder.

## Autoridad y persistencia

### Hoy — OFFLINE / LOCAL DRAFT

`KELO_WORLD_BUILDER` usa `localStorage` detrás de su autoridad local reemplazable:

- storage key: `kelo_world_builder_state_v1`
- schema: `1`

Snapshot conceptual:

```js
{
  schema: 1,
  revision,
  cells: {
    "x,y": { x, y, material, role, actorId, updatedAt }
  },
  collisions: {
    collisionId: { collisionId, x, y, w, h, label, actorId, updatedAt }
  },
  history: [],
  updatedAt,
  lastPublishedRevision
}
```

Los objetos no se copian aquí; siguen en el snapshot de Property.

### Contrato de requests V1

- `world-builder:snapshot`
- `world-builder:export`
- `world-builder:paint`
- `world-builder:erase-terrain`
- `world-builder:collision-create`
- `world-builder:collision-move`
- `world-builder:collision-remove`
- `world-builder:clear-draft`
- `world-builder:import`

`installRemoteAdapter(adapter)` sustituirá la autoridad local por servidor sin cambiar la UI.

## Bundle de borrador

Exportación de autor:

```js
{
  contract: "kelo-world-draft-v1",
  schema: 1,
  exportedAt,
  world: <World Builder snapshot>,
  objects: <Property world layout>
}
```

Esto permite respaldar y mover una edición completa sin mezclar estado de terreno con estado de objetos.

## Render

Orden conceptual:

```text
mundo/base actual
→ overrides SUELO/CAMINOS
→ objetos Property back
→ actores
→ objetos Property front
→ guías de edición / colisiones
```

World Builder no debe renderizarse dentro de una House Instance. `isMainWorld()` bloquea las capas de autor cuando la escena actual es una instancia distinta del mundo.

## API

```js
KELO_WORLD_BUILDER.request(op, payload)
KELO_WORLD_BUILDER.snapshot()
KELO_WORLD_BUILDER.cells()
KELO_WORLD_BUILDER.collisions()
KELO_WORLD_BUILDER.installRemoteAdapter(adapter)
KELO_WORLD_BUILDER.isMainWorld()

KELO_WORLD_BUILDER_UI.open()
KELO_WORLD_BUILDER_UI.close()
```

## Flujo de usuario V1

```text
Llave Admin válida
→ 🗝 WORLD BUILDER
→ elegir SUELO / CAMINOS / OBJETOS / COLISIÓN
→ editar tocando directamente el mundo
→ cambios quedan en BORRADOR LOCAL
→ recargar navegador
→ borrador y placements se reconstruyen
```

La pestaña antigua `MUNDO` del Property Editor debe redirigir a World Builder para no mantener dos interfaces de edición mundial.

## Lo que NO significa V1

- No publica todavía un mundo compartido a todos los jugadores.
- No confía en una URL como autoridad online.
- No convierte `localStorage` en base de datos global.
- No permite a un creador saltarse scopes de la Llave Admin.
- No convierte la parcela personal en ilimitada.

## FUTURO ONLINE — Draft → Review → Publish

La migración prevista:

```text
LocalWorldBuilderAuthority
→ ServerWorldBuilderAuthority
```

El servidor deberá validar:
- identidad y Llave Admin activa;
- scopes;
- revisión/concurrencia;
- bounds del mundo;
- catálogo/asset IDs permitidos;
- colisiones válidas;
- operaciones de import/export;
- quién modificó cada cambio.

Publicación deseada:

```text
LIVE WORLD
→ crear draft/revision
→ creador edita
→ guardar
→ owner/reviewer inspecciona
→ aprobar/rechazar
→ world.publish
→ nueva revisión LIVE
→ rollback disponible
```

## Archivos dueños

- `src/environment/world-builder-system.js` — autoridad local, snapshot, terrain/path/collision overrides y puente de render.
- `src/environment/world-builder-property-renderer.js` — fallback de presentación para placements Property en Decoration Reset.
- `src/ui/world-builder-ui.js` — UI táctil/desktop.
- `src/systems/admin-key-system.js` — entitlement/scopes y bootstrap de herramientas de autor.
- `src/property/property-system.js` — única fuente de verdad para placements/objetos.
- `src/property/property-asset-catalog.js` — templates reutilizables.
- `scripts/world-builder-browser-audit.mjs` — prueba de permisos, edición, persistencia y UI móvil/desktop.
- `.github/workflows/world-builder-admin-v1.yml` — certificación de la rama V1.

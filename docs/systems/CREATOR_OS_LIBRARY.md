# Creator OS Library

## Propósito

`Kelo Creator Library` es la puerta universal de authoring de Kelo World. Presenta personajes, skins, armas, armaduras, items, props, furniture, world content, VFX, animaciones, UI art, monturas, NPCs, abilities, audio, cinematics y packs estacionales en una sola biblioteca, pero **no implementa de nuevo los editores ni los runtimes de esos dominios**.

La Library resuelve una necesidad de navegación/contrato: el creador piensa en “quiero hacer una espada” o “quiero hacer una skin”, no en el nombre interno del workspace que debe abrir.

## Owner

- **Authoring router:** `Kelo Creator Library`.
- **Composition root:** `src/creators/creator-entry.mjs`.
- **Content type registry:** `src/creators/library/creator-content-types.mjs`.
- **UI:** `src/creators/ui/creator-library-workspace.mjs`.
- **Workspace manifest:** `src/creators/workspaces/creator-library-workspace.mjs`.

La Library no reemplaza owners Foundation/gameplay.

## Fuentes principales

- `src/creators/library/creator-content-types.mjs`
- `src/creators/ui/creator-library-workspace.mjs`
- `src/creators/workspaces/creator-library-workspace.mjs`
- `src/creators/workspaces/image-lab-workspace.mjs`
- `src/creators/creator-entry.mjs`
- `src/core/creators-lazy-gate.js`
- `src/creators/ui/image-lab-workspace.mjs`
- `src/creators/ui/asset-forge-workspace.mjs`

## Estado que posee

Solo estado efímero de UI:

- pestaña activa;
- búsqueda actual;
- launch/busy state;
- input-lock mientras la Library está abierta.

## Estado que NO posee

- gameplay state;
- inventario/equipment;
- character appearance runtime;
- world placements;
- asset runtime catalog;
- balances/KC;
- ownership económico;
- publicación global;
- moderación;
- proyectos persistentes de otros workspaces;
- imágenes fuente de Image Lab;
- píxeles/drafts de Asset Forge.

## API pública

### Creator Library UI

```js
openCreatorLibraryWorkspace(context)
getCreatorLibraryWorkspace()
closeCreatorLibraryWorkspace()
```

La sesión expone:

```js
session.openType(typeId)
session.show(tabId)
session.close()
```

### Registry de tipos

```js
CREATOR_CONTENT_TYPES
getCreatorContentType(id)
listCreatorContentTypes({ group, query })
creatorTypeForProjectType(projectType)
```

### Lazy gate

```js
KeloCreatorsLazyGate.openCreatorLibrary()
KeloCreatorsLazyGate.openAssetForge() // compatibilidad
KeloCreatorsLazyGate.open()           // Creator Hub avanzado existente
```

## Content types V1

| Entrada humana | Workspace especializado | Runtime owner/contrato principal |
|---|---|---|
| Character | `avatar` | `KeloCharacterCustomization` + `KeloAvatar` |
| Skin / Clothing | `appearance` | `KeloAppearance` |
| Weapon | `item` | `KeloEquipment` + `KeloAbilities` |
| Armor | `item` | `KeloEquipment` + `KeloAppearance` |
| Item | `item` | inventory/equipment owners |
| Prop / Object | `asset-forge` | `KELO_PROPERTY_CATALOG` + `KELO_PROP_CONTRACT` |
| Furniture | `asset-forge` | Property/world contracts |
| Environment | `environment` | environment owners |
| Prefab | `prefab` | world/property contracts |
| World / Scene | `world` | Studio Kernel + `KELO_WORLD_EDIT` |
| Map | `map-forge` | `KeloMapForge` |
| VFX | `vfx` | `KeloVisualSystem` |
| Animation | `animation` | animation/avatar consumers |
| UI Art / Icon | `asset-forge` | UI consumers |
| Mount | `mount` | `KeloMounts` + catalog |
| NPC | `npc` | NPC/gameplay owners |
| Ability | `ability` | `KeloAbilities` |
| Sprite Ability | `sprite-ability` | `KeloAbilities` + `KeloVisualSystem` |
| Audio | `audio` | audio consumers |
| Cinematic | `cinematic` | cinematic consumers |
| Seasonal Pack | `content-studio` | Universal Content Studio |

Este routing es authoring metadata. No concede automáticamente soporte runtime que el owner de destino todavía no tenga.

## Photoshop-like workflow

Kelo no crea un segundo Photoshop monolítico. El flujo reutiliza capacidades ya presentes:

### Image Lab — preparación de fuentes

Owner existente: `Kelo Creator Assets / Image Lab`.

Actualmente soporta:

- original inmutable;
- working copy reconstruible;
- trim alpha;
- alpha cleanup/snap;
- pixel up/down scale;
- rotate 90°;
- flip;
- revisiones;
- export PNG/WebP/JPEG.

### Asset Forge / Pixel Forge — creación pixel

Owner existente: `Kelo Asset Forge`.

Actualmente cubre:

- dibujo pixel;
- pencil/eraser/fill/picker;
- import;
- undo/redo;
- QA local;
- safe auto-repair;
- manifest de asset;
- biblioteca/market local de prototipo;
- export.

### Specialized workspaces

Después del arte/prep, Character, Appearance, Item, VFX, Animation, World, etc. conservan su propia lógica y contratos.

## Flujo

```text
Creator idea
   ↓
Creator Library — elegir tipo
   ├─ opcional → Image Lab (preparar source)
   ├─ opcional → Asset Forge (pixel art)
   ↓
workspace especializado
   ↓
local/private draft
   ↓
preview / test draft
   ↓
future Validate → Review → Publish authority
   ↓
metadata/preview catalog
   ↓
full content on demand
```

## Dependencias

La Library puede depender de:

- Creator workspace registry;
- project repository interface;
- permission adapter;
- `KeloInputLocks`;
- IDs de workspaces documentados.

No depende del renderer del mundo, arrays legacy de gameplay ni del catálogo completo de assets durante el boot normal.

## Eventos

V1 no introduce un bus paralelo. Cada workspace mantiene sus eventos/bridges existentes. Una fase futura puede emitir eventos genéricos de authoring/publish solo desde el owner correspondiente.

## Persistencia

La Library no crea otra base de proyectos.

- `MY LIBRARY` consulta `projects.list(...)` del repository de Creator ya existente.
- Image Lab usa su source/project store existente.
- Asset Forge conserva su IndexedDB V1 mientras su persistencia no se migre al repository universal.

## Local vs online authority

### Local/client authoring permitido

- preparar imágenes;
- dibujar;
- guardar drafts privados;
- previews;
- metadata no autoritativa;
- test drafts.

### Debe ser server-authoritative antes de economía real

- publish global;
- aprobación/moderación definitiva;
- creator ownership compartido;
- ventas/compras KC;
- revenue split;
- featured/rank manipulable;
- versión publicada canónica;
- retirada global de listings.

La frontera futura debe permitir reemplazar repository/authority sin rehacer IDs, flow del jugador o specialized editors.

## Invariantes

1. Un content type apunta a **un workspace owner**, no a una implementación duplicada.
2. Library no modifica gameplay state.
3. Library no muta `KELO_PROPERTY_CATALOG` en cada edit.
4. Image Lab y Asset Forge se cargan lazy.
5. Normal gameplay no paga el coste de Creator OS.
6. Un catálogo de 20k contenidos no implica 20k nodos DOM/assets/texturas activos.
7. Marketplace/publish económico no puede quedar autoritativo en IndexedDB/localStorage.
8. Existing runtime owners ganan sobre authoring metadata.

## Extension points

### Añadir un tipo nuevo

1. encontrar el owner/runtime existente;
2. encontrar el workspace Creator existente;
3. añadir una fila a `creator-content-types.mjs`;
4. si falta realmente un workspace, crear un manifest lazy documentado que reutilice el owner;
5. añadir test/audit;
6. actualizar este documento y `docs/IMPLEMENTATION_LEDGER.md` si forma parte de un pass activo.

### Añadir una herramienta visual

Preferencia:

`extender Image Lab / Asset Forge / Asset Sheet → test → documentar`

No crear `Photoshop2`, `AssetEditor2` o un segundo history/store sin demostrar el hueco.

## Ejemplos

### Quiero crear una espada

`Creator Library → Weapon → Item workspace`

Arte opcional:

`Image Lab/Asset Forge → referencia/asset → Item definition → KeloEquipment/KeloAbilities`

### Quiero crear pantalón rojo

`Creator Library → Skin / Clothing → Appearance workspace`

El artwork se puede preparar en Image Lab/Asset Forge, pero el runtime cosmético sigue siendo `KeloAppearance`/Character adapters.

### Quiero crear un árbol

`Creator Library → Prop / Object → Asset Forge/Asset Sheet → property/world contract`

No se crea un renderer nuevo.

## Anti-patrones

- `WeaponEditor` que implemente su propio combat engine.
- `SkinEditor` escribiendo state de Character directamente.
- Library copiando toda la lógica de Avatar/Appearance/Item.
- Otro catálogo runtime para assets Creator.
- Cargar Image Lab/Asset Forge durante el boot plaza-first.
- Publicar automáticamente un asset solo porque su preview local funciona.
- Guardar economía real únicamente en IndexedDB.

## Tests / CI requeridos

Antes de `VALIDATED`:

- syntax/import audit de módulos nuevos;
- registry: IDs únicos + workspace route válido;
- abrir/cerrar Creator Library y verificar lock release;
- route smoke: Character, Skin, Weapon, Prop, VFX e Image Lab;
- search/filter mobile;
- normal boot no debe importar UI pesada Creator;
- `npm run audit:docs`;
- gate Playwright iPhone obligatorio de `AGENTS.md` (incluye caminar 8 s sin freeze);
- QA/LIVE móvil para la superficie Creator.

## Observabilidad

Errores de routing usan prefijo `[Creator Library launch]` y códigos `CREATOR_WORKSPACE_*` existentes. No se introduce polling/watchdog.

## Deuda / próximos pasos

- Persistencia universal para Asset Forge detrás de repository adapter.
- Publish Queue / Review / Published / Discover sobre autoridad online.
- Enlace explícito source-asset-definition para mover una imagen preparada entre tools sin export manual.
- Más herramientas de edición no destructiva (layers/masks/selections) solo si se integran al Image Lab existente.
- Tool presets específicos por content type.
- QA especializada por Character/Skin/Weapon/Prop.

## Checklist de extensión

- [ ] ¿Es contenido o capacidad?
- [ ] ¿Qué owner runtime ya existe?
- [ ] ¿Qué workspace ya existe?
- [ ] ¿Puedo enrutar sin duplicar lógica?
- [ ] ¿El módulo pesado sigue lazy?
- [ ] ¿20k entradas siguen costando metadata/virtualización, no runtime activo?
- [ ] ¿Authoring y publish authority siguen separados?
- [ ] ¿KELO-INDEX actualizado?
- [ ] ¿System doc/catalog/ledger sincronizados?
- [ ] ¿Tests + mobile gate registrados antes de VALIDATED?

# Kelo World — Architecture Current

**Actualizado:** 2026-09-16 · Runtime V6.54.2

## Capas

### 1. Boot / Account
`index.html` → Supabase/Auth UI → Guest bypass → engine boot diferido.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, camera, avatar composition, render/simulation extension y update system.

### 3. Legacy Core
`engine-a.js` y `engine-c.js` todavía contienen estado/física/render base. Los demás `engine-*.js` son módulos históricos/feature support. No deben recibir nuevas responsabilidades si existe owner moderno.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators / Creator OS
`src/studio/` contiene document/kernel/tools/UI. `src/creators/creator-entry.mjs` es el composition root lazy de Creators. `src/creators/` contiene workspaces, Map Forge, compilers, Image Lab, Asset Forge, Release, Marketplace, Content Delivery y Creator Use Authority. Todos delegan mutations autoritativas a owners existentes.

`Kelo Creator Library` añade una capa de **authoring routing**, no un engine. Image Lab, Asset Forge, Asset Sheet Studio y los workspaces especializados se componen sobre los mismos contratos y owners.

Los módulos pesados de Creator siguen lazy. Creator Library, MARKET y Appearance no se precargan solo por existir contenido Creator.

`Creator Appearance Authoring Contract V2` añade una frontera explícita entre herramientas de autor y presentación Character. `KeloCreatorCharacterVisualContract` es un compilador puro que transforma la definición editable / payload Creator + dimensiones del asset + slot en el descriptor `sheet|socket` consumido por runtime. El editor y `KeloCreatorCharacterBridge` ya no poseen dos implementaciones distintas de inferencia/anchors/transforms.

La ruta visual de authoring es:

```text
Appearance Creator row
  + local preview image or declared asset
  + real image dimensions
        ↓
KeloCreatorCharacterVisualContract
        ↓ one descriptor schema
  ┌───────────────┬──────────────────────────┐
  │ author preview│ published runtime bridge │
  └───────────────┴──────────────────────────┘
```

`src/creators/appearance/creator-appearance-preview.mjs` es un canvas de authoring event-driven, no un renderer del juego. Reutiliza las mismas fórmulas de presentación de CharacterCustomization y usa `KeloAnchors` cuando existe. Los object URLs de imágenes importadas son temporales, nunca autoridad publicada y se revocan al cerrar/reemplazar. Character tiene preview contractual en cuatro caras; Mount conserva por ahora su preview esquemático.

`Kelo Creator Release Service` refleja review/publicación server-side. `Kelo Creator Marketplace` lista únicamente revisiones publicadas; una compra KC crea settlement + entitlement exacto sin copiar los bytes a una segunda librería.

`KeloCreatorEntitlements` es la frontera común entre marketplace ownership y consumo runtime. `Kelo Creator Content Delivery` entrega una revisión exacta publicada bajo demanda. `Kelo Creator Use Authority` persiste selección/uso únicamente después de publicación activa + autor o entitlement exacto.

`Creator Character State Bridge` conecta los bindings visuales con el Character renderer sin convertir una licencia online en estado local. Para el actor local usa Delivery exacta + entitlement y monta un overlay efímero; `KeloCharacterCustomization`, `KeloCharacterVisualStack` y `KeloAvatar` siguen siendo los owners del estado base/resolución/render. Desde V1.2 el bridge delega toda construcción de descriptor visual a `KeloCreatorCharacterVisualContract`.

`Creator Modular Appearance Replication V1` extiende esa misma proyección a peers remotos sin crear otro renderer ni transporte. El game server deriva un presentation envelope desde los bindings persistidos del personaje autenticado, revalida publicación + acceso exacto + assets publicados, sanea el descriptor y lo adjunta al `avatarManifest` ya distribuido por `server/index.js` dentro del AOI. El viewer no necesita poseer el cosmético para verlo; esa presentación pública no concede derecho a equiparlo.

La ruta remota social es:

```text
creator_character_content_bindings
  → get_my_public_creator_character_appearance(character)
  → server/avatar-sync-store.js
  → existing avatarManifest presentation envelope
  → server/index.js AOI
  → engine-net.js peer.avatarManifest
  → KeloCreatorAvatars lazy Appearance wake-up
  → KeloCreatorCharacterBridge remote WeakMap overlay
  → KeloCreatorCharacterVisualContract
  → KeloCharacterVisualStack
  → KeloAvatar
```

`PvP Visual Presentation Bridge V1` reutiliza exactamente ese envelope server-authoritative, pero no lo copia dentro del snapshot competitivo de 20 Hz. `server/pvp-presentation-wire.js` deriva un `presentationKey` pequeño y envía el manifest completo por el **mismo WebSocket** solo cuando aparece/cambia/se limpia o el actor vuelve a ser visible. `server/pvp-authority.js` permanece presentation-agnostic y no recibe responsabilidad cosmética.

La ruta PvP es:

```text
trusted player.avatarManifest
  → pvp-presentation-wire
      ├─ pvp:presentation on change only
      └─ presentationKey in pvp:snapshot
  → engine-net peer presentation cache
  → KeloPvPWorld renderAvatar(peer,false)
  → existing KeloAvatar / Character visual stack
```

El bridge además corrige una ambigüedad crítica del cliente: **campo `avatarManifest` ausente ≠ clear**. Un snapshot competitivo que no posee presentation preserva el último envelope confiable; solo un clear server-side explícito lo elimina. Durante PvP, el normal AOI state puede seguir transportando otros metadatos, pero el wire retira `avatarManifest` repetido y deja solo `presentationKey`, evitando duplicar el payload visual a alta frecuencia.

El servidor solo reconstruye URLs para `creator-global` con publicación activa y visibilidad `global|official`; el cliente remoto nunca declara URLs ni revisiones a replicar.

Los facades `window.KeloCreatorDelivery` y `window.KeloCreatorUse` viven en `creators-lazy-gate`. En login/reload puede ocurrir un probe metadata-only local. Con cero bindings visuales se detiene sin Appearance. Con bindings se cargan solo las revisiones exactas. Tras equip/clear, el gate reutiliza `KeloNetAuthority.refreshAvatar()` para regenerar el mismo presentation envelope server-side; social AOI y PvP delta presentation consumen esa misma verdad sin un segundo sistema de ownership.

`KELO_CREATOR_CONTENT_REGISTRY` sigue siendo registry semántico genérico. Character local usa el manifest exacto de Delivery como autoridad de revisión; remote presentation usa el envelope exacto saneado por server. Ninguno trata una URL pública, object URL de preview, fingerprint `cv2:*` ni `presentationKey` como ownership.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados. Creator OS/Delivery/Use/Character bridge/authoring contract/replication/presentation wire no sustituyen esos owners.

- `character` full-body reutiliza `set_active_character_avatar` y `KeloCreatorAvatars`;
- `appearance` / Creator `equipment` persiste revisión visual por slot;
- Character bridge proyecta local y remote presentation sobre el mismo Character stack;
- authoring contract solo compila geometría visual; nunca añade stats;
- `KeloCharacterCustomization` conserva estado visual base, catálogo/historial/saves;
- `KeloEquipment` conserva stats, inventario, weapon gameplay y ability loadout;
- `server/pvp-authority.js` conserva movimiento, HP, mana, hits, cooldowns, rewind, CC, muerte y kills PvP;
- `KeloMounts` conserva mount gameplay/state;
- `KELO_PROPERTY_SYSTEM` conserva parcel ownership, bounds, quantities, placement, collision y render.

Creator visual equipment sigue siendo cosmético. Replicarlo en social o PvP nunca concede damage, cooldowns, inventario ni abilities.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

Para Creator content:

- draft/preview privado puede vivir en authoring client;
- un object URL importado por Appearance Creator solo existe para preview local y no es publicación;
- `content_review_requests` es la verdad de review;
- `content_publications` es evidencia de publicación;
- `creator_market_transactions` + `creator_content_entitlements` son settlement/ownership;
- `get_creator_content_delivery(uuid)` entrega solo exact revision autorizada y publicada;
- `kelo_private.require_creator_revision_use(...)` centraliza uso persistente;
- `set_character_creator_content` persiste appearance/equipment visual por slot;
- `get_my_creator_use_state` alimenta el restore local;
- `get_my_public_creator_character_appearance` produce el snapshot de presentación modular actual para el personaje autenticado, revalidando publicación y acceso exacto;
- `set_character_creator_mount` persiste mount Creator;
- `authorize_creator_property_placement` autoriza uso de contenido antes de Property;
- `set_active_character_avatar` conserva avatar selection server-authoritative;
- selección/uso y ownership siguen siendo verdades distintas;
- `creator-global` es transporte público de bytes aprobados, no evidencia de licencia;
- comprar r3 no concede r4 automáticamente;
- remote viewing de un appearance autorizado no concede al viewer el derecho de usarlo;
- `pvp:presentation` es un mensaje server-only de cache/presentation; el cliente no lo usa para mutar autoridad competitiva;
- `presentationKey` y `cv2:*` son identidades de cache/diagnóstico, no licencias ni autoridad cliente.

## Flujo moderno

`source → authoring preview → shared Character visual contract → revision → review → publication → marketplace → KC purchase → exact entitlement → Delivery → server-authorized use binding → local Character overlay / domain owner → trusted server presentation envelope → social AOI o PvP presentation delta → remote overlay/render`

Para acciones persistentes o competitivas, la mutación final sigue perteneciendo al domain owner. Authoring compila geometría; replication/presentation solo transporta presentación server-accepted.

## Fronteras obligatorias

- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos existentes;
- Creator Library enruta, no reimplementa runtimes;
- Appearance Creator Character y runtime usan el mismo `KeloCreatorCharacterVisualContract`;
- preview no inventa un segundo schema de sheet/socket/transforms;
- preview local no se convierte en URL/revisión de autoridad multiplayer;
- Release Center no publica por sí mismo;
- Marketplace no crea wallet/inventory/asset store paralelo;
- Entitlements no crea ownership local;
- Delivery no hace bulk Owned sync;
- Use Authority no reemplaza domain owners;
- Character bridge no usa `select()`/`applySnapshot()` para copiar licencias online a localStorage;
- remote replication no exige viewer entitlement y tampoco concede viewer use rights;
- el cliente nunca declara sus URLs/revisiones visuales como autoridad multiplayer;
- PvP presentation nunca entra en `pvp-authority` como input del cliente;
- no segundo socket ni segundo renderer para Creator modular appearance;
- snapshots competitivos no repiten full presentation manifests por tick;
- ausencia de manifest en un snapshot no equivale a revocación;
- Creator visual `equipment` no modifica `KeloEquipment` gameplay stats;
- Property Creator authorization no sustituye parcel authority;
- cliente no se convierte en autoridad final online.

## Móvil

El editor y Creator surfaces siguen first-use. Appearance Authoring Preview solo existe mientras el workspace está abierto, es event-driven y no añade `requestAnimationFrame`/`setInterval`; la imagen importada vive como object URL efímero. En login/reload puede ocurrir una consulta metadata-only local. Con cero bindings, Appearance no carga. Para peers, networking tampoco carga Appearance hasta que un peer relevante trae un `creatorAppearance` no vacío. Los overlays remotos usan `WeakMap` y `revisionKey` para no reingerir el mismo loadout en cada snapshot. En PvP, el manifest completo se vuelve event-like y el stream de alta frecuencia conserva solo `presentationKey`; actores sin cosmético no generan un clear inicial inútil. No hay polling, bulk library sync ni preload de assets Creator no visibles. La validación final exige dispositivo real/LIVE con editor + múltiples peers social + PvP.

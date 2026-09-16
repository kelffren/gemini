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

`Kelo Creator Library` añade una capa de **authoring routing**, no un engine: traduce intención humana (`Character`, `Skin`, `Weapon`, `Prop`, `VFX`, etc.) al workspace especializado existente. La lista de tipos vive en `src/creators/library/creator-content-types.mjs`.

El “Photoshop” interno se construye por composición, no duplicación:

- `Image Lab` prepara source images de forma no destructiva;
- `Asset Forge` cubre pixel drawing/QA/repair;
- `Asset Sheet Studio` detecta/corta/clasifica sheets;
- Avatar/Appearance/Item/VFX/Animation/World/etc. conservan authoring especializado.

Los módulos pesados de Creator siguen lazy. Creator Library puede abrirse sin precargar el catálogo completo del World Editor. El MARKET surface también se importa solo al tocar `MARKET`.

`Kelo Creator Release Service` es una frontera fina sobre el repository online existente. No crea otra cola ni otra verdad: lee `content_review_requests` y `content_publications`, y permite al creador únicamente enviar/re-enviar su propia revisión a review. El cliente no expone `publish_content_revision`.

`Kelo Creator Marketplace` se construye encima de esa publicación autoritativa. Solo revisiones con una `content_publication` activa pueden listarse. Discover es metadata/preview-first. Una compra KC crea una transacción y un entitlement a una revisión inmutable; no copia los bytes a una segunda librería ni confía en un saldo local.

`KeloCreatorEntitlements` es la frontera común entre marketplace ownership y consumo runtime. Usa acceso por revisión exacta: una cuenta puede usar una revisión cuando la creó o posee un entitlement para esa revisión. Creator OS enlaza el guard al repository autenticado existente; fuera de Creator puede reutilizar `KeloOnlineAuth`. No crea otro auth client ni persiste ownership local.

`Kelo Creator Content Delivery` recibe **una revisión exacta solicitada**, valida access, pide al servidor un manifest de esa revisión publicada y de sus assets publicados, despierta solo el owner opcional necesario y entrega el record a `KELO_CREATOR_CONTENT_REGISTRY`. No sincroniza toda la librería OWNED ni descarga bytes por sí mismo.

`Kelo Creator Use Authority` cierra la frontera de mutación persistente para Creator content: una revisión entregada no se considera seleccionable/persistible únicamente por estado del navegador. La misma regla server-side exige publicación activa + autor o entitlement exacto antes de persistir avatar, appearance/equipment visual o mount; Property recibe un preflight server-side de uso antes de ejecutar sus propias reglas de parcela/placement.

`Creator Character State Bridge` cierra el tramo entre ese binding visual autoritativo y el Character renderer actual. No escribe la licencia en `KeloCharacterCustomization`: monta un overlay efímero de slots solo para el actor local, registra las revisiones entregadas como items `hidden + locked`, y deja que `KeloCharacterVisualStack` + el middleware existente de `KeloAvatar` rendericen la composición. El estado base, history, saves, share code y legacy network snapshot permanecen del owner original.

Los facades `window.KeloCreatorDelivery` y `window.KeloCreatorUse` viven en el `creators-lazy-gate`. Para restaurar visuales Creator tras login/reload, el gate puede importar la capa pequeña de Use/Delivery y hacer un probe metadata-only de `get_my_creator_use_state()`. Si no hay bindings visuales, se detiene ahí: no carga Appearance ni bytes Creator. Si sí existen, `KELO_MODULE_LOADER.ensure('appearance')` carga el Character bridge y se hidratan únicamente esas revisiones exactas.

`KELO_CREATOR_CONTENT_REGISTRY` consulta Entitlements antes de adaptar Creator content a Property/Appearance/Mount/Avatar y vuelve a validar en `getForUse()`. Un record sin permiso queda `restricted`; un cambio de entitlement puede reactivarlo sin reimportar. Appearance, Mount, Property, Character bridge y el avatar local añaden comprobaciones secundarias para impedir reutilizar metadata cacheada después de un cambio de cuenta.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados. Creator OS/Delivery/Use Authority/Character bridge no sustituyen esos owners.

`Kelo Creator Use Authority` compone precondiciones, no absorbe gameplay:

- `character` reutiliza `set_active_character_avatar` y `KeloCreatorAvatars`;
- `appearance` / Creator `equipment` persiste una revisión visual por slot;
- `Creator Character State Bridge` proyecta esa selección server-side sobre el actor local sin persistirla como estado local unlocked;
- `KeloCharacterCustomization` conserva el estado visual base, catálogo/historial/saves y el middleware actual de render;
- `KeloEquipment` conserva stats, inventario, weapon gameplay y ability loadout; una Creator weapon visual no otorga stats;
- `KeloMounts` conserva mount state/gameplay y acepta guards componibles antes de su authority adapter;
- `KELO_PROPERTY_SYSTEM` conserva parcel ownership, bounds, quantities, placement, collision y render; Creator Property authorization solo prueba el derecho a usar esa revisión antes del domain mutation.

La proyección modular Creator V1 es solo del actor local. La replicación de skins/equipment Creator modulares de otros jugadores requiere un snapshot visual server-accepted separado; no se considera completada por este bridge. Los Creator avatars full-body mantienen su ruta multiplayer publicada existente.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

Para Creator content:

- draft/preview privado puede vivir en authoring client;
- `content_review_requests` es la verdad de review;
- `content_publications` es evidencia de publicación global/official;
- `publish_content_revision` permanece reservado a `service_role`;
- `creator_market_listings` referencia únicamente publicaciones activas;
- `character_wallets` + `wallet_ledger` mantienen autoridad KC;
- `creator_market_transactions` registra settlement y `creator_content_entitlements` registra ownership/licencia;
- `list_my_creator_content_access()` + `check_creator_content_access(uuid)` definen la verdad de acceso de una revisión Creator;
- `get_creator_content_delivery(uuid)` entrega metadata solo si la revisión exacta es accesible, está publicada y todos sus asset bindings tienen `asset_publications` activas;
- `kelo_private.require_creator_revision_use(...)` centraliza la regla de uso persistente: exact revision + tipo permitido + publicación activa + autor/entitlement;
- `set_character_creator_content` persiste appearance/equipment visual por slot para un character propio;
- `get_my_creator_use_state` es la fuente server-side que el restore bridge consulta; el cliente no reconstruye ownership desde local state;
- `set_character_creator_mount` persiste la revisión Creator mount seleccionada para un character propio;
- `authorize_creator_property_placement` emite una autorización de uso de contenido antes de Property; no pretende validar parcel geometry/ownership;
- `set_active_character_avatar` mantiene selección Creator character server-authoritative;
- las tablas de use binding no sustituyen `creator_content_entitlements`; selección/uso y ownership son verdades distintas;
- Delivery nunca devuelve paths de `creator-private`; usa únicamente ubicaciones publicadas;
- V1 conserva `creator-global` como transporte público. Una URL pública no es evidencia de licencia; si más adelante se exige secreto de bytes premium, debe sustituirse por published-private + signed URL detrás del mismo manifest contract;
- V1 del marketplace usa 100% Creator / 0% plataforma hasta que una política explícita cambie `seller_share_bps`;
- el cliente no decide precio/split durante settlement;
- una publicación por sí sola no concede uso;
- comprar r3 no concede r4 automáticamente.

## Flujo de asset moderno

`PNG/JPEG/WebP → Image Lab opcional → foreground analysis/Asset Forge → asset sheet compiler → sourceRects/manifest → semantic content revision → specialized Creator/Studio → creator runtime preview → server review → authority publication → marketplace listing → KC purchase → exact-revision entitlement → on-demand delivery manifest → runtime registry → server-authorized Creator use binding/preflight → ephemeral Character overlay o specialized domain owner`

Para acciones persistentes/competitivas online, la última mutación sigue perteneciendo al domain owner. Creator Use Authority garantiza la precondición de acceso al contenido; Character bridge solo proyecta lectura visual; ninguno reemplaza reglas de inventario, stats, parcel, PvP o simulación.

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- templates vía `KELO_PROPERTY_CATALOG`;
- World changes vía Studio/`KELO_WORLD_EDIT`;
- Creator Library enruta, no reimplementa runtimes;
- Image Lab/Asset Forge no crean un segundo catálogo runtime;
- Release Center no aprueba ni publica; solo refleja autoridad y solicita review;
- Creator Marketplace no crea otro wallet, inventario ni asset store;
- `KeloCreatorEntitlements` no crea otro auth client ni ownership store local;
- Creator Delivery no sincroniza toda la librería ni se convierte en asset store;
- Creator Use Authority no crea otro entitlement, inventory, equipment, mount o property owner;
- Creator Character Bridge no usa `select()`/`applySnapshot()` para copiar licencias online a localStorage;
- una compra no es válida solo porque la UI diga `OWNED`; la autoridad es `creator_content_entitlements`;
- una selección persistida no sustituye ownership; bindings de uso siempre referencian una revisión exacta ya autorizada;
- una publicación no implica permiso de uso;
- consumers de contenido Creator genérico deben usar `getForUse()` / `query({usable:true})` o consultar explícitamente el guard;
- un byte URL público de `creator-global` no sustituye entitlement;
- Creator `equipment` visual no modifica gameplay stats de `KeloEquipment`;
- Property Creator authorization no sustituye parcel/geometry/domain authority;
- assets importados no inventan un renderer;
- UI no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Creator Library/Image Lab/Asset Forge/Content Studio/Marketplace siguen por acción explícita. En login/reload puede ocurrir una sola consulta metadata-only de Creator use state. Con cero visual bindings, no se carga Appearance. Con bindings, se despierta Appearance y se entregan solo las revisiones exactas seleccionadas; no hay bulk Owned sync, polling ni preload de otros assets. El cache de manifests/use state es pequeño y metadata-only. Evitar canvas/blur/import masivo simultáneo en iPhone. La verificación final de World móvil y nuevas superficies Creator exige dispositivo real/LIVE además de los gates automatizados aplicables.

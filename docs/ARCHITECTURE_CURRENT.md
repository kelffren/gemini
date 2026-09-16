# Kelo World — Architecture Current

**Actualizado:** 2026-09-15 · Runtime V6.54.2

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
`src/studio/` contiene document/kernel/tools/UI. `src/creators/creator-entry.mjs` es el composition root lazy de Creators. `src/creators/` contiene workspaces, Map Forge, compilers, Image Lab, Asset Forge y evolución. Todos delegan mutations a owners existentes.

`Kelo Creator Library` añade una capa de **authoring routing**, no un engine: traduce intención humana (`Character`, `Skin`, `Weapon`, `Prop`, `VFX`, etc.) al workspace especializado existente. La lista de tipos vive en `src/creators/library/creator-content-types.mjs`.

El “Photoshop” interno se construye por composición, no duplicación:

- `Image Lab` prepara source images de forma no destructiva;
- `Asset Forge` cubre pixel drawing/QA/repair;
- `Asset Sheet Studio` detecta/corta/clasifica sheets;
- Avatar/Appearance/Item/VFX/Animation/World/etc. conservan authoring especializado.

Los módulos pesados de Creator siguen lazy. Creator Library puede abrirse sin precargar el catálogo completo del World Editor.

`Kelo Creator Release Service` es una frontera fina sobre el repository online existente. No crea otra cola ni otra verdad: lee `content_review_requests` y `content_publications`, y permite al creador únicamente enviar/re-enviar su propia revisión a review. El cliente no expone `publish_content_revision`.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados. Creator OS no obtiene autoridad sobre ellos.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

Para Creator content:

- draft/preview privado puede vivir en authoring client;
- `content_review_requests` es la verdad de review;
- `content_publications` es evidencia de publicación global/official;
- `publish_content_revision` permanece reservado a `service_role`;
- mercado, ownership compartido, compras KC y revenue split deben construirse sobre publicaciones aprobadas, no sobre IndexedDB/localStorage.

## Flujo de asset moderno

`PNG/JPEG/WebP → Image Lab opcional → foreground analysis/Asset Forge → asset sheet compiler → sourceRects/manifest → semantic content revision → specialized Creator/Studio → creator runtime preview → server review → authority publication → runtime/discover on demand`

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
- assets importados no inventan un renderer;
- UI no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Creator Library/Image Lab/Asset Forge/Content Studio deben cargar solo por acción explícita. Evitar canvas/blur/import masivo simultáneo en iPhone. La verificación final de World móvil y nuevas superficies Creator exige dispositivo real/LIVE además de los gates automatizados aplicables.

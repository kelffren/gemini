# Kelo Online Foundation

- **Owner gameplay online:** `server/*` (no cambia).
- **Owner persistencia/identidad:** Supabase project `kelo-world` (`iapxdbitjdwvtbpjghct`).
- **Región actual:** `us-west-2`.
- **Cliente de transporte:** `engine-net.js` / `KeloNetAuthority`.
- **Adaptador de identidad server:** `server/online-identity-store.js`.
- **Migraciones:** `supabase/migrations/*`.
- **Player visible:** false.

## 1. Propósito

Esta capa convierte Supabase en la persistencia, identidad, catálogo de contenido y almacenamiento compartido de Kelo World sin convertir Postgres en el game loop. El servidor WebSocket existente sigue siendo la autoridad de movimiento, PvP, daño, cooldowns y demás estado vivo de combate.

La separación obligatoria es:

```text
GitHub Pages / cliente
        |
        +--> Supabase Auth + API + Storage
        |      identidad, metadata, contenido, lectura propia
        |
        +--> server/* WebSocket
               autoridad gameplay
               |
               +--> Supabase
                    persistencia confiable mediante secret key
```

## 2. Invariantes de identidad

- `auth.users.id` = cuenta.
- `profiles.user_id` = perfil público de la cuenta.
- `characters.id` = identidad canónica del personaje dentro del juego.
- Una cuenta puede tener varios personajes; V1 limita creación a 3 mediante `create_character`.
- `characters.legacy_player_key` existe únicamente como puente de migración desde el UUID local que usa actualmente `engine-net.js`.
- El servidor nunca debe aceptar `account_id`, roles o ownership declarados por el navegador.
- `server/online-identity-store.js` verifica el access token contra Supabase Auth y después resuelve que `characterId` pertenezca a esa cuenta.

## 3. Roles y autorización

Roles base:

- `player`
- `creator`
- `moderator`
- `admin`
- `official`

`account_roles` es server-managed. El usuario autenticado puede leer sus roles pero no otorgárselos. `kelo_private.has_role()` es helper de autorización en un schema no expuesto.

Las RPC públicas `SECURITY DEFINER` que puede ejecutar `authenticated` son una excepción intencional: existen para aplicar validaciones y límites atómicos sin otorgar INSERT directo a las tablas. Todas usan `set search_path = ''` y validan `auth.uid()`.

## 4. Creator Asset Library backend

### Identidad estable vs bytes

`asset_families` mantiene la identidad/metadata editable del asset.

`asset_revisions` mantiene revisiones inmutables de bytes. Cada revisión tiene un `asset_id` estable para mapas/runtime:

```text
creator:<owner-user-uuid>:<slug>@r<revision>-<hash-prefix>
```

Un mapa no guarda URL, `blob:` URL ni filename como identidad. Guarda `asset_id`/revision.

### Flujo

```text
archivo local
  -> creator-private/<auth.uid()>/...
  -> register_asset_revision()
  -> asset_review_requests
  -> moderación server-side
  -> creator-global/...
  -> asset_publications
  -> Broadcast asset_published
```

`publish_asset_revision()` es **service_role only**. El navegador no puede promover un draft a global/official.

### Storage buckets

| Bucket | Público | Límite | Escritura |
|---|---:|---:|---|
| `creator-private` | no | 5 MiB | usuario autenticado, solo su carpeta UUID |
| `creator-global` | sí | 5 MiB | backend/moderación únicamente |
| `avatars` | sí | 2 MiB | usuario, solo su carpeta UUID |
| `map-previews` | sí | 5 MiB | usuario, solo su carpeta UUID |

Imágenes permitidas en V1: PNG, WebP y JPEG. El contrato de assets limita dimensiones a 2048×2048.

## 5. Mapas y expansión de mundos

`maps` = identidad estable del mapa.

`map_versions` = cabecera de versión inmutable.

`map_version_chunks` = payload dividido por `chunk_key`, evitando que el diseño dependa para siempre de un JSON gigante por mapa.

`map_asset_refs` = dependencias exactas a revisiones de assets. Esto permite prefetch, auditoría de dependencias y detectar si un asset está en uso antes de retirarlo.

`map_publications` = versiones publicadas (`unlisted`, `global`, `official`). Publicar una versión no modifica la versión anterior.

## 6. Economía persistente

La DB no sustituye a `PlayerEconomyStore`; es su capa de persistencia futura.

- `character_wallets`: saldo materializado actual.
- `wallet_ledger`: historial append-only de cambios.
- `apply_wallet_delta()`: RPC **service_role only**, atómica, evita saldo negativo y usa `correlation_id` para idempotencia.
- `item_instances`: ownership canónico de items por UUID.
- `character_equipment`: slots equipados apuntan a `item_instances` y un trigger comprueba que item/personaje coincidan.
- `character_state_snapshots`: snapshot versionado para estado persistente que todavía no tenga tabla especializada.

Nunca se debe aceptar desde el cliente: `newBalance`, `damage`, `lootGranted`, `forgeSuccess`, `marketSettlement` ni cualquier resultado valioso final.

## 7. Confiabilidad y operaciones

### Idempotencia

`server_idempotency` guarda resultados de requests de backend que no deben ejecutarse dos veces.

### Transactional outbox

`server_outbox` permite escribir un cambio y el evento que debe salir de la DB dentro de la misma transacción. Un worker puede entregar esos eventos y reintentarlos sin perderlos.

### Auditoría

`server_audit_events` es service-only y registra eventos de seguridad/operación sin exponer IP cruda; el campo previsto es `ip_hash`.

## 8. Realtime

El loop de juego NO usa Postgres Changes.

- movimiento/PvP/skills: `server/*` WebSocket.
- publicación pública de assets/mapas: Supabase Realtime Broadcast con payload mínimo.
- datos privados de economía/moderación: server authority; no Broadcast público.

Los triggers actuales usan Broadcast público únicamente para acontecimientos que ya son públicos (`asset_published` y `map_published`). Si en el futuro un evento contiene datos privados debe usar canal privado con autorización o el WebSocket del servidor.

## 9. RLS y secretos

- Todas las tablas públicas de la fundación tienen RLS activo.
- Las tablas exclusivamente server-side tienen políticas deny explícitas para `anon`/`authenticated`.
- Las columnas usadas por FK/RLS/feeds importantes tienen índices desde V1.
- Browser: `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*`) solamente.
- Server: `SUPABASE_SECRET_KEY` (`sb_secret_*`) preferida; `SUPABASE_SERVICE_ROLE_KEY` solo como compatibilidad temporal.
- Nunca versionar una secret/service-role key.
- La secret key no es JWT y no se envía como `Authorization: Bearer`.

## 10. Estado legacy

`equipment_items`, `forge_history`, `nobility_players` y `nobility_history` ya existían como owners de persistencia de sistemas activos. No se eliminan ni se reemplazan de golpe. Se mantienen service-only y se migrarán gradualmente a `characters.id`/wallet ledger sin romper los servicios actuales.

No crear tablas paralelas adicionales para resolver temporalmente la transición.

## 11. APIs de DB relevantes

Client-authenticated controladas:

- `create_character(name)`
- `claim_legacy_player_key(character_id, player_key)`
- `create_asset_family(...)`
- `register_asset_revision(...)`
- `submit_asset_revision(revision_id)`
- `create_map(...)`
- `register_map_version(...)`

Trusted-server only:

- `publish_asset_revision(...)`
- `publish_map_version(...)`
- `apply_wallet_delta(...)`
- `nobility_donate(...)`

## 12. Tests / auditoría

- `npm run audit:online-foundation`
- `npm run audit:foundation`
- `npm run audit:docs`
- Supabase Security Advisor después de cambios DDL/RLS.
- Supabase Performance Advisor después de cambios de FK/policies/queries.

El audit local verifica versiones de migraciones únicas, contratos RLS, buckets, versionado de assets/mapas, idempotencia del ledger, ausencia de secrets y semántica de `sb_secret` en `server/online-identity-store.js`.

## 13. Anti-patrones prohibidos

- guardar URLs/blob URLs en mapas como identidad;
- reemplazar bytes de una revisión publicada;
- que el cliente escriba directamente una publicación global;
- poner `service_role`/`sb_secret` en Pages, localStorage o repo;
- crear un segundo servidor multiplayer cuando `server/*` ya es el owner;
- guardar posiciones PvP cada frame en Postgres;
- usar Postgres Realtime como sustituto del fixed-step WebSocket;
- actualizar saldos sin ledger/correlation id;
- unir para siempre `auth.users.id` y personaje en un solo ID semántico.

## 14. Expansión prevista sin ruptura

Esta base admite agregar después sin cambiar los IDs actuales:

- guilds/clanes;
- friendships/social graph;
- housing/properties;
- mail;
- quests/achievements;
- market/order books;
- creator packs/collections;
- moderation/reporting;
- world shards/regions;
- CDN/R2 para bytes grandes manteniendo los mismos `asset_id`;
- jobs/workers que consuman `server_outbox`.

Las nuevas áreas deben crear tablas especializadas cuando tengan semántica propia, en vez de convertir `character_state_snapshots.payload` en una bolsa infinita de JSON.

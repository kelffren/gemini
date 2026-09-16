# Community Guardian Runtime Proof — Kelo World

**Estado:** CODE + CI READY · SUPABASE LIVE DEPLOY PENDING  
**Owner:** Kelo Community Asset Pipeline  
**Fecha:** 2026-09-16

## Objetivo

Mostrar `Guardian Verified` únicamente cuando un asset comunitario renderizado pueda demostrar con verdad server-side que su revisión inmutable y su SHA-256 coinciden con una prueba Guardian sellada.

El manifest del creador nunca concede el badge.

## Arquitectura

```text
Server avatar authority
  -> communityAssets saneados
     (revisionId + sha256 + storage path + dimensions)
  -> AOI / avatar manifest
  -> DynamicAssetStreamManager
  -> bytes descargados y SHA comprobado
  -> kelo:community-player-assets-ready
  -> Guardian provenance sidecar
  -> existing KeloOnlineAuth Supabase client
  -> public.asset_guardian_provenance (RLS read-only)
  -> exact revision_id + asset_hash match
  -> Guardian Verified event / player proof state
```

El sidecar se carga junto al runtime comunitario, pero no entra en su lógica de descarga, caché, AOI, renderer o fallback. La consulta de provenance empieza después de `kelo:community-player-assets-ready`, por lo que una caída de Supabase nunca retrasa la aparición del asset ni bloquea gameplay.

## Binding de servidor

`server/avatar-sync-store.js` ya deriva `communityAssets` desde estado persistido y sanea cada entrada. Entre los campos que entrega al cliente están:

- `revisionId`
- `sha256`
- `publicationId`
- `assetId`
- `path`
- `mime`
- `bytes`
- `width`
- `height`

La URL pública también se reconstruye en servidor. El cliente no decide esos valores.

## Fuente de verdad Guardian

`src/creators/assets/community-guardian-provenance-runtime.mjs` consulta exclusivamente `public.asset_guardian_provenance` y selecciona:

- `revision_id`
- `asset_hash`
- `preset`
- `contributor_count`
- `guardian_verified_at`

La tabla pública es un agregado creado por el bridge `service_role` de `20260916080000_asset_guardian_publication_provenance.sql`. No contiene node IDs ni contributor tokens.

## Anti-forgery

El sidecar ignora deliberadamente cualquier campo que intente declarar provenance desde el manifest, incluyendo:

- `guardianVerified`
- `guardianProvenance`
- contributor count declarado por cliente
- statements declarados por cliente
- tokens
- node IDs

Para `verified:true` deben cumplirse simultáneamente:

1. `revisionId` válido;
2. SHA-256 de 64 hex;
3. fila RLS-visible con el mismo `revision_id`;
4. el mismo `asset_hash`;
5. preset Guardian permitido;
6. `contributor_count >= 2`;
7. fecha de verificación válida.

Cualquier fallo produce un resultado no verificado y badge oculto.

## Eventos

### Render listo

`kelo:community-player-assets-ready`

Sigue perteneciendo al runtime comunitario y ocurre antes de la prueba Guardian.

### Prueba individual

`kelo:community-asset-provenance-ready`

```js
{
  playerId,
  assetId,
  key,
  proof: {
    verified: true,
    status: 'verified',
    revisionId,
    assetHash,
    source: 'guardian-community-supabase-v1',
    communityBuilt: true,
    preset,
    contributorCount,
    verifiedAt,
    statement: 'Built with 2 Kelo Guardians'
  },
  badge: {
    visible: true,
    label: 'Guardian Verified',
    detail: 'Built with 2 Kelo Guardians'
  }
}
```

### Batch por jugador

`kelo:community-player-provenance-ready`

El sidecar también mantiene en el record del jugador:

- `communityGuardianProofs`
- `communityGuardianVerifiedCount`

Esto permite que perfil, inspector o UI consuman la prueba sin repetir consultas.

## Concurrencia

Cada actualización de equipment lleva `generation`. Si una consulta vieja termina después de una generación nueva, el sidecar descarta el batch viejo para no pintar badges de equipment que el jugador ya quitó.

## Cache

- clave: `revisionId:sha256`;
- TTL normal: 5 minutos;
- error de consulta: 30 segundos;
- solo se cachea prueba pública agregada.

## Estados fail-closed

- `missing-server-binding`
- `backend-unavailable`
- `proof-query-error`
- `proof-query-failed`
- `no-server-proof`
- `invalid-server-proof`
- `verified`

Solo `verified` hace visible el badge.

## CI

`scripts/community-guardian-runtime-proof-audit.mjs` comprueba:

- lectura de la tabla server-owned;
- columnas explícitas;
- rechazo de claims Guardian del cliente;
- que el runtime central no consulte la tabla;
- que el sidecar se cargue de forma lazy con el runtime;
- `revisionId` + SHA presentes en el manifest server-side;
- grants de solo lectura + RLS;
- forged claim rechazado;
- fila válida aceptada;
- hash mismatch rechazado;
- quorum inválido rechazado;
- ausencia de proof rechazada;
- error RLS/query rechazado.

Main Stability ejecuta este auditor en cada PR a `main`.

## LIVE pendiente

La conexión Supabase disponible en esta sesión sigue devolviendo cero proyectos. Por eso este documento no afirma que la migración o la Edge Function estén desplegadas en producción.

Cuando el proyecto aparezca conectado:

1. aplicar migraciones Guardian pendientes;
2. desplegar Edge publisher V2;
3. ejecutar Security Advisors;
4. ejecutar Performance Advisors;
5. publicar un asset Guardian real y uno normal;
6. comprobar desde dos sesiones que solo el asset sellado recibe `Guardian Verified`.

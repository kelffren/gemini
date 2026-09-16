# Community Guardian Runtime Proof — Kelo World

**Estado:** CODE + CI READY · SUPABASE LIVE DEPLOY PENDING  
**Owner:** Kelo Community Asset Pipeline  
**Fecha:** 2026-09-16

## Objetivo

Mostrar `Guardian Verified` dentro del runtime solamente cuando un asset comunitario publicado puede demostrar, mediante verdad de servidor, que su revisión inmutable y su SHA-256 coinciden con una prueba Guardian sellada.

El manifest del creador nunca es autoridad para el badge.

## Flujo

```text
community manifest
  -> revisionId + sha256
  -> asset bytes downloaded / SHA checked
  -> renderer receives asset immediately
  -> runtime proof resolver
  -> existing KeloOnlineAuth Supabase client
  -> public.asset_guardian_provenance (RLS read-only)
  -> exact revision_id + asset_hash match
  -> preset/count/date validation
  -> Guardian Verified event + badge model
```

La verificación de provenance ocurre **después** de `kelo:community-player-assets-ready`. Un lookup de Supabase nunca debe bloquear la aparición del jugador, un cosmético ni el game loop.

## Fuente de verdad

`src/creators/assets/community-guardian-provenance-runtime.mjs` consulta exclusivamente:

- `revision_id`
- `asset_hash`
- `preset`
- `contributor_count`
- `guardian_verified_at`

Desde `public.asset_guardian_provenance`.

Esa tabla es alimentada únicamente por el bridge `service_role` creado en `20260916080000_asset_guardian_publication_provenance.sql`. El runtime reutiliza `KeloOnlineAuth.getClient()`; no crea otro cliente Supabase, otro socket ni otro transporte.

## Binding inmutable

Los manifests nuevos incluyen `revisionId`, propagado desde la respuesta server-side de publicación. La prueba requiere simultáneamente:

1. `revisionId` UUID válido;
2. `sha256` de 64 hex;
3. misma `revision_id` en la tabla pública;
4. mismo `asset_hash`;
5. preset Guardian permitido;
6. `contributor_count >= 2`;
7. fecha de verificación válida.

Fallar cualquiera de estas condiciones produce `verified:false`.

## Anti-forgery

Los siguientes campos, aunque aparezcan en un manifest descargado, se ignoran deliberadamente:

- `guardianVerified`
- `guardianProvenance`
- contributor count declarado por cliente
- statement declarado por cliente
- tokens o node IDs

Un creador puede modificar su JSON local, pero no puede convertirlo en provenance verificada.

## Eventos

### Render listo

`kelo:community-player-assets-ready`

Se mantiene igual y sale antes del lookup de provenance.

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

### Batch del jugador

`kelo:community-player-provenance-ready`

Permite a UI/perfil actualizar varios badges sin volver a consultar.

## Estados fail-closed

- `missing-server-binding`
- `backend-unavailable`
- `proof-query-error`
- `proof-query-failed`
- `no-server-proof`
- `invalid-server-proof`
- `verified`

Solo `verified` puede producir `badge.visible === true`.

## Cache

La prueba se cachea por `revisionId:sha256`, 5 minutos por defecto. Errores de query se cachean como máximo 30 segundos. El cache contiene solo prueba pública agregada; no guarda identidad de nodos ni tokens de contribuidores.

## CI

`scripts/community-guardian-runtime-proof-audit.mjs` verifica:

- que el resolver consulta la tabla server-owned;
- columnas explícitas;
- que no confía en campos Guardian del manifest;
- binding revisión + hash;
- propagación de `revisionId` desde publisher a manifest;
- render antes del lookup;
- RLS/grants de solo lectura;
- forged claim sin binding => rechazado;
- fila válida => badge visible;
- hash mismatch => rechazado;
- quorum inválido => rechazado;
- sin fila => rechazado;
- error RLS/query => rechazado.

Main Stability ejecuta este auditor en cada PR a `main`.

## LIVE pendiente

El código está preparado, pero la conexión Supabase disponible desde ChatGPT continúa devolviendo cero proyectos. Por eso esta etapa no afirma que la tabla/migración o Edge Function estén desplegadas en producción.

Cuando el proyecto aparezca conectado, el orden es:

1. aplicar migraciones Guardian pendientes;
2. desplegar Edge publisher V2;
3. ejecutar Security Advisors;
4. ejecutar Performance Advisors;
5. publicar un asset Guardian real y uno normal;
6. comprobar en dos sesiones que solo el primero recibe `Guardian Verified`.

# Community Guardian Publication Provenance

**Estado:** CODE + CI CONTRACT READY · LIVE SUPABASE DEPLOY PENDING
**Owner:** Kelo Community Asset Pipeline + Guardian Community
**Fecha:** 2026-09-16

## Problema que resuelve

La validación estructural de un upload y la prueba de que sus bytes fueron construidos por Kelo Guardians son dos hechos diferentes.

Un PNG puede ser seguro, tener SHA-256 correcto y ser publicable sin haber participado nunca en Guardian Community Compute. Por eso `serverStructuralVerified` y `guardianVerified` nunca comparten autoridad.

Tampoco se usa `asset_revisions.metadata` como prueba. Ese JSON pertenece al dominio creator y puede ser suministrado por una sesión autenticada al registrar su propia revisión; sirve para descripción, no para conceder badges autoritativos.

## Fuente de verdad

Migración:

`supabase/migrations/20260916080000_asset_guardian_publication_provenance.sql`

Tabla pública agregada:

`public.asset_guardian_provenance`

Guarda únicamente:

- `revision_id`;
- SHA-256 del asset;
- preset Guardian permitido;
- cantidad agregada de contribuidores;
- fecha de verificación Guardian;
- fecha en que se registró la prueba de publicación.

No guarda:

- `nodeId`;
- usuario del Guardian;
- IP;
- hardware;
- tokens anónimos de la malla P2P;
- KC, reward o poder jugable.

La tabla tiene RLS. `anon` y `authenticated` solo pueden leer una fila cuando la revisión correspondiente tiene una publicación activa en `public.asset_publications`. No tienen permisos de INSERT/UPDATE/DELETE.

## Puente autoritativo

RPC:

`record_asset_guardian_provenance(revision_id, asset_hash)`

Solo `service_role` puede ejecutarlo.

El RPC:

1. exige SHA-256 de 64 hex;
2. carga la revisión inmutable;
3. exige que `asset_revisions.content_hash` sea exactamente el mismo hash;
4. busca ese hash en `kelo_private.guardian_community_assets`;
5. esa tabla privada solo contiene assets previamente sellados por el quorum persistente Guardian;
6. exige al menos dos contribuidores;
7. copia únicamente provenance agregada segura a `public.asset_guardian_provenance`.

Si el hash no está sellado por Guardian, elimina cualquier provenance previa de esa revisión y devuelve `verified:false`.

## Edge publisher V2

`supabase/functions/kelo-community-asset-publish/index.ts`

El publisher continúa haciendo validación real de bytes en servidor:

- auth de usuario;
- rate limit;
- MIME;
- tamaño;
- dimensiones;
- SHA-256 calculado sobre los bytes recibidos;
- cuarentena privada;
- publicación en `creator-global` mediante autoridad backend.

Después de publicar la revisión, llama al RPC de Guardian con credenciales server-side. El cliente nunca envía contributor count, preset, `guardianVerified`, tokens ni node IDs.

Respuesta relevante:

```json
{
  "serverStructuralVerified": true,
  "guardianVerified": false,
  "guardianProvenance": null
}
```

Si existe prueba Guardian auténtica, `guardianVerified` pasa a `true` y `guardianProvenance` contiene solo `source`, `assetHash`, `communityBuilt`, `preset`, `contributorCount` y `verifiedAt`.

## Fail closed

Si la migración no está desplegada, el RPC no existe o Supabase no puede confirmar la prueba, el asset estructuralmente válido puede seguir publicándose, pero **no recibe badge Guardian**.

Esto permite desplegar la protección gradualmente sin romper el marketplace y evita que una caída del subsistema Guardian convierta datos no verificados en datos verificados.

## Autoridad de UI futura

Un badge visible de “Built with Kelo Guardians” debe basarse en `public.asset_guardian_provenance` o en una respuesta backend derivada de esa tabla. Un campo equivalente dentro de un manifest local o metadata creator es, como máximo, caché/pista visual y nunca autoridad.

## Privacidad y economía

La provenance confirma el origen computacional de los bytes, no quién es el creador humano ni quién posee derechos comerciales sobre ellos. Tampoco concede KC, rankings PvP, daño, estadísticas ni prioridad económica.

## CI

`scripts/community-guardian-publication-audit.mjs`

Main Stability bloquea regresiones si:

- se desactiva RLS;
- `anon/authenticated` pueden escribir provenance;
- el RPC deja de ser service-role-only;
- desaparece la comparación revision-hash;
- deja de usarse `kelo_private.guardian_community_assets`;
- el Edge acepta campos Guardian desde FormData;
- vuelve el flag ambiguo `serverVerified:true`;
- una bandera autoritativa se almacena dentro del metadata creator editable.

## Despliegue LIVE pendiente

El conector Supabase de la sesión actual devuelve cero proyectos. Por tanto esta migración y el Edge V2 todavía no se han aplicado a una base LIVE. Cuando el proyecto esté conectado, el orden correcto es:

1. aplicar/verificar migración;
2. desplegar Edge Function V2;
3. ejecutar Security Advisor;
4. ejecutar Performance Advisor;
5. ejecutar Guardian Community LIVE Verification con dos cuentas;
6. publicar un asset Guardian real y comprobar que aparece exactamente una fila pública de provenance;
7. publicar un asset normal y comprobar que permanece `guardianVerified:false`.

# Guardian Community Identity

## Estado

**CLIENT + SUPABASE CONTRACT READY · LIVE DATABASE DEPLOY PENDING**

El perfil Community Builder está diseñado para persistir entre dispositivos. La cuenta autenticada es la identidad; el navegador solo conserva una caché de lectura rápida.

## Objetivo

Hacer visible que los jugadores que donan cómputo forman parte de la construcción de Kelo World sin convertir la contribución en dinero, KC, poder PvP o ventaja jugable.

## Flujo autoritativo V2

1. `KeloGuardianGpuAssets` produce un candidato procedural y el Master obtiene quorum de hash en la malla.
2. `KeloGuardianCommunity` genera provenance anónima y un recibo P2P con `assetHash`, preset, epoch del Master y tokens SHA-256 anónimos.
3. Cada nodo cuyo token aparece en el recibo llama por sí mismo a `guardian_community_attest` usando su sesión Supabase autenticada.
4. Supabase comprueba que ese `nodeId` pertenece a la sesión, está activo, reciente y tiene rol recomendado `asset-gpu-worker`.
5. Supabase comprueba que el `masterEpoch` sigue siendo el lease Guardian actual.
6. Una sola cuenta nunca puede sellar el crédito. El asset se considera persistente cuando al menos **dos cuentas autenticadas distintas** atestiguan el mismo `jobId + assetHash + preset + epoch`.
7. Al alcanzar quorum, el backend crea las contribuciones de cada cuenta participante.
8. `guardian_community_profile()` devuelve el total y los recibos recientes; cualquier iPhone/navegador conectado con la misma cuenta ve el mismo perfil.

## Fuente de verdad

### Servidor

Migración:

`supabase/migrations/20260916065500_guardian_community_profile_v1.sql`

Tablas:

- `kelo_private.guardian_community_attestations`: pruebas efímeras por cuenta/nodo.
- `kelo_private.guardian_community_assets`: assets sellados por quorum.
- `public.guardian_community_contributions`: historial de reconocimiento por cuenta. Tiene RLS activado y no permite escritura directa del cliente.

RPC autenticados:

- `guardian_community_profile()`
- `guardian_community_attest(node, job, hash, preset, epoch)`
- `guardian_community_asset_status(hash)`

Las funciones públicas revocan `EXECUTE` a `PUBLIC/anon` y se conceden solo a `authenticated/service_role`. Los `SECURITY DEFINER` usan `search_path=''`, `auth.uid()` y referencias de esquema explícitas.

### Cliente

`localStorage` usa `kelo.guardian.community.profile.v2` únicamente como caché del último perfil recibido del servidor.

Invariantes:

- `localCacheAuthority: false`
- `serverAuthoritativeProfile: true`
- un contador local no puede subir de rango;
- si el backend no está desplegado, la UI muestra `BACKEND PENDIENTE` o `CACHÉ OFFLINE`, pero no inventa crédito.

## Rangos de reconocimiento

- Spark: 0 contribuciones verificadas.
- Builder: 1.
- Forge: 5.
- Architect: 20.
- Pillar: 100.

La métrica es número de assets sellados por quorum en los que participó la cuenta. No se premia hardware más caro, GPUu anunciadas ni tiempo conectado sin trabajo útil validado.

## Provenance para Asset Forge

Evento: `kelo:guardian-asset-provenance`.

Campos principales:

- `source: "kelo-community-compute"`
- `assetHash`
- `communityBuilt: true`
- `contributorCount`
- `anonymousContributorTokens`
- `consensus`
- `serverVerified`
- `serverProofRequired: true`
- `containsNodeIds: false`
- `requiresAssetForgeQA: true`

Cuando Supabase confirma el quorum, el cliente vuelve a emitir la provenance con `serverVerified: true` y dispara `kelo:guardian-community-verified`.

## Privacidad

- La provenance pública nunca contiene `nodeId`, usuario, IP, ubicación o hardware.
- El recibo P2P solo contiene tokens de 12 hex derivados de SHA-256 para reconocimiento efímero dentro de esa sesión.
- El servidor conoce `nodeId` solo dentro de la tabla privada de atestaciones para comprobar ownership/actividad; el historial persistente por cuenta no guarda `nodeId`.
- No existe leaderboard público en esta fase.

## Seguridad

- Quorum persistente mínimo: 2 cuentas autenticadas distintas.
- El node debe estar activo en `guardian_nodes`, con heartbeat reciente y rol `asset-gpu-worker`.
- El epoch debe coincidir con el lease Master Guardian vivo.
- Presets permitidos están allowlisted en SQL.
- `jobId` está ligado criptográficamente al hash mediante `community:<assetHash>`.
- Atestaciones expiran de la tabla temporal después de 10 minutos.
- Repetir la misma contribución no aumenta el contador por el `UNIQUE(user_id, asset_hash)`.
- El reconocimiento no tiene autoridad económica, KC ni PvP.

## UX

El panel **Community Builder** muestra:

- rango;
- cantidad de assets verificados ayudados;
- progreso al siguiente rango;
- historial reciente cross-device;
- estado `PERFIL SINCRONIZADO`, `SINCRONIZANDO`, `BACKEND PENDIENTE` o `CACHÉ OFFLINE`.

La frase principal sigue siendo: **“TÚ FORMAS PARTE DEL CÓDIGO.”**

## Despliegue pendiente

El conector Supabase de esta sesión no tiene ningún proyecto conectado, por lo que la migración todavía no se aplicó a una base LIVE. El código degrada de forma segura hasta que el proyecto se conecte: conserva caché pero no concede nuevo crédito persistente.

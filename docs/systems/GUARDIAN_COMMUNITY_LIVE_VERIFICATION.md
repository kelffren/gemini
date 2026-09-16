# Guardian Community Live Verification

## Objetivo

Cerrar la diferencia entre el contrato probado en CI y el comportamiento real de un proyecto Supabase desplegado.

Este harness ejecuta un smoke test real con **dos cuentas Supabase de prueba distintas**. No usa `service_role`, no usa jugadores reales y no concede autoridad alternativa al cliente.

## Estado

- Contrato determinista de dos cuentas: integrado en Main Stability.
- Harness LIVE: listo.
- Proyecto Supabase conectado en la sesión actual: pendiente.
- Migración `20260916065500_guardian_community_profile_v1.sql`: debe estar aplicada antes de ejecutar el smoke LIVE.

## Workflow

`.github/workflows/guardian-community-live-verification.yml`

Es **manual solamente** (`workflow_dispatch`). No corre en cada push, PR ni cron para evitar generar recibos de test continuamente.

## Secrets requeridos

Configurar como GitHub Actions secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `KELO_GUARDIAN_TEST_ADMIN_EMAIL`
- `KELO_GUARDIAN_TEST_ADMIN_PASSWORD`
- `KELO_GUARDIAN_TEST_DONOR_EMAIL`
- `KELO_GUARDIAN_TEST_DONOR_PASSWORD`

Las dos cuentas deben ser cuentas dedicadas a QA y distintas entre sí. La cuenta `TEST_ADMIN` debe tener permiso para iniciar un Guardian Master lease (por ejemplo rol admin o permiso equivalente del sistema existente). Ninguna debe ser una cuenta real de jugador.

## Flujo que prueba

1. inicia sesión con las dos cuentas mediante `/auth/v1/token?grant_type=password` usando únicamente la publishable key;
2. lee el baseline de `guardian_community_profile()` para ambas cuentas;
3. registra dos nodos Guardian con GPU asset donation habilitada;
4. la cuenta test-admin inicia el Master lease;
5. renueva heartbeat inmediatamente antes del quorum;
6. la primera cuenta atestigua un hash único y debe quedar `verified=false`;
7. la segunda cuenta atestigua el mismo `jobId + assetHash + preset + epoch` y debe crear quorum;
8. `guardian_community_asset_status()` debe devolver el asset sellado;
9. ambos perfiles deben aumentar exactamente +1;
10. repetir la misma atestación no puede volver a incrementar el perfil;
11. una segunda sesión nueva de la cuenta admin debe recuperar el mismo perfil cross-device;
12. el harness detiene el Master lease y elimina los nodos Guardian temporales en `finally`.

Los recibos persistentes permanecen únicamente en las cuentas QA dedicadas. Cada ejecución usa un hash nuevo, por lo que su historial de test crecerá sin contaminar perfiles reales.

## Seguridad

- Prohibido `service_role` / secret API key en el harness.
- Solo publishable key + JWT de cada usuario autenticado.
- No se imprimen contraseñas ni access tokens.
- No se crean usuarios automáticamente; las cuentas QA deben existir previamente.
- El test usa RPC públicos existentes y por tanto atraviesa las mismas comprobaciones `auth.uid()`, ownership del Guardian node, heartbeat, GPU role, Master epoch y quorum que un cliente real.
- El harness no despliega migraciones por sí mismo. El despliegue de schema sigue siendo una operación separada y auditable.

## Gate estático

`scripts/guardian-community-live-harness-audit.mjs` se ejecuta dentro de Main Stability y bloquea cambios que:

- introduzcan `service_role`/secret keys;
- hagan el workflow automático;
- eliminen la necesidad de dos cuentas distintas;
- quiten comprobaciones de replay o cross-device;
- dejen de limpiar los Guardian nodes efímeros.

## Procedimiento cuando Supabase esté conectado

1. comprobar proyecto y migraciones;
2. aplicar la migración si falta;
3. ejecutar Security Advisor y Performance Advisor;
4. confirmar que las dos cuentas QA existen y que la test-admin puede iniciar Master;
5. configurar los seis GitHub Actions secrets;
6. ejecutar **Guardian Community Live Verification** manualmente;
7. aceptar el despliegue solo si devuelve `GUARDIAN_COMMUNITY_LIVE_SMOKE_OK`.

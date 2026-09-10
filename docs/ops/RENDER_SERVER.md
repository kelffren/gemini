# Kelo World — Render Server Operations

## Propósito

Este documento describe cómo se despliega el owner autoritativo existente de Kelo World (`server/*`) en Render. No crea un segundo servidor ni cambia la autoridad gameplay.

## Arquitectura

```text
GitHub Pages / cliente
  -> WSS Render (`server/*`)
       -> autoridad PvP, movimiento, daño, cooldowns, economía/progreso online donde aplique
       -> Supabase para identidad y persistencia confiable
```

Supabase no sustituye el fixed-step WebSocket. Render no sustituye los owners de dominio en `server/*`; solo ejecuta el proceso Node.

## Fuente de verdad de infraestructura

- Blueprint: `/render.yaml`
- Código ejecutado: `/server`
- Config endpoint cliente: `/src/config/online-runtime-config.js`
- Branch de producción: `main`
- Región inicial: `virginia`
- Runtime fijado: Node `24.20.0`
- WebSocket package fijado en `server/package.json`
- Auto deploy deseado: sí, desde `main`
- Health: `/healthz`
- Readiness: `/readyz`

## Cliente online por defecto

En HTTPS no-local, `src/config/online-runtime-config.js` prepara el endpoint:

```text
wss://kelo-world-server.onrender.com
```

`engine-net.js` sigue siendo el único transporte. La config no abre sockets ni posee gameplay.

Overrides de QA:

- `?net=wss://otro-endpoint` sobrescribe el default.
- `?offline=1` evita insertar el endpoint y deja el fallback local.
- localhost/127.0.0.1 no fuerzan producción automáticamente.

No guardar tokens, claves o secretos en esta config.

## Comandos

Con `rootDir: server`:

```text
build: npm install --omit=dev
start: npm start
test: npm run test:smoke
```

El server escucha `process.env.PORT`, que Render inyecta automáticamente.

## Health, readiness y lifecycle

El mismo proceso HTTP que recibe upgrades WebSocket responde:

- `GET /healthz` -> proceso vivo, métricas operativas mínimas y audit de owners.
- `GET /readyz` -> `200` mientras acepta tráfico; `503` durante shutdown.

No existe un segundo servidor para health.

Protecciones runtime:

- WebSocket `maxPayload = 64 KiB`.
- `perMessageDeflate` desactivado para evitar costo/abuso innecesario en mensajes pequeños de gameplay.
- ping/pong cada 30 s para limpiar conexiones muertas.
- `SIGTERM`/`SIGINT`: detiene simulation/heartbeat, cierra clientes con código 1012 y cierra HTTP/WebSocket limpiamente.

`server/smoke-test.js` levanta el proceso real, prueba `/readyz`, handshake WebSocket, `hello` y shutdown por `SIGTERM`.

## Variables de entorno

No guardar secretos en GitHub.

Variables no secretas:

- `NODE_ENV=production`
- `KELO_REQUIRE_AUTH=0` durante transición controlada; cambiar a `1` cuando Auth/character selection estén validados end-to-end.
- `KELO_TITLES_SUPABASE=0` hasta validar persistencia de títulos en producción.

Secretas / configuradas en Render:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferida)

Compatibilidad temporal:

- `SUPABASE_SERVICE_ROLE_KEY`

Nunca exponer `SUPABASE_SECRET_KEY` ni service-role en Pages, localStorage, logs o commits.

## Fases de activación

### Fase A — Server online / transición

El proceso puede arrancar sin Supabase secrets. `server/online-identity-store.js` permanece en modo legacy-transition y el gameplay WebSocket se puede probar sin convertir el navegador en autoridad.

### Fase B — Persistencia conectada

Añadir `SUPABASE_URL` + `SUPABASE_SECRET_KEY` en Render. Verificar logs, identity audit y operaciones persistentes antes de exigir autenticación.

### Fase C — Auth obligatoria

Solo después de validar login, access token y ownership de character de extremo a extremo, cambiar `KELO_REQUIRE_AUTH=1`.

## Operación y rollback

- Cada push a `main` debe desplegar automáticamente cuando la integración GitHub de Render esté autorizada.
- Mientras el webhook no esté autorizado, el deploy se dispara explícitamente por la API de Render después de un merge validado.
- No desplegar una rama experimental como producción permanente.
- Si un deploy falla, revisar build/runtime logs antes de reintentar.
- Para rollback, redeploy de un commit/deploy previamente validado; no parchear producción con código fuera de Git.
- Antes de escalar, observar CPU, memoria, conexiones y latencia.

## Límites actuales conocidos

- Plan Free puede dormir cuando no hay tráfico; es adecuado para desarrollo/pruebas, no para PvP competitivo continuo.
- El server actual usa un único proceso/room con `MAX=32`; sharding/rooms múltiples se agregan detrás del mismo owner cuando una métrica real lo exija.
- Persistencia Supabase se activa gradualmente; no crear una segunda DB o un segundo multiplayer server para saltarse esta transición.
- Online por defecto ya apunta al servidor Render, pero Auth/persistencia valiosa continúan en transición hasta instalar y verificar secrets Supabase.

## Definition of Done de infraestructura

- Render Web Service desplegado desde `main`.
- Puerto detectado y proceso estable.
- Conexión WSS comprobada.
- `/readyz` verde.
- Logs sin crash loop.
- Cliente production HTTPS usa WSS por defecto con overrides QA preservados.
- Smoke test lifecycle verde.
- Secretos solo en Render.
- Supabase conectado antes de habilitar `KELO_REQUIRE_AUTH=1`.
- Cambios futuros reproducibles desde Git + `render.yaml`.

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
- Branch de producción: `main`
- Región inicial: `virginia`
- Runtime fijado: Node `24.20.0`
- WebSocket package fijado en `server/package.json`
- Auto deploy: sí, desde `main`

## Comandos

Con `rootDir: server`:

```text
build: npm install --omit=dev
start: npm start
```

El server escucha `process.env.PORT`, que Render inyecta automáticamente.

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

- Cada push a `main` despliega automáticamente.
- No desplegar una rama experimental como producción permanente.
- Si un deploy falla, revisar build/runtime logs antes de reintentar.
- Para rollback, redeploy de un commit/deploy previamente validado; no parchear producción con código fuera de Git.
- Antes de escalar, observar CPU, memoria, conexiones y latencia.

## Límites actuales conocidos

- Plan Free puede dormir cuando no hay tráfico; es adecuado para desarrollo/pruebas, no para PvP competitivo continuo.
- El server actual usa un único proceso/room con `MAX=32`; sharding/rooms múltiples se agregan detrás del mismo owner cuando una métrica real lo exija.
- Persistencia Supabase se activa gradualmente; no crear una segunda DB o un segundo multiplayer server para saltarse esta transición.
- Render detecta el puerto del WebSocket y reinicia el proceso cuando corresponde. Un endpoint HTTP dedicado de health/readiness queda como mejora operativa pendiente; no duplicar el servidor para añadirlo.

## Definition of Done de infraestructura

- Render Web Service desplegado desde `main`.
- Puerto detectado y proceso estable.
- Conexión WSS comprobada.
- Logs sin crash loop.
- Auto deploy activo.
- Secretos solo en Render.
- Supabase conectado antes de habilitar `KELO_REQUIRE_AUTH=1`.
- Cambios futuros reproducibles desde Git + `render.yaml`.

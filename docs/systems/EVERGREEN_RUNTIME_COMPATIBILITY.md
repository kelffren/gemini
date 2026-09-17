# Evergreen Runtime Compatibility

## Propósito

Mantener Kelo World ejecutable durante cambios de navegador, Web APIs, Node y proveedores externos sin acoplar gameplay a marcas/versiones concretas. Esta capa convierte compatibilidad en contratos medibles: detectar capacidades, degradar de forma explícita, probar WebKit/iPhone y probar el siguiente Node antes de promoverlo.

## Owner

**Kelo Evergreen Runtime Compatibility**.

Fuentes principales:

- `src/core/evergreen-runtime-capabilities.mjs`
- `src/core/evergreen-provider-adapters.mjs`
- `config/evergreen-runtime-policy.json`
- `scripts/evergreen-runtime-audit.mjs`
- `.github/workflows/evergreen-runtime-compat.yml`
- `playwright.evergreen.config.js`
- `tests/evergreen-runtime-compat.spec.js`

## Estado que posee

No posee estado gameplay ni persistencia durable. Solo posee definiciones/contratos inmutables y, cuando se instancia un registry de providers, registrations en memoria del composition root.

## Estado que NO posee

- posición, combate, economía, inventario o identidad;
- conexiones WebSocket activas;
- datos de Supabase/Render/Hugging Face/BrowserStack;
- secretos o credenciales;
- decisiones de calidad gráfica del Performance Governor;
- boot principal del juego.

## API

### Runtime capabilities

- `RUNTIME_CAPABILITY_SPECS`
- `detectRuntimeCapabilities(env)`
- `createRuntimeCompatibilityPlan(snapshot)`
- `assertCoreRuntimeCompatible(snapshot)`

Cada capability tiene `id`, `tier`, resultado `supported` y fallback cuando es opcional.

Tiers:

- `core`: si falta, el runtime se clasifica `unsupported`;
- `online`: si falta, el core puede seguir vivo pero el online entra en degradación controlada;
- `enhancement`: nunca puede derribar el core; debe declarar fallback.

### Provider adapters

- `EVERGREEN_PROVIDER_PORTS`
- `createProviderAdapterRegistry()`

Puertos v1:

- `realtime`: `connect`, `disconnect`, `send`, `subscribe`;
- `storage`: `get`, `set`, `delete`;
- `ai`: `generate`;
- `analytics`: `track`;
- `assetDelivery`: `resolve`.

Los providers se registran por `kind`, `id`, `priority`, `contractVersion`, `isAvailable` y `create`. El registry elige el primer provider disponible por prioridad y rechaza adapters que no implementen el contrato completo.

## Flujo

1. CI/runtime obtiene un snapshot de capabilities.
2. El planner clasifica el entorno como `full`, `degraded`, `degraded-online` o `unsupported`.
3. Las APIs opcionales ausentes producen un fallback explícito.
4. Los sistemas que necesiten un servicio externo consumen un puerto estable, no el SDK del vendor.
5. CI prueba los contratos en Node 24, WebKit móvil y Node 26 advisory.

## Dependencias

Runtime primitives: ninguna dependencia externa.

QA: usa el Playwright ya existente en el repo. No introduce framework runtime nuevo.

## Eventos

Ninguno en v1. El sistema es deliberadamente puro. Si más adelante se publican cambios de capability, deben salir por el Event Bus existente; no crear otro bus.

## Authority local vs online

Esta capa no es autoridad de gameplay. Puede informar si existe transporte online y seleccionar un adapter, pero la autoridad sigue perteneciendo al owner del dominio/server correspondiente.

## Persistencia

Ninguna. Los snapshots se regeneran al iniciar/probar. No persistir detecciones de navegador como verdad futura.

## Invariantes

1. **Feature detection > browser detection.** No usar `navigator.userAgent`, browser name o browser version para decidir disponibilidad de una feature.
2. Toda API `enhancement` tiene fallback explícito.
3. Producción permanece en Node 24 LTS hasta una promoción intencional.
4. Node 26 se prueba como advisory; una prueba verde no cambia automáticamente producción.
5. Ningún provider externo entra directamente a un dominio cuando existe un port/adapter.
6. Ningún adapter puede recibir secretos desde código cliente committed.
7. WebKit móvil es gate bloqueante para esta superficie.
8. BrowserStack sigue siendo la validación física Safari/iPhone cuando se ejecute el flujo real-device.

## Extension points

### Añadir una Web API

1. Añadir capability descriptor.
2. Clasificar tier.
3. Si no es `core`, declarar fallback.
4. Actualizar `config/evergreen-runtime-policy.json` cuando cambie el contrato.
5. Añadir prueba determinista y WebKit si la API es browser-specific.

### Añadir un provider

Registrar una implementación contra un port existente. No modificar consumidores para conocer el vendor.

Si ningún port representa correctamente la capacidad, crear un contrato versionado nuevo y documentar migración/compatibilidad antes de añadirlo.

## Ejemplos de reutilización

- Si `OffscreenCanvas` no existe, Asset/Render work puede seguir por canvas principal con budgets.
- Si `CompressionStream` no existe, usar compresión de build/server o payload sin stream local.
- Si el provider primario de storage no está disponible, el composition root puede seleccionar otro adapter con el mismo contrato.
- Si Node 26 rompe un script, el advisory avisa antes de que Node 26 sea runtime de producción.

## Anti-patrones

- `if (navigator.userAgent.includes('Safari')) ...` para activar/desactivar features.
- importar un SDK de vendor dentro de Inventory/Combat/Economy.
- asumir que una API Web existe porque el navegador "debería" soportarla.
- convertir Node 26 advisory en production simplemente porque el job pasa.
- esconder una ausencia de API sin fallback visible/medible.

## Legacy / adapters

El código legacy puede continuar mientras se migra. Las nuevas dependencias de APIs Web deben entrar por el capability contract; las nuevas dependencias de vendors deben entrar por ports/adapters. No se exige reescribir legacy de una vez.

## Tests / CI

- `node scripts/evergreen-runtime-audit.mjs`
- ESLint Evergreen
- `tsc -p jsconfig.evergreen.json`
- `npx playwright test --config=playwright.evergreen.config.js`
- `.github/workflows/evergreen-runtime-compat.yml`
- Main Stability Gate global antes de merge

La suite WebKit usa viewport 393×852, touch/mobile y carga los módulos reales sobre un fixture mínimo. BrowserStack conserva el perfil físico Safari/iPhone independiente.

## Observabilidad

El audit imprime número de checks pass/fail. Playwright publica artifact JSON de la corrida WebKit. Future Node es advisory y visible en Actions incluso cuando no bloquea merge.

## Deuda conocida

- Migrar consumidores browser-specific existentes gradualmente hacia feature detection.
- Registrar implementaciones reales de ports cuando cada provider se migre; v1 define el contrato, no reemplaza proveedores actuales de golpe.
- Añadir historial de compatibilidad por release si los artifacts empiezan a ser necesarios para análisis longitudinal.

## Checklist de extensión

- [ ] ¿La decisión depende de una capacidad real y no del nombre del navegador?
- [ ] ¿Existe fallback si la capability no es core?
- [ ] ¿La feature pasa WebKit móvil?
- [ ] ¿El provider está detrás de un port estable?
- [ ] ¿No se añadieron secretos al cliente/repo?
- [ ] ¿Node de producción sigue explícito?
- [ ] ¿La futura versión de Node se prueba sin promoverse sola?
- [ ] ¿Audit, lint, type-check y gates globales pasan?

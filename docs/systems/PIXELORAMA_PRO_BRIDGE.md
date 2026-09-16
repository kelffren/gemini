# Kelo World — Pixelorama Pro Bridge

## Propósito
Pixelorama Pro Bridge es una extensión **opcional, lazy y fail-open** de Asset Forge que permite enviar el trabajo actual a una instancia externa de Pixelorama Web o a una integración compatible, sin convertir al runtime local en un fork ni en un editor duplicado.

El objetivo es simple: **Kelo conserva su Asset Forge mobile-first como editor rápido**, y quien necesite un editor de pixel art más profundo puede saltar a Pixelorama sin que Kelo tenga que reconstruir de golpe capas, timeline, onion skin, selecciones complejas, indexed palettes y todos los demás subsistemas de un editor profesional.

## Owner
- **Owner:** Kelo Asset Forge / Pixelorama bridge.
- **Bridge:** `src/creators/ui/pixelorama-pro-bridge.mjs`.
- **Host:** `src/creators/ui/asset-forge-workspace.mjs`.

Pixelorama sigue siendo un producto/proyecto externo. Kelo sólo posee el adapter y la configuración que decide cómo abrirlo.

## Estado
Activo como **bridge opcional V1**. No es requisito para dibujar, guardar, auto-reparar ni exportar en Kelo.

El bridge aparece en Asset Forge como `OPEN PRO EDITOR` cuando puede montarse. Si la configuración externa falta o el popup es bloqueado, el editor local continúa funcionando.

## Contrato actual
`pixelorama-pro-bridge.mjs` exporta helpers puros para:
- normalizar la URL externa;
- decidir si el bridge está configurado;
- construir una URL segura con parámetros de retorno no sensibles;
- construir la metadata de handoff;
- montar/desmontar el botón lazy sobre Asset Forge.

No existe envío automático de credenciales, tokens ni secretos.

## Seguridad
1. La URL externa debe ser `http:` o `https:`; esquemas arbitrarios se rechazan.
2. El bridge abre una pestaña separada con `noopener,noreferrer`.
3. Nunca inserta secrets del juego en query params.
4. No se considera online authority ni marketplace authority.
5. Si Pixelorama o el host remoto falla, Asset Forge local sigue disponible.

## Configuración
La URL puede venir de una configuración explícita suministrada al mount o de una variable pública compatible del cliente. Una URL de editor remoto no debe contener credenciales.

Ejemplo conceptual de handoff:

```text
Asset Forge local
  → OPEN PRO EDITOR
  → Pixelorama Web externo
  → edición profesional
  → export PNG/sprite sheet
  → reimportar a Asset Forge
  → SELF CHECK / compile / metadata Kelo
```

## Lo que V1 NO hace
- No sincroniza binarios en tiempo real.
- No sube automáticamente el PNG a un servidor externo.
- No implementa OAuth.
- No reemplaza el manifest Kelo.
- No permite que un editor remoto publique al marketplace sin volver a pasar QA/authority.

## Evolución recomendada
### V2 — Handoff con paquete
- exportar PNG + manifest `kelo.asset.v1` como paquete descargable/compartible;
- detectar reimport y restaurar metadata de slot/directions/anchor;
- preservar hash de source para lineage.

### V3 — Adapter cooperativo
Sólo si el deployment de Pixelorama ofrece una API/postMessage estable:
- handshake de capacidades;
- transferencia explícita de raster/metadata;
- respuesta con PNG + frame metadata;
- validación de origen y versión;
- timeout/fallback local.

### V4 — Creator pipeline
- abrir una selección/frame concreto en editor externo;
- volver con el resultado;
- ejecutar `SELF CHECK` y Asset Space Compiler;
- versionar SOURCE/AUTHORING sin tocar runtime hasta promoción.

## Invariantes
- El pincel local de Asset Forge nunca depende del bridge.
- El bridge no puede saltarse QA.
- El bridge no puede cambiar gameplay authority.
- Toda comunicación futura debe ser explícita, origin-checked y sin secretos en URL.
- SOURCE importado de vuelta debe conservarse antes de cualquier optimización destructiva.

## Tests
`tests/pixelorama-pro-bridge.test.mjs` cubre normalización/filtrado básico de URLs y construcción de configuración segura.

# Instant Delivery Compiler — Weightless V5–V7

## Propósito

Reducir los bytes de entrega del juego sin destruir ni reemplazar los assets SOURCE. Esta capacidad pertenece al owner **Kelo Creator Asset Bridge** y reutiliza los optimizadores, quality gates, codec lab, provenance y Weightless QA existentes.

El objetivo no es “comprimir todo” a ciegas. El compilador genera representaciones DELIVERY explícitas y medibles y solo permite promoción después de las pruebas correspondientes.

## Owner y fuentes

- Owner: `Kelo Creator Asset Bridge`
- Core: `src/creators/assets/instant-delivery-compiler.mjs`
- CLI: `scripts/instant-delivery-compiler.mjs`
- Self-test: `scripts/instant-delivery-compiler-audit.mjs`
- Coverage audit: `scripts/instant-delivery-usage-audit.mjs`
- V7 exact PNG lab: `scripts/exact-alpha-trim-lab.mjs`
- Plan Plaza: `config/instant-delivery-plaza.json`
- Reutiliza: `png-space-optimizer.mjs`, `runtime-image-variants.mjs`, Weightless boot/transfer ratchets.

## Estado que posee

Ninguno en runtime. Es una capacidad build/publish-time.

Los outputs son blobs DELIVERY y reportes/manifest. SOURCE sigue siendo canónico y no se modifica.

## API

### `buildSparsePngAtlas(sourceBuffer, keepRects, options)`

Crea un PNG de **idénticas dimensiones lógicas** al source. Los rectángulos declarados se copian RGBA byte-a-byte; todo píxel fuera de cobertura se vuelve transparente. Después se ejecuta el optimizador lossless existente y se vuelve a decodificar para demostrar:

- mismas dimensiones;
- píxeles declarados idénticos;
- fuera de cobertura completamente transparente;
- hash y bytes del candidato.

Esta estrategia permite conservar `sourceRect` y coordenadas existentes cuando un atlas runtime solo necesita un subconjunto demostrado de frames.

### `buildExactPngLossless(sourceBuffer, options)`

Ruta V7 para assets completos. Mantiene el formato PNG, ancho, alto y **todo el RGBA decodificado byte por byte**, pero busca una codificación PNG lossless más pequeña usando el optimizador existente.

La promoción solo es elegible cuando:

- el DELIVERY no pesa más que SOURCE;
- las dimensiones son idénticas;
- el RGBA completo es idéntico;
- el blob se identifica por SHA-256;
- Asset Bit Ratchet y V2/V3 aceptan el reemplazo declarado.

No requiere device proof de cambio de codec porque el consumidor sigue recibiendo PNG y la representación visual completa es idéntica.

### `buildLosslessDeliveryCandidates(sourceBuffer, options)`

Delega en `runtime-image-variants.mjs` para hacer competir PNG lossless, WebP lossless y AVIF lossless. Expone el ganador del track lossless como candidato de laboratorio. **WebP/AVIF continúan bloqueados para runtime** hasta disponer del device proof real iOS Safari exigido por `delivery-device-proof.mjs`.

## Flujo

```text
SOURCE (intacto)
  -> plan explícito
  -> sparse exact PNG / exact full PNG / codec lab
  -> decode + proof
  -> content hash
  -> artifact CI + manifest
  -> consumer/device proof según el modo
  -> V2 + observed boot V3
  -> promoción separada al runtime
```

## Plaza

### `plazaNature` — V5 sparse exacto

`assets/Arboleskelo1.PNG` se mantiene como SOURCE. Runtime usa `assets/pn-233db909.png`, generado únicamente con los cinco frames demostrados por `plazaNatureProps`: `tree_large`, `tree_pink`, `tree_medium`, `tree_cypress`, `tree_small`.

Contrato promovido:

- DELIVERY: `assets/pn-233db909.png`
- bytes: `1,283,924`
- SHA-256: `233db909c040229470a2aea2bb98d29f9a79c45b89f3996df0799dd92afee8a1`
- coordenadas lógicas conservadas.

### `plazaFountainKelo` — V7 exact full PNG

SOURCE: `assets/justicia_fountain_v2.PNG`

DELIVERY promovido en la rama V7:

- `assets/pf-f5ba82df.png`
- `3,040,977 -> 2,329,441` bytes
- ahorro: `711,536` bytes (`23.398%`)
- dimensiones: `1254x1254 -> 1254x1254`
- SHA-256: `f5ba82df1680b758980489a56543d59311ca4c0a6a39d0899d8e434332beb239`
- RGBA completo: exacto.

### `plazaRoundTree` — V7 exact full PNG

SOURCE: `assets/world/imperial-plaza/arbol-redondo.png`

DELIVERY promovido en la rama V7:

- `assets/prt-fc9790cb.png`
- `2,114,475 -> 1,581,201` bytes
- ahorro: `533,274` bytes (`25.220%`)
- dimensiones: `1254x1254 -> 1254x1254`
- SHA-256: `fc9790cbc6e907d32ec1bfbdbb6a4220cb9c2099f35bc5cb83a35da81442479a`
- RGBA completo: exacto.

### Decisión crop vs full PNG

El laboratorio V7 midió también alpha trim. El crop de ambos assets juntos ahorraba únicamente **3,127 bytes adicionales** frente al full-size lossless. Ese beneficio no justificaba introducir remapeo geométrico, offsets ni cambios de `sourceRect`. V7 conserva por tanto toda la geometría original.

Ahorro combinado exact-full medido: `5,155,452 -> 3,910,642` bytes, es decir **1,244,810 bytes (`24.146%`)** antes de medir el efecto final de boot.

## Invariantes

1. SOURCE nunca se sobrescribe.
2. Un sparse atlas no puede cambiar dimensiones lógicas.
3. Cada píxel dentro de cobertura sparse debe ser RGBA idéntico.
4. `exact-png-lossless` debe conservar dimensiones y RGBA completo.
5. La cobertura sparse debe estar declarada, no inferida silenciosamente.
6. `instant-delivery-usage-audit` falla si el consumer auditado usa un frame fuera de cobertura.
7. Un codec lossy nunca se etiqueta como exacto.
8. WebP/AVIF no se promueven sin evidencia de dispositivo exigida por `runtime-image-variants`.
9. Toda sustitución SOURCE→DELIVERY debe estar declarada con path, bytes, hash y `exact:true`.
10. La reducción no permite aumentar el tráfico estable hasta `boot-ready`; V3 sigue siendo el juez runtime.
11. No se crea un segundo loader ni un segundo asset manager.

## Online-first

N/A para autoridad de gameplay. Estos blobs son presentación estática y se identifican por contenido. Un CDN/servidor futuro puede entregar el mismo hash sin cambiar IDs de gameplay, contratos de mundo ni autoridad.

## Persistencia y caché

Los nombres DELIVERY incluyen un prefijo del SHA-256 y el plan conserva el hash completo. Eso permite caché inmutable/content-addressed y actualización delta sin invalidar assets que no cambiaron.

## Observabilidad

Los reportes exponen por asset:

- bytes SOURCE;
- bytes DELIVERY;
- bytes/porcentaje ahorrados;
- SHA-256 SOURCE/DELIVERY;
- dimensiones;
- prueba de exactitud;
- requisitos pendientes de promoción.

## Tests / CI

- `node scripts/instant-delivery-compiler-audit.mjs` cubre sparse y exact full PNG.
- `node scripts/instant-delivery-usage-audit.mjs` cubre consumo sparse.
- `scripts/exact-alpha-trim-lab.mjs` reconstruye y verifica los DELIVERY exact-full de fuente y árbol redondo.
- `.github/workflows/weightless-v7-exact-trim-lab.yml` verifica hashes/tamaños antes de publicar blobs en la rama V7.
- job `instant-delivery-lab` dentro de `Kelo Weightless Stack` conserva el laboratorio general.
- `observed-boot-transfer` es obligatorio cuando un candidato se conecta al runtime.
- Playwright iPhone 390x844 + smoke móvil/PvP sigue siendo obligatorio para la promoción runtime.

## Extensión

Para añadir otro asset:

1. Añadirlo al plan con modo explícito.
2. Preferir `exact-png-lossless` cuando una recompresión completa ofrece ahorro suficiente.
3. Usar sparse solo cuando existe cobertura consumer demostrable y el ahorro adicional justifica la especialización.
4. Mantener WebP/AVIF en laboratorio hasta device proof real iOS Safari.
5. Ejecutar CI y medir V2/V3 antes de promoción.

## Antipatrones

- sustituir o borrar el SOURCE;
- recortar geometría por unos pocos KB si una recompresión full-size entrega casi el mismo ahorro;
- borrar frames “porque parecen no usados” sin consumer audit;
- declarar un DELIVERY exacto sin hash/bytes/proof;
- introducir KTX2/Basis mientras Canvas2D siga siendo el consumidor autoritativo;
- saltarse Atlas Contract con `new Image()` en consumers.

## Siguientes pasos

- Validar V7 con Asset Bit Ratchet, V2, V3 y Main Stability sobre los bytes exactos del PR.
- Mantener V7 solo si el payload estable observado cae sin regresiones visuales/móviles.
- Ejecutar device proof real iOS Safari antes de cualquier futura promoción WebP/AVIF.

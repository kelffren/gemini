# Instant Delivery Compiler — Weightless V5

## Propósito

Reducir los bytes de entrega del juego sin destruir ni reemplazar los assets SOURCE. Esta capacidad pertenece al owner **Kelo Creator Asset Bridge** y reutiliza los optimizadores, quality gates, codec lab, provenance y Weightless QA existentes.

El objetivo no es “comprimir todo” a ciegas. El compilador genera representaciones DELIVERY explícitas y medibles para una cobertura runtime declarada, y solo permite promoción después de las pruebas correspondientes.

## Owner y fuentes

- Owner: `Kelo Creator Asset Bridge`
- Core: `src/creators/assets/instant-delivery-compiler.mjs`
- CLI: `scripts/instant-delivery-compiler.mjs`
- Self-test: `scripts/instant-delivery-compiler-audit.mjs`
- Coverage audit: `scripts/instant-delivery-usage-audit.mjs`
- Primer plan: `config/instant-delivery-plaza.json`
- Reutiliza: `png-space-optimizer.mjs`, `runtime-image-variants.mjs`, Weightless boot/transfer ratchets.

## Estado que posee

Ninguno en runtime. Es una capacidad build/publish-time.

Los únicos outputs que posee son archivos generados en el directorio de trabajo del compilador: blobs DELIVERY y `manifest.json`. SOURCE sigue siendo canónico y no se modifica.

## API

### `buildSparsePngAtlas(sourceBuffer, keepRects, options)`

Crea un PNG de **idénticas dimensiones lógicas** al source. Los rectángulos declarados se copian RGBA byte-a-byte; todo píxel fuera de cobertura se vuelve transparente. Después se ejecuta el optimizador lossless existente y se vuelve a decodificar para demostrar:

- mismas dimensiones;
- píxeles declarados idénticos;
- fuera de cobertura completamente transparente;
- hash y bytes del candidato.

Esta estrategia permite conservar `sourceRect` y coordenadas existentes cuando un atlas runtime solo necesita un subconjunto demostrado de frames.

### `buildLosslessDeliveryCandidates(sourceBuffer, options)`

Delega en `runtime-image-variants.mjs` para hacer competir PNG lossless, WebP lossless y AVIF lossless. Expone únicamente el ganador del track lossless para una eventual promoción exacta. WebP/AVIF siguen sujetos a device proof antes de convertirse en runtime-live.

## Flujo

```text
SOURCE (intacto)
  -> plan explícito de cobertura
  -> sparse exact PNG y/o codec tournament
  -> decode + proof
  -> content hash
  -> artifact CI + manifest
  -> consumer/device proof
  -> observed boot-transfer ratchet
  -> promoción separada al runtime
```

## Plaza V1

El primer plan cubre:

- `plazaNature` / `assets/Arboleskelo1.PNG`: sparse-atlas exacto con los cinco frames que `plazaNatureProps` usa en el runtime central (`tree_large`, `tree_pink`, `tree_medium`, `tree_cypress`, `tree_small`). El asset original conserva todos sus frames para authoring/Studio.
- `plazaFountainKelo`, `plazaRoundTree`, `forestPlazaV2`, `cesped`: torneo lossless PNG/WebP/AVIF. Son candidatos; no se promueven automáticamente.

### Promoción verificada de `plazaNature`

El runtime usa `assets/pn-233db909.png`, generado exclusivamente desde el SOURCE canónico. La promoción se acepta únicamente con SHA-256 completo `233db909c040229470a2aea2bb98d29f9a79c45b89f3996df0799dd92afee8a1`, tamaño exacto `1,283,924` bytes y coverage audit verde. El SOURCE `assets/Arboleskelo1.PNG` permanece intacto y continúa declarado en `config/instant-delivery-plaza.json`, pero su ruta no forma parte de la metadata JS de boot.

La promoción CI es idempotente: reconstruye desde SOURCE, verifica hash/tamaño, actualiza la ruta runtime, separa la metadata SOURCE del cierre de boot y no crea otro loader.

## Invariantes

1. SOURCE nunca se sobrescribe.
2. Un sparse atlas no puede cambiar dimensiones lógicas.
3. Cada píxel dentro de cobertura debe ser RGBA idéntico.
4. La cobertura debe estar declarada, no inferida silenciosamente.
5. `instant-delivery-usage-audit` falla si el consumer auditado usa un frame fuera de cobertura.
6. Un codec lossy nunca se etiqueta como exacto.
7. WebP/AVIF no se promueven sin evidencia de dispositivo exigida por `runtime-image-variants`.
8. La reducción de archivos no permite aumentar el tráfico estable hasta `boot-ready`; V3 sigue siendo el juez runtime.
9. No se crea un segundo loader ni un segundo asset manager.

## Online-first

N/A para autoridad de gameplay. Estos blobs son presentación estática y se identifican por contenido. Un CDN/servidor futuro puede entregar el mismo hash sin cambiar IDs de gameplay, contratos de mundo ni autoridad.

## Persistencia y caché

Los nombres generados incluyen hash SHA-256 truncado y el manifest conserva hashes completos. Eso permite una promoción posterior con caché inmutable/content-addressed y actualización delta sin invalidar assets que no cambiaron.

## Observabilidad

El manifest reporta por asset:

- bytes SOURCE;
- bytes DELIVERY;
- bytes/porcentaje ahorrados;
- hashes;
- formato ganador;
- prueba de exactitud;
- requisitos pendientes de promoción.

CI publica además el ahorro agregado en GitHub Step Summary y guarda blobs/reportes como artifact.

## Tests / CI

- `node scripts/instant-delivery-compiler-audit.mjs`
- `node scripts/instant-delivery-usage-audit.mjs`
- job `instant-delivery-lab` dentro de `Kelo Weightless Stack`
- workflow `Kelo Instant Delivery Promotion` reconstruye/verifica el blob promovido dentro de GitHub, evitando transporte binario externo.
- `observed-boot-transfer` sigue siendo obligatorio cuando un candidato se conecta al runtime.
- Playwright iPhone 390x844 + walk sostenido sigue siendo obligatorio para la promoción runtime.

## Extensión

Para añadir otro asset:

1. Añadirlo al plan con modo explícito.
2. Si es sparse, declarar rects y consumer audit demostrable.
3. Ejecutar CI.
4. Comparar candidate bytes y decode/quality evidence.
5. Promover en un pass separado únicamente si los gates aplicables pasan.

## Antipatrones

- sustituir el SOURCE por el candidato;
- borrar frames “porque parecen no usados” sin consumer audit;
- cargar un atlas completo para renderizar un subconjunto conocido si existe una variante DELIVERY demostrada;
- introducir KTX2/Basis mientras Canvas2D siga siendo el consumidor autoritativo;
- saltarse Atlas Contract con `new Image()` en consumers.

## Deuda / siguientes pasos

- Medir la promoción de `plazaNature` con V2 + V3 sobre los bytes promovidos exactos y mantenerla solo si ambos ratchets pasan.
- Ejecutar device proof real iOS Safari antes de promover WebP/AVIF de fuente/árbol redondo.
- Extender el mismo modelo a packs por distrito/viewport cuando sus consumidores puedan declarar cobertura estable.
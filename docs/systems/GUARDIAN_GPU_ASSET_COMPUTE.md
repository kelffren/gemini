# Kelo World — Guardian GPU Asset Compute V1

## Propósito

Guardian GPU Asset Compute extiende el owner existente `KeloGuardian`; **no crea una segunda red ni un segundo engine**. Un jugador puede activar voluntariamente **Donar GPU para crear assets** y ofrecer una fracción de la capacidad WebGPU disponible de su dispositivo mientras Kelo World está visible.

El objetivo de V1 es que la comunidad pueda aportar cómputo para producir **candidatos de assets procedurales** y que el panel Guardian muestre cuántas personas están aportando y cuánta capacidad normalizada está conectada en ese momento.

## Invariantes

1. GPU donation es opt-in y viene apagada por defecto.
2. `KeloGuardian` sigue siendo owner de identidad de nodo, preferencias, heartbeat y data plane.
3. No se envía vendor/model de GPU al control plane.
4. `GPUu` es una unidad normalizada `0..100` por dispositivo antes del porcentaje de donación; **no representa TFLOPS**.
5. La capacidad anunciada sirve para scheduling/UI; no es prueba de trabajo ni genera KC.
6. Un peer nunca puede enviar WGSL arbitrario. El worker solo ejecuta presets compilados dentro del código de Kelo World.
7. Todo output GPU es un **candidato**, nunca un asset publicado. Debe pasar Asset Forge/QA.
8. PvP, inventario, economía, HP y progresión siguen fuera de esta capa.
9. No hay segundo `setInterval` ni segundo simulation loop.
10. Si el navegador pasa a background o pierde heartbeat, deja de contar como donante activo.

## Archivos

- `src/systems/guardian-system.js` — preferencia `allowGpuAssets`, `gpuSharePct`, detección WebGPU y anuncio de capacidad.
- `src/systems/guardian-asset-gpu-worker.mjs` — worker WebGPU seguro, validación SHA-256 y quorum de candidatos.
- `src/ui/guardian-ui.js` — opt-in, slider, barra comunitaria, donantes activos, GPUu y prueba de candidato.
- `server/guardian-coordinator.js` — sanitización, agregación, rol `asset-gpu-worker`, scheduling y proof type server-only.
- `supabase/migrations/20260916053000_guardian_gpu_asset_capacity_v3.sql` — rol y agregados del control plane primario Supabase.
- `scripts/guardian-system-audit.mjs` — invariantes V3.

## Capability contract

El cliente anuncia solo datos acotados:

```text
webgpu: boolean
gpuTier: none | unavailable | detecting | low | medium | high
gpuCapacityUnits: 0..100
gpuProbeReady: boolean
```

`gpuCapacityUnits` se deriva de límites WebGPU normalizados. No se consulta `adapter.info` y no se envía nombre, fabricante, device ID ni driver.

Preferencias nuevas:

```text
allowGpuAssets: boolean   // default false
gpuSharePct: 10..100      // default 25
```

Capacidad efectiva usada en el agregado:

```text
effective GPUu = gpuCapacityUnits × gpuSharePct / 100
```

## Community meter

El response Guardian agrega solo nodos autenticados con heartbeat fresco y rol `asset-gpu-worker`:

```text
gpuAssetDonors
gpuCapacityUnits
gpuCapacityTargetUnits = 1000
gpuCapacityPct
gpuCapacityVerified = false
```

`gpuCapacityVerified=false` es deliberado: el número representa capacidad **conectada/anunciada saneada**, no un benchmark server-authoritative. No debe utilizarse para dinero, rank ni reward.

La UI muestra:

- donantes GPU activos;
- GPUu conectadas;
- barra hacia la meta de malla;
- porcentaje máximo configurado por el jugador;
- aporte efectivo estimado del dispositivo;
- estado WebGPU;
- indicador visual de que el jugador forma parte de Community Compute.

## Scheduler

Nuevo readiness role:

```text
asset-gpu-worker
```

Se concede únicamente cuando:

```text
allowGpuAssets=true
webgpu=true
gpuCapacityUnits>0
visibility=visible
```

Nuevo workload type server-side:

```text
asset-gpu-worker
```

Su score puede usar capacidad GPU normalizada y tier como señal de selección. Esto solo selecciona candidatos; no prueba que un nodo haya ejecutado trabajo correctamente.

## Worker seguro

V1 admite únicamente presets locales enumerados:

```text
material-noise-v1
aura-field-v1
terrain-speckle-v1
```

El mensaje P2P lleva `preset`, dimensiones acotadas, `seed`, `jobId`, `epoch` y deadline. El shader WGSL vive estáticamente en `guardian-asset-gpu-worker.mjs`.

Límites V1:

- mínimo `8×8`;
- máximo `64×64`;
- máximo 4096 píxeles;
- payload de resultado acotado para permanecer debajo del límite del DataChannel Guardian;
- solo foreground.

No existen `eval`, `new Function`, WGSL remoto, URLs ejecutables ni instrucciones entregadas por peers.

## Validación de resultados

Cada worker devuelve:

```text
jobId
preset
width/height
seed
epoch
SHA-256
RGBA base64
computeMs
```

El Master recalcula SHA-256 sobre los bytes recibidos antes de aceptar un resultado. Resultados duplicados del mismo nodo no cuentan dos veces.

Cuando hay capacidad suficiente, V1 intenta quorum de dos resultados con el mismo hash. Si el deadline llega con un único resultado válido, puede producir una vista previa marcada `verifiedByQuorum=false`; sigue siendo solo candidato y requiere Asset Forge QA.

Esto sigue la regla general de cómputo voluntario: **un host comunitario no es una autoridad de confianza**.

## Integración con Asset Forge

`KeloGuardianGpuAssets.requestProceduralAsset(...)` produce un `PNG Blob` candidato y emite:

```text
kelo:guardian-asset-candidate
```

El evento contiene:

```text
source: guardian-gpu-community
hash
preset
contributors[]
verifiedByQuorum
requiresAssetForgeQA: true
publishAuthority: false
```

V1 no inserta automáticamente el candidato en el catálogo ni lo publica. La siguiente capa puede consumir ese evento desde Asset Forge y aplicar el pipeline existente de compilación/QA/provenance.

## Proof y recompensas

El coordinator reconoce el proof type server-internal:

```text
asset_gpu_seconds
```

Pero `recordVerifiedContribution(...)` conserva:

```text
kcMinted = 0
```

El mero hecho de anunciar `gpuCapacityUnits` nunca genera proof. Un settlement futuro tendría que demostrar trabajo útil y pasar por la autoridad económica normal.

## iPhone / móvil

WebGPU se detecta en runtime. Guardian no promete trabajo continuo en background. Si iOS suspende la página, el heartbeat expira y el nodo deja de formar parte de la capacidad activa.

El porcentaje de GPU existe precisamente para que el jugador pueda contribuir sin entregar necesariamente toda la capacidad disponible.

## Seguridad Supabase

La migración V3 reutiliza `guardian_nodes.capabilities/preferences` JSONB y no crea una tabla pública nueva. Las tablas Guardian continúan con RLS y sin escritura directa; los clientes operan mediante los RPC existentes.

`kelo_private.guardian_response(...)` es `SECURITY DEFINER` con `search_path=''`, usa relaciones schema-qualified y solo retorna agregados más el nodo propio. La capacidad GPU agregada no incluye IDs de otros jugadores.

## QA

Gate estático/determinista:

```bash
npm run audit:guardian
npm run audit:docs
```

Además del gate general del repositorio, cualquier claim de funcionamiento móvil real debe pasar el Playwright iPhone 390×844 exigido por Foundation.

## Estado

**V1 implementado en código:** opt-in, capability probe, worker WebGPU de presets seguros, SHA-256, quorum, scheduler/fallback Node, agregado Supabase y UI comunitaria.

**No implementado todavía:** modelos generativos grandes distribuidos, entrenamiento comunitario, rewards económicos, arbitrary compute, ejecución confiable en background o publicación automática de resultados.

# Kelo Sprite AI Service

## Propósito

`Kelo Sprite AI Service` es la frontera única de inferencia remota para Sprite Factory. Su trabajo es recibir una solicitud autenticada de authoring, elegir un proveedor de generación, devolver un **atlas candidato** y dejar la validación determinista al pipeline existente de Image Treatment + Sprite Compiler + Frame Doctor.

No reemplaza `Kelo Creators`, no reemplaza el compilador de sprites y no participa en gameplay.

## Owner y fuentes

- Owner server: `server/sprite-ai-service.js`.
- HTTP/auth/rate limit: `server/sprite-ai-http.js`.
- Bootstrap: `server/sprite-ai-bootstrap.js`.
- Hugging Face adapter: `server/sprite-ai-provider-huggingface.js`.
- UI consumer: `src/creators/ui/sprite-factory-online.mjs`.
- Compiler/QA: `src/creators/sprite-compiler/*`.
- Reference ZeroGPU Space: `deploy/huggingface-sprite-ai/`.

## Estado que posee

Posee solamente:

- selección/configuración del proveedor;
- conexión cacheada al Space Gradio cuando aplica;
- transformación del prompt y normalización de la respuesta.

No posee:

- assets publicados;
- avatar del jugador;
- estado gameplay;
- economía;
- inventario;
- persistencia de personajes;
- geometría final del sprite.

## API estable

### `GET /api/sprite-generate/status`

Devuelve estado del servicio, proveedor seleccionado, proveedores disponibles y si el fallback pagado está permitido.

### `POST /api/sprite-generate`

Requiere sesión Supabase no anónima. El body puede incluir:

- `action`;
- `directions`;
- `framesPerDirection`;
- `spriteSize`;
- `styleHint`;
- `prompt` / `characterPrompt`;
- `sourceImageDataUrl`;
- `seed`;
- `retryHint`.

El contrato de salida conserva `imageDataUrl`, `provider`, `sourceMode`, `layout` y `generatedAt` independientemente del proveedor.

## Flujo

```text
Sprite Factory (browser)
  -> POST /api/sprite-generate + Supabase token
    -> Kelo Sprite AI Service
      -> provider adapter
        -> Hugging Face ZeroGPU Space OR explicit OpenAI provider
      <- candidate atlas
    <- imageDataUrl + provider metadata
  -> Image Treatment
  -> grid detection
  -> Sprite Compiler
  -> Frame Doctor
  -> safe local geometry repairs
  -> QA
       PASS -> preview/export
       FAIL -> retryHint targeting bad frames
```

La IA nunca decide que un asset es válido. El compilador y los gates locales siguen siendo la autoridad técnica del authoring output.

## Provider selection

`KELO_SPRITE_AI_PROVIDER` acepta:

- `auto` — prefiere Hugging Face si `KELO_SPRITE_AI_HF_SPACE` está configurado; si no, puede usar OpenAI solamente cuando `OPENAI_API_KEY` existe;
- `huggingface`, `hf` o `zerogpu` — fuerza el Space gratuito/abierto;
- `openai` — fuerza el proveedor OpenAI configurado.

### Regla de coste

`KELO_SPRITE_AI_ALLOW_PAID_FALLBACK=0` es el default.

Si ZeroGPU falla, está en cola o agota su cuota, el servicio **no** debe generar gasto en otro proveedor silenciosamente. El fallback a OpenAI solo se habilita con aprobación explícita poniendo la variable en `1/true/on/yes`.

## Hugging Face / ZeroGPU

El adapter usa `@gradio/client` desde el servidor. Nunca se almacena `HF_TOKEN` en el navegador.

Variables:

```text
KELO_SPRITE_AI_HF_SPACE=<usuario>/<space>
KELO_SPRITE_AI_HF_API_NAME=/generate
HF_TOKEN=<opcional, server-only>
KELO_SPRITE_AI_TIMEOUT_MS=180000
```

El Space de referencia usa:

- `black-forest-labs/FLUX.2-klein-base-4B`;
- `Leon1000/pixel_spritesheet_4walk_small_lora_v1`;
- primer pass cardinal 4x4;
- segundo pass diagonal condicionado por referencia;
- composición final de filas `N, NE, E, SE, S, SW, W, NW`;
- salida 4x8 candidata que el compilador normaliza a frames 64x64.

## Limitaciones conocidas

El LoRA público fue entrenado principalmente para caminar en las cuatro direcciones cardinales. Las diagonales de este V1 son un pass condicionado adicional y deben considerarse **experimentales** hasta que el corpus de QA confirme identidad y movimiento suficientes.

ZeroGPU es infraestructura compartida con cuota diaria; sirve para desarrollo y authoring de bajo volumen, no como promesa de inferencia ilimitada en producción. La frontera server/provider existe precisamente para poder sustituir el compute sin rehacer la UI ni el compilador.

## Invariantes

1. No hay secretos de proveedor en GitHub Pages, JS de browser ni localStorage.
2. El browser solo conoce `/api/sprite-generate`.
3. Un output de modelo es siempre candidato, nunca asset aprobado.
4. Image Treatment + Sprite Compiler + Frame Doctor siguen corriendo para cada atlas.
5. No se crea un segundo runtime/editor/compilador.
6. No hay fallback pagado silencioso.
7. Auth, CORS y rate limit siguen en `sprite-ai-http.js`.
8. Cambiar de proveedor no obliga a cambiar Sprite Factory.

## Tests

`server/sprite-ai-smoke-test.js` cubre:

- selección ZeroGPU-first;
- contrato de salida 4x8;
- compatibilidad con OpenAI generation/edit;
- bloqueo del fallback pagado por defecto;
- auth obligatoria;
- rechazo de anonymous;
- CORS;
- rate limit.

La sintaxis/build del Space debe validarse antes del deploy. La inferencia ZeroGPU real no se considera LIVE hasta crear/configurar un Space real y ejecutar un atlas completo a través de Kelo Sprite Factory.

## Extensión

Para añadir otro proveedor:

1. implementar un adapter server-only que exponga `status()` y `generate()`;
2. registrarlo en `createSpriteAiService` sin cambiar el endpoint público;
3. conservar el formato de salida;
4. añadir smoke coverage;
5. mantener el compilador como gate final;
6. documentar coste/cuotas y política de fallback.

## Anti-patrones

- llamar directamente Hugging Face/OpenAI desde el browser;
- guardar tokens en cliente;
- confiar en que un prompt siempre produzca la grilla correcta;
- saltarse Frame Doctor porque el proveedor devolvió HTTP 200;
- regenerar todo el atlas cuando puede dirigirse un retry a frames defectuosos;
- activar un proveedor pagado como fallback sin aprobación explícita.

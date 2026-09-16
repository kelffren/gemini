# Kelo Studio — Scene Painter (Paint Copies)

## Estado

**Rama candidata:** `fix/paint-copies-scene-painter-20260916`  
**Estado de validación:** implementación + auditoría determinista preparadas; validación iPhone/Safari todavía obligatoria antes de declarar el bug cerrado.

## Owner

`src/studio/tools/paint-copies-tool.mjs` es el owner único de la capacidad **Paint Copies / Scene Painter**.

No es un editor paralelo ni un segundo sistema de placement. Reutiliza:

- `StudioKernel.selection` para obtener la plantilla.
- `StudioKernel.input` para tomar el gesto mientras la herramienta está activa.
- `createPlaceEntityCommand()` para cada entidad resuelta.
- `createCompositeCommand()` para convertir un gesto completo en **una sola acción de historial**.
- `Studio authority mirror` a través de los comandos normales ya serializados.
- `studio-overlay-renderer.mjs` únicamente para preview local cuando el overlay está disponible.

## Propósito

Permitir construir escenas repetitivas o decorativas complejas desde una selección existente sin colocar manualmente cada objeto.

Flujo:

1. Seleccionar un objeto o un grupo.
2. Abrir **SCENE PAINTER** desde la barra de edición.
3. Elegir patrón.
4. Ajustar parámetros.
5. Activar pintura y tocar/arrastrar sobre el mundo.
6. Cada gesto se confirma como un lote reversible.

## API pública

`createPaintCopiesTool(kernel)` devuelve una herramienta registrada como `paintCopies` con:

- `start(options)` — captura la selección actual como plantilla.
- `activate()` / `deactivate()` / `toggle()` — controla takeover de input.
- `configure(patch)` — cambia patrón y parámetros sin crear otro owner.
- `beginAt(x,y,options)` / `strokeTo(x,y,options)` — planifica preview local.
- `commit()` — convierte el preview en comandos de placement.
- `cancelStroke()` / `cancel()` — descarta trabajo local no confirmado.
- `state()` — estado serializable de UI/diagnóstico.
- `getPreviews()` — copia segura para consumidores externos.
- `getPreviewRefs()` — lectura zero-copy reservada al renderer hot path.
- `onChange(listener)` — señal de estado para UI.
- `destroy()` — desmontaje explícito de input, listeners, observers y UI.

## Patrones

### Trail

Mantiene el comportamiento histórico: interpola sellos a lo largo del movimiento del puntero usando spacing automático o manual.

### Grid

Crea una matriz centrada en el puntero. Límites actuales: 1–12 columnas y 1–12 filas. El paso nunca es menor que el footprint de la plantilla para evitar que el patrón colapse accidentalmente.

### Ring

Distribuye copias alrededor de un radio. Límites actuales: 3–64 sellos y radio 8–2048 px.

### Scatter

Distribuye copias dentro de un disco usando una semilla determinista. Límites actuales: 1–100 sellos y radio 8–2048 px. La misma semilla + mismo ancla produce las mismas posiciones.

## Invariantes

1. **Máximo 500 entidades de preview por gesto.** En selección múltiple el límite cuenta cada miembro del grupo.
2. Cada copia recibe un ID nuevo.
3. Se elimina `source.authorityPlacementId` al clonar para no reutilizar identidad autoritativa.
4. La geometría interna de una selección múltiple se conserva mediante offsets relativos al centro del grupo.
5. Un gesto confirmado incrementa History exactamente una vez, aunque cree cientos de entidades.
6. Un Undo elimina el gesto completo.
7. Preview y planificación son locales; la mutación persistente ocurre sólo mediante comandos Studio.
8. La herramienta no observa el árbol completo de `document.body`.

## Regresión histórica de DOM

La implementación anterior mantenía un `MutationObserver` sobre `document.body` con `subtree:true` y el callback podía volver a escribir UI de Paint Copies. Esa combinación amplificaba cualquier mutación del Studio y era una superficie de tormenta de mutaciones, especialmente costosa en móvil.

La implementación nueva usa dos scopes limitados:

- `bodyObserver`: `childList:true` **sin** `subtree`, sólo para detectar montaje/desmontaje directo de `#kelo-studio-live`.
- `shellObserver`: `subtree:true` únicamente mientras se espera que aparezca `.ks-ext-edit`; se desconecta inmediatamente al encontrar el mount point.

Al desmontar Studio se eliminan listeners, input registration, observers y UI del Scene Painter.

## Mobile-first

`register-build-tools-serial.mjs` consulta `KELO_WORLD_SURGERY` **antes de importar** cada herramienta. Si `paintCopies` está deshabilitado, el módulo Paint Copies ni siquiera se importa en la ola opcional del iPhone.

La UI del Scene Painter usa controles táctiles grandes y vive dentro del shell existente. No crea un canvas ni un loop de render nuevo.

En iPhone, donde el overlay puede estar deshabilitado por protección de rendimiento, el patrón sigue resolviéndose y confirmándose; el ghost visual depende de que exista el overlay de Studio.

## Online-first / autoridad futura

El cliente puede planificar Trail/Grid/Ring/Scatter localmente porque son herramientas de autoría. Al confirmar, el resultado se transforma en placements normales con IDs nuevos dentro de un `CompositeCommand`.

Para mover autoridad al servidor no hay que rediseñar los patrones: basta con que el transporte/authority layer acepte o valide los child commands serializados. El servidor puede aplicar límites de permisos, cuota, ownership y colisión antes de persistir.

## Tests

`npm run audit:studio:paint-copies` cubre:

- auto spacing;
- interpolación de Trail;
- IDs únicos;
- grupos con offsets internos;
- Grid 3×2;
- Ring;
- Scatter determinista por seed;
- un History action por gesto;
- Undo completo;
- guard explícito contra restaurar `document.body + subtree:true`.

Antes de promover a validado también se exige la puerta iPhone definida en `AGENTS.md`: arranque, canvas/mundo vivo, caminata sostenida 8 s, `page.evaluate` responsivo y sin crash/pantalla negra.

## Extensión

Patrones nuevos deben agregarse dentro de este owner y producir **placements resueltos**, no sistemas paralelos. Ejemplos futuros compatibles: línea con jitter, borde de rectángulo, arco, fill de selección, spline y presets de escena.

No añadir loops permanentes, watchers globales ni persistencia propia a Scene Painter.

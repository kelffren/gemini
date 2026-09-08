# Kelo World — System Documentation Standard

> Obligatorio para todo sistema/capacidad nueva y para cualquier owner que cambie de contrato.

Kelo World mantiene dos capas de documentación sincronizadas:

1. **Documento técnico** — para humanos e IA que mantienen el código.
2. **Guía de jugador** — para explicar la mecánica visible sin exponer internals innecesarios.

## Documento técnico obligatorio

Ruta recomendada: `docs/systems/<SYSTEM_ID>.md`.

Debe explicar como mínimo:

- propósito y problema que resuelve;
- OWNER y archivos principales;
- estado que posee y estado que NO posee;
- API pública y contratos;
- flujo paso a paso;
- dependencias permitidas;
- eventos/hooks usados;
- modelo local vs autoridad online futura;
- persistencia, si existe;
- invariantes;
- extension points y cómo reutilizarlo;
- ejemplos de uso correcto;
- anti-patrones / qué NO hacer;
- legacy/adapters/hotfixes relacionados;
- tests/CI que lo protegen;
- observabilidad/telemetría;
- fallos conocidos o deuda pendiente;
- checklist para añadir una capacidad nueva sin duplicar owner.

El documento describe el sistema ACTUAL. Planes futuros deben marcarse explícitamente como pendientes.

## Guía pública obligatoria

Todo sistema que tenga efecto visible para el jugador debe tener una sección en `guide.html`.

La guía pública explica:

- qué es la mecánica;
- cómo se activa/usa;
- qué puede y qué no puede hacer;
- qué sucede en móvil y desktop cuando aplique;
- reglas, límites y estados importantes;
- ejemplos prácticos;
- errores o comportamientos normales que podrían confundirse con bugs.

No publicar secretos de seguridad, claves, rutas de administración, detalles explotables de autoridad ni internals que no ayudan a jugar.

Un sistema puramente interno puede marcar `playerVisible:false` en el catálogo. Aun así necesita documento técnico.

## Catálogo fuente de verdad

`docs/system-catalog.json` registra cada sistema documentado. Cada entrada contiene:

- `id`
- `owner`
- `source`
- `technicalDoc`
- `playerVisible`
- `playerGuideAnchor` cuando aplique
- `status`

`scripts/system-documentation-audit.js` valida que los archivos y anchors declarados existen.

## Regla de cambio

Si un cambio modifica API, ownership, flujo, reglas visibles o extension points, el mismo PR debe actualizar:

1. código;
2. documento técnico;
3. `docs/system-catalog.json` si cambia metadata;
4. `guide.html` si el jugador percibe el cambio;
5. tests/CI asociados.

Un sistema nuevo sin documentación no está terminado.

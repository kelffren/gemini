# Kelo World — Pixelorama Pro Bridge

## Propósito

Pixelorama Pro aporta el editor Pixelorama Web completo como capacidad profesional de Asset Forge sin duplicar sus herramientas dentro del editor rápido de Kelo y sin mantener Godot/WASM residente durante gameplay normal.

La regla actual es **todo dentro del juego**: no hay botón que navegue a una pestaña externa. Pixelorama vive en una superficie Kelo full-screen creada sólo después de `PIXELORAMA PRO`.

## Owner y frontera

- Owner Kelo UI: `src/creators/ui/pixelorama-pro-bridge.mjs`.
- Runtime shell: `tools/pixelorama/index.html`.
- Lifecycle pesado: `src/creators/core/creator-exclusive-runtime.mjs`.
- Persistencia `.pxo`: `src/creators/repository/pixelorama-project-store.mjs`.
- Build patcher: `scripts/prepare-pixelorama-kelo.mjs`.
- Upstream: Orama Interactive / Pixelorama.

Pixelorama sigue siendo software de terceros. Kelo posee el shell, lifecycle, bridge, persistence policy y build patches; no reclama ownership del código upstream.

## Pines y licencia

- Source pin para build Kelo: `da7b68f97806c461abde615d1d847af91921c37b`.
- Web deployment pin de fallback stock: `2af0e590b6f1dd8a9255686373c5831623bb03bd`.
- Godot del pin: `4.7.2`.
- Licencia Pixelorama: MIT; cualquier build redistribuido debe conservar copyright/aviso MIT.

## Arquitectura runtime

```text
Asset Forge
  → tap PIXELORAMA PRO
  → Creator Exclusive Runtime
      input locked
      movement intercepted
      render intercepted
      simulation suspended
      non-core ref=0 atlases evicted
  → iframe local tools/pixelorama/index.html
  → shell carga Pixelorama Web completo sólo ahora
  → Asset Forge PNG / PXO via ArrayBuffer
  → edición Pixelorama
  → export interceptado → Kelo
  → PNG vuelve al import canónico de Asset Forge
  → PXO se guarda en IndexedDB (máx. 5 revisiones)
  → BACK TO KELO
  → requestQuit + Engine.unload + iframe blank/remove
  → release Creator Exclusive claim
```

El `iframe` es deliberado: ofrece un contexto Godot/WASM que puede destruirse completo. No se incrusta el engine WebAssembly en el mismo runtime JS global del juego.

## Peso y boot

Pixelorama no entra al boot normal. El deployment upstream observado tiene aproximadamente 39.5 MB de WASM + 6.4 MB de PCK antes de recursos auxiliares. El shell Kelo carga esos recursos únicamente al abrir Pro.

El fallback actual obtiene los binarios pesados desde un commit upstream inmutable vía CDN, por lo que `gemini` no versiona ~46 MB de binarios. El documento/runtime sigue perteneciendo al origen Kelo; sólo los recursos binarios se descargan desde CDN.

El build preferido de producción es el Kelo-patched export descrito en `vendor/pixelorama-kelo/README.md`. Mientras el pipeline de Pages permanezca pausado, el shell conserva fallback stock completo.

## Bridge de datos

Protocolo: `kelo.pixelorama.v1`.

Mensajes parent ↔ child:

- `asset`: PNG/PXO como `ArrayBuffer` transferable.
- `ready`: runtime Godot listo.
- `export`: export Pixelorama capturado con nombre/MIME/buffer.
- `quit`: Kelo solicita cierre.
- `quit-ack`: Godot terminó su teardown.
- `error`: error de boot/bridge.

El shell Kelo intercepta descargas blob producidas por el export Web y las envía al parent en vez de sacar al usuario del juego. Si el build custom está activo, `KeloWebBridge.gd` permite además `Engine.copyToFS → open_path` sin selector de archivos.

Con el build stock, el shell intenta autoabrir el asset por shortcut y reutiliza el hook Web de Pixelorama; si esa ruta concreta del navegador no acepta eventos sintéticos, `File → Open` sigue siendo fallback dentro de Pixelorama y Kelo suministra el buffer pendiente.

## Persistencia

`pixelorama-project-store.mjs` usa IndexedDB con:

- `.pxo` como `Blob`, no buffer global permanente;
- máximo 5 revisiones por asset;
- máximo 64 MB por revisión;
- `navigator.storage.persist()` best-effort;
- `navigator.storage.estimate()` para cuota/uso.

Los assets publicados no dependen de este store; es authoring draft local.

## Perfil de memoria Kelo

El patcher custom aplica:

- `max_undo_steps = 64` por defecto en Web en vez de ilimitado;
- limpieza de `fileData/fileType/fileName` JS después de copiar bytes a Godot;
- bridge Godot `set_fps`, `set_undo_limit`, `open_path`;
- Web sin threads;
- PWA/service worker propio de Pixelorama deshabilitado.

El shell usa el bridge custom para FPS adaptativo: 60 durante interacción, 30 tras ~2.2 s idle y 15 tras ~10 s idle. El build stock conserva el comportamiento upstream hasta que el custom build esté desplegado.

## Cache y actualización

No existe un segundo service worker Kelo/Pixelorama en la integración preferida. El runtime se versiona por commit/build inmutable. Browser HTTP cache puede conservar WASM/PCK entre aperturas, pero cerrar Pixelorama elimina su runtime de RAM.

**Cache en disco ≠ memoria residente.** Es correcto conservar el binario cacheado y reconstruir el engine sólo cuando el usuario abre Pro.

## Invariantes

1. Pixelorama nunca entra al boot normal.
2. Pixelorama no abre una web/pestaña externa como flujo de producto.
3. No commitear WASM/PCK generados ni upstream completo en `gemini`.
4. Gameplay y Pixelorama pesado no deben trabajar a la vez; usar Creator Exclusive Runtime.
5. El último close debe liberar todos los owner claims aunque Asset Forge se cierre por Escape/removal.
6. PNG exportado vuelve por el import/QA canónico de Asset Forge.
7. PXO es source project de authoring; no autoridad gameplay/económica.
8. No quitar funciones authoring de Pixelorama para ahorrar memoria: optimizar residency, buffers, FPS, history y lifecycle.
9. Web threads permanecen desactivados salvo nueva evidencia móvil que justifique cambiarlos.
10. No reactivar workflows de Pages mientras la cola siga en modo de recuperación sin una decisión explícita.

## Build reproducible

`node scripts/prepare-pixelorama-kelo.mjs <checkout-upstream>` aplica los patches Kelo sobre el source pin. Existe un blueprint en `.github/workflows-paused-2026-09-15/pixelorama-kelo-runtime.yml`; está pausado deliberadamente y sólo genera un artifact cuando sea seguro reactivarlo.

## Tests / auditoría

- `tests/creator-exclusive-runtime.test.mjs`.
- `scripts/pixelorama-runtime-audit.mjs`.
- La aceptación visible sigue exigiendo Playwright/iPhone: abrir, editar, cerrar, caminar 8 s y confirmar ausencia de freeze/crash/black screen antes de marcar VERIFIED.

## Deuda conocida

- El fallback stock no contiene `KeloWebBridge.gd`; su auto-open depende del bridge Web upstream y debe validarse en Safari iPhone.
- El custom build no se publica automáticamente mientras los workflows sigan pausados.
- Aún no hay medición real de peak RAM en Safari; no presentar ahorro cuantificado hasta capturar evidencia.

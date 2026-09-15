# Chat inferior — KeloChatUI

## Propósito y owners

El chat inferior reutiliza `#lx-chat-drawer`, el log y el formulario de Luxe. `KeloChatUI` posee la presentación del desplegable, vista previa, contador y teclado. `KeloChatIntegrationBridge` sincroniza el estado de apertura de Luxe con esa presentación y conserva su propio token de `KeloInputLocks`. No crea transporte, servidor ni autoridad de mensajes.

## Arranque y API

`index.html` carga Luxe, el drawer y su bridge en ese orden, antes de `kelo:boot-ready`. Son UI visible desde el inicio; no se descargan mediante nameplates ni requieren polling. La antigua regla de emergencia que los ocultaba no forma parte del contrato.

`KeloChatUI.open/close/toggle/isOpen`, `showKeyboard/hideKeyboard/useNativeKeyboard` y `refreshPreview` actúan sobre la misma bandeja. El menú existente puede seguir abriendo el chat de Luxe. `KeloChatIntegrationBridge.sync()` reconcilia únicamente cambios de estado: una notificación de clase sin cambio de apertura no debe provocar nuevas escrituras DOM.

## Estado e invariantes

- Cerrado: pestaña y último mensaje visibles; sin bloqueo de movimiento.
- Abierto: contenido y campo de texto dentro del viewport; token de input adquirido.
- Cerrar por pestaña, menú, Escape o gesto libera el token del bridge y el token de Luxe si existía.
- `classList.remove/toggle` puede generar MutationObserver aunque el valor no cambie. El bridge recuerda el último estado reconciliado para impedir un ciclo infinito de microtareas.
- CSS de `.open` debe prevalecer sobre el estado colapsado; un atributo `aria-expanded=true` por sí solo no prueba que el campo de texto sea accesible.
- Teclado y mensajes usan el formulario original. No se duplica un handler de envío ni una conexión de red.
- En ventanas de hasta 680px de alto, el teclado abierto amplía la bandeja hasta dejar 24px de margen superior, para no recortar la última fila. Sin teclado se conserva la altura normal del desplegable.

## Online-first y extensión

La capa de presentación no decide destinatarios, identidad autoritativa, persistencia ni entrega. El formulario conserva la ruta `keloSay` existente cuando está disponible, y el fallback local de Luxe. Ver el eco local no certifica recepción entre usuarios. Una integración online debe mantener esta frontera y entregar mensajes al log existente.

## Validación y deuda

`node tests/chat-lock-regression.mjs` reproduce el bucle de cierre original y valida que apertura/cierre se estabilicen sin filtrar tokens. `tests/freeze-stability.spec.js` prueba pestaña, teclado, menú, cierre y movimiento8s/reposo10s/reanudación4s en desktop Chromium y perfiles iPhone Chromium/WebKit. Validación física de iPhone y entrega remota siguen pendientes; el informe de investigación conserva el estado observado.

Guía pública: `guide.html#chat-inferior`.

# Chat inferior ausente y cierre inestable

BUG: BUG-0006
FECHA: 2026-09-15
VERSION / BUILD: V6.69 / candidato local de chat
ESTADO: vigente

El jugador informa que el chat inferior desplegable no entra/no carga. El runtime inicial no carga `kelo-chat-drawer.js` ni su integration bridge; `index.html` además contiene una regla `display:none!important` para la bandeja premium y su pestaña. El menú solo abre el chat básico de Luxe.

La restauración requiere corregir dos fallos adicionales del código existente:

1. `KeloChatIntegrationBridge` observa clases, y al ver el chat cerrado llama a `KELO_LUXE.closeChat()`, que vuelve a quitar la clase. Una notificación por una operación sin cambio real repite indefinidamente la reconciliación. El test `chat-lock-regression.mjs` modela las notificaciones asíncronas del MutationObserver: falla antes con una cola que nunca se vacía, y pasa después al reconciliar únicamente cambios reales de apertura. Conserva los tokens originales; no borra locks ajenos.
2. La regla base `#kelo-luxe #lx-chat-drawer.kc-premium` tiene más especificidad que `.open`, por lo que el atributo de apertura cambia pero la bandeja permanece desplazada. Playwright desktop reprodujo el campo `#lx-in` fuera del viewport durante 60s. Se elimina el selector duplicado innecesario; la regla de apertura vuelve a ganar. La primera restauración incompleta no se cuenta como PASS.

Después de esos cambios, la prueba de chat pasó en escritorio Chromium (27.7s), iPhone Chromium (28.3s) y WebKit (41.6s): pestaña, teclado KELO escribiendo `hola`, teclado nativo, cierre, apertura desde menú, cierre y liberación de locks, movimiento8s/reposo10s/reanudación4s. Los tiempos indicados son de la prueba completa, no tiempos de carga.

La inspección visual adicional en una ventana corta mostró la fila inferior del teclado recortada. El candidato responsive amplía solo la bandeja con teclado abierto cuando la altura es <=680px. Se valida también rotación 844x390 y acceso a espacio/borrar, manteniendo el flujo completo de movimiento.

La restauración reutiliza Luxe → KeloChatUI → KeloChatIntegrationBridge antes de boot-ready, elimina polling de montaje y no carga networking/gameplay como efecto lateral. Es una corrección de UI; no certifica entrega de mensajes entre usuarios ni sustituye autoridad online.

Pendiente: resultado de la ronda horizontal, build desplegado, iPhone físico, y resto del objetivo global de freezes. No cerrar BUG-0003 a partir de este resultado.

Resultado final local del candidato responsive: **6/6 PASS** en 3.5 minutos. Chat normal y rotación horizontal en desktop Chromium (26.6s/26.5s), iPhone Chromium (28.7s/28.2s) e iPhone WebKit (44.3s/51.9s). Incluye teclado KELO, espacio/borrar de la última fila, cambio a teclado nativo, apertura desde menú, liberación de input locks y ciclo de movimiento/reposo/reanudación. La verificación desplegada y física sigue pendiente.

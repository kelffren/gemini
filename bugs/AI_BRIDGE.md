# KELO WORLD — AI Bug Bridge

Este es el puente obligatorio para cualquier IA/agente que inspeccione o modifique bugs de KELO WORLD.

## 0. Antes de tocar un bug

1. Leer `AGENTS.md`.
2. Leer `bugs/README.md`.
3. Leer `bugs/SCHEMA.md`.
4. Leer `bugs/RESEARCH_PROTOCOL.md`.
5. Leer todos los bugs relevantes en `bugs/registry/`.
6. Para un bug existente, ejecutar `npm run bug:brief -- BUG-NNNN` cuando el entorno lo permita.
7. Buscar duplicados antes de crear uno nuevo.
8. Inspeccionar el `main` actual; no asumir que un chat, commit viejo o memoria describe el runtime actual.

### Regla anti-pérdida de tiempo

Antes de escribir código, el agente debe poder responder:

- qué hechos están confirmados;
- qué hipótesis siguen vivas;
- qué hipótesis fueron descartadas;
- qué intentos ya se hicieron y cómo terminaron;
- qué intento NO debe repetirse sin nueva evidencia;
- cuál es la `next_best_action` actual;
- cuál es la prueba exacta que demostraría éxito.

Si no puede responder eso, primero completa la investigación del bug.

## 1. Si descubres un bug nuevo

Regístralo si es reproducible, serio o requiere trabajo posterior.

NO crees un bug nuevo si ya existe uno con el mismo síntoma/flujo. En ese caso añade la nueva evidencia/reporte al bug existente.

Proceso:

`DESCUBRIR -> BUSCAR DUPLICADO -> REGISTRAR/ENLAZAR -> TRIAGE -> INVESTIGAR`

Al crear un bug:

- usar el siguiente `BUG-NNNN` libre;
- describir el síntoma, no inventar la causa;
- escribir pasos de reproducción reales;
- marcar datos desconocidos como `unknown`/`null`;
- añadir evidencia concreta;
- crear `research.known_facts`, `research.hypotheses`, `research.unknowns` y `next_best_actions`;
- separar hipótesis de hechos;
- no almacenar secretos.

## 2. Investigación obligatoria

Un bug activo usa el protocolo de `bugs/RESEARCH_PROTOCOL.md`.

### Hechos

Registrar hechos como `F1`, `F2`, ... con evidencia. No convertir inferencias en hechos.

### Hipótesis

Registrar teorías como `H1`, `H2`, ... con:

- confianza;
- estado;
- evidencia a favor;
- evidencia en contra;
- siguiente test discriminante.

Estados permitidos:

`unverified | supported | weakened | ruled_out | confirmed`

### Intentos

Todo intento material usa `A1`, `A2`, ... dentro de `attempt_history`.

Registrar incluso los fallos. Un `FAIL` debe dejar `do_not_repeat_without`.

Nunca borrar un intento fallido para limpiar el registro.

### Investigación externa

Cuando el bug depende de navegador, iOS, BrowserStack, Playwright, SDK, API o servicio externo, consultar documentación oficial/changelog aplicable y registrar solo la conclusión útil en `research.external_references`.

## 3. Si quieres trabajar en un bug

Antes de editar código:

- comprobar que no está `CLOSED`, `WONT_FIX` o reclamado activamente por otro agente;
- leer el briefing completo;
- comprobar que la solución propuesta no repite un `attempt_history` fallido;
- si repite un intento, documentar primero la nueva evidencia que invalida el resultado anterior;
- si está libre y entendido, mover a `CLAIMED`;
- rellenar `claimed_by` y `claim_started_at`;
- inspeccionar owner/arquitectura según Foundation;
- reproducir el problema antes del fix cuando sea posible;
- elegir preferiblemente la primera `next_best_action` porque debe representar el experimento de mayor valor actual.

No reclames muchos bugs para bloquear a otros agentes. Reclama solamente el que vas a trabajar.

## 4. Después de cada experimento o cambio

Antes de abandonar el bug o pasar a otra hipótesis:

1. añadir/actualizar su entrada en `attempt_history`;
2. registrar `PASS | FAIL | PARTIAL | NOT_RUN | BLOCKED`;
3. escribir qué se aprendió;
4. actualizar hipótesis afectadas;
5. mover a `research.ruled_out` las teorías realmente descartadas;
6. actualizar `research.unknowns`;
7. recalcular `next_best_actions`.

Un intento fallido que descarta una teoría es progreso real.

## 5. Cómo marcar un bug como fixed

NUNCA pasar directamente de `CLAIMED` a `CLOSED`.

Cuando exista una corrección candidata:

1. Ejecuta los tests relevantes.
2. Registra commit(s) y archivos tocados en `fix`.
3. Registra el cambio también en `attempt_history`.
4. Resume qué cambió sin exagerar.
5. Actualiza las hipótesis según la evidencia obtenida.
6. Cambia estado a `FIXED_PENDING_VERIFY`.
7. Libera `claimed_by` si ya no estás trabajando activamente.
8. Deja `verification.status = PENDING`.
9. Asegura que `next_best_actions` incluya la verificación real pendiente.

`FIXED_PENDING_VERIFY` NO significa que el bug esté resuelto para el jugador. Significa que hay una corrección lista para ser atacada por el verificador.

## 6. Cómo verificar un fix

Preferiblemente un agente/prueba diferente al que hizo el fix:

1. Leer el bug original y su `attempt_history`, no solo el commit más reciente.
2. Reproducir el mismo flujo y entorno que fallaba.
3. Ejecutar prueba negativa/edge cuando aplique.
4. Comprobar regresiones relacionadas.
5. Guardar evidencia.

Si pasa:

- añadir un intento con `validation.result = PASS`;
- `verification.status = PASS`;
- registrar método, evidencia, agente y fecha;
- mover a `VERIFIED`.

Después puede pasar a `CLOSED` cuando el cierre administrativo sea apropiado.

Si falla:

- añadir un intento `FAIL` con la evidencia;
- `verification.status = FAIL`;
- mover a `REOPENED`;
- explicar el síntoma actual;
- actualizar hipótesis y siguientes acciones;
- NO borrar el historial del intento anterior.

## 7. Si encuentras un duplicado

No mantengas dos bugs activos para el mismo defecto.

- conservar el bug canónico más útil/antiguo;
- en el duplicado, rellenar `duplicate_of`;
- enlazar sus reportes/evidencia al bug canónico;
- no perder screenshots/logs únicos.

## 8. Si un jugador reporta algo

Los reportes de jugador entran primero como `REPORT-*`.

Triage:

`REPORT -> sanitizar -> buscar duplicado -> enlazar BUG existente o crear BUG nuevo`

Nunca confiar ciegamente en la causa sugerida por el jugador. Su descripción sí es evidencia del síntoma.

Fotos/videos/logs se referencian por storage externo. No versionar binarios grandes en Git.

## 9. Si un test automático descubre algo

Un test rojo no siempre es un bug de producto. Determina primero si es:

- bug de producto;
- bug del test/harness;
- infraestructura externa;
- configuración incompatible.

Registra cada defecto por separado cuando las causas son distintas. Ejemplo: un test de World puede estar bloqueado por un bug de BrowserStack; no mezclar ambos como si fueran el mismo fallo.

## 10. Conflictos entre agentes

Si dos agentes trabajan el mismo bug:

- el segundo no debe sobrescribir silenciosamente el claim;
- comparar ramas/commits y conservar el fix más probado;
- registrar ambos intentos por separado;
- nunca falsificar el historial para que parezca trabajo lineal.

## 11. Auditoría

Antes de terminar un pass que cambió bugs:

`npm run audit:bugs`

Si falla, el expediente está incompleto o rompe invariantes del registro.

## 12. Regla de oro

**DETECTAR no es ARREGLAR. ARREGLAR no es VERIFICAR. VERIFICAR no es CERRAR.**

Y además:

**UN INTENTO FALLIDO ES CONOCIMIENTO. NO SE REPITE SIN NUEVA EVIDENCIA.**

## 13. Prompt corto para cualquier IA

> Lee `AGENTS.md`, `bugs/README.md`, `bugs/SCHEMA.md`, `bugs/RESEARCH_PROTOCOL.md` y el bug relevante. Ejecuta `npm run bug:brief -- BUG-NNNN` si puedes. Antes de tocar código identifica hechos, hipótesis activas, hipótesis descartadas, todos los intentos previos y la siguiente acción de mayor valor. No repitas un intento `FAIL` sin nueva evidencia. Cada experimento debe quedar en `attempt_history`. Si corriges un bug, déjalo `FIXED_PENDING_VERIFY`; solo una verificación independiente del flujo original puede moverlo a `VERIFIED`.

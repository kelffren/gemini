# KELO WORLD — Bug Registry

`/bugs` es la fuente operativa compartida para defectos encontrados por jugadores, pruebas, humanos e IAs.

## Objetivo

Un bug no debe vivir solamente en un chat, un commit o la memoria de un agente. Todo defecto reproducible que pueda requerir trabajo posterior debe quedar registrado aquí con un ID estable.

El registro también funciona como **memoria de investigación entre agentes**. Un agente nuevo debe poder descubrir qué ocurre, qué se sabe, qué se sospecha, qué ya se intentó, qué falló y cuál es la siguiente prueba de mayor valor sin reconstruir conversaciones antiguas.

Flujo oficial:

`DETECTAR → REGISTRAR → TRIAGE → INVESTIGAR → CLAIM → FIXED_PENDING_VERIFY → VERIFIED → CLOSED`

La IA que modifica código **no obtiene permiso automático para cerrar el bug**. `FIXED_PENDING_VERIFY` significa exactamente: existe una corrección candidata, pero todavía falta una verificación independiente.

## Fast path para agentes

Para un bug existente:

`npm run bug:brief -- BUG-0003`

Ese briefing muestra en orden:

- investigaciones de apoyo disponibles para ese BUG, con fecha, versión/build y vigencia;
- observación actual;
- hechos confirmados;
- hipótesis activas;
- hipótesis descartadas;
- intentos anteriores y resultado;
- unknowns;
- próximas acciones priorizadas;
- fix candidate;
- gate de verificación y blockers.

Regla central:

**un intento `FAIL` no se repite sin nueva evidencia que invalide la conclusión anterior.**

## Estructura

- `incoming/` — reportes crudos antes de deduplicar/triage. Futuro destino de reportes de jugadores y automatizaciones.
- `registry/` — un JSON por bug canónico (`BUG-0001.json`).
- `investigacion/` — biblioteca de apoyo por bug con investigaciones técnicas versionadas y fechadas.
- `templates/` — contratos de bug, reporte e investigación.
- `SCHEMA.md` — campos, estados, investigación e invariantes.
- `RESEARCH_PROTOCOL.md` — cómo separar hechos, hipótesis, intentos, descartes, unknowns y siguientes acciones.
- `AI_BRIDGE.md` — protocolo obligatorio para cualquier IA que lea o modifique bugs.

## Sección `investigacion/`

Una investigación externa o técnica ampliada vive en:

`bugs/investigacion/BUG-NNNN/`

Cada archivo debe declarar obligatoriamente al principio:

- `BUG: BUG-NNNN`
- `FECHA: YYYY-MM-DD`
- `VERSION / BUILD: versión exacta investigada`
- `ESTADO: vigente | parcialmente_superada | superada | historica`

También debe indicar el entorno cuando aplique. El nombre recomendado es:

`YYYY-MM-DD-<version>-<tema>.md`

Ejemplo real:

`bugs/investigacion/BUG-0003/2026-09-13-world-light-20260914-1-safari-freeze.md`

La investigación apoya al agente, pero no sustituye el JSON canónico. Si descubre un hecho, hipótesis, descarte o intento nuevo, el agente debe reflejarlo también en `bugs/registry/BUG-NNNN.json`.

Antes de tocar código, el agente debe abrir primero la investigación más reciente cuya `VERSION / BUILD` siga aplicando al HEAD/runtime actual. No aplicar conclusiones de una versión vieja sin comprobar vigencia.

`npm run audit:bugs` valida automáticamente que toda investigación tenga BUG + FECHA + VERSION/BUILD + ESTADO válidos y que el BUG coincida con su carpeta.

## Schema v2 — expediente vivo

Los bugs activos registran además:

- `research.known_facts` (`F1`, `F2`, ...);
- `research.hypotheses` (`H1`, `H2`, ...);
- `research.ruled_out`;
- `research.unknowns`;
- `research.external_references` cuando dependen de SDK/API/browser/servicio externo;
- `attempt_history` (`A1`, `A2`, ...), incluyendo intentos fallidos;
- `next_best_actions`, priorizadas por valor informativo.

Esto evita que varios agentes ataquen la misma teoría fallida con nombres distintos.

## Estados

- `OPEN` — detectado, todavía sin triage suficiente o sin owner.
- `TRIAGED` — reproducido/clasificado y listo para trabajar.
- `CLAIMED` — un agente está trabajando activamente en él.
- `FIXED_PENDING_VERIFY` — existe fix candidate/commit, pero NO está demostrado en el entorno de aceptación.
- `VERIFIED` — una verificación independiente pasó y tiene evidencia.
- `CLOSED` — bug verificado y administrativamente cerrado.
- `BLOCKED` — no puede progresar por una dependencia explícita.
- `REOPENED` — una verificación posterior o reporte real demuestra que reapareció.
- `WONT_FIX` — decisión explícita documentada; nunca usar para esconder un fallo.

## Regla de evidencia

No basta con `tests pass` si el bug es visible para el jugador. La verificación debe corresponder al entorno donde falla: LIVE, móvil real, BrowserStack, server real u otro target aplicable.

Una hipótesis solo pasa a `confirmed` con evidencia que demuestre la causa. Un commit solo es un intento hasta que su validación diga qué ocurrió realmente.

## IDs

- Bug canónico: `BUG-NNNN`.
- Reporte individual: `REPORT-NNNNNN`.
- Hecho dentro del bug: `F1`, `F2`, ...
- Hipótesis: `H1`, `H2`, ...
- Intento: `A1`, `A2`, ...
- Unknown: `U1`, `U2`, ...
- Nunca reutilizar IDs cerrados dentro de su ámbito.
- Antes de crear un bug, buscar duplicados por título, área, síntomas, archivos y reproducción.

## Reportes de jugadores — plug-and-play

El contrato ya reserva `incoming/` y `REPORT_TEMPLATE.json` para que más adelante el cliente del juego pueda enviar descripción + captura + contexto técnico. Las imágenes pesadas NO deben versionarse dentro de Git: deben vivir en storage y el reporte solo guarda una referencia segura.

Un reporte puede convertirse en bug nuevo o enlazarse a un bug existente. Muchos reportes pueden apuntar al mismo bug.

## Auditoría

Después de modificar registros o investigaciones:

`npm run audit:bugs`

El auditor comprueba, entre otras cosas:

- schema v2;
- estados válidos;
- IDs únicos de hechos/hipótesis/intentos;
- resultados válidos de intentos;
- que todo `FAIL` tenga `do_not_repeat_without`;
- que `FIXED_PENDING_VERIFY` tenga un fix identificable;
- que `VERIFIED/CLOSED` requieran verificación `PASS`;
- que cada archivo de `bugs/investigacion/` tenga BUG, FECHA, VERSION / BUILD y ESTADO válidos.

## Seguridad

Nunca guardar en bugs/reportes:

- access tokens;
- JWT completos;
- passwords;
- cookies;
- Supabase service role/secret keys;
- BrowserStack access keys;
- información privada innecesaria del jugador.

Aplicar sanitización antes de persistir diagnósticos, logs o screenshots.

## Lectura obligatoria para agentes

Antes de registrar, reclamar, arreglar, verificar o cerrar un bug, leer [`AI_BRIDGE.md`](AI_BRIDGE.md), [`SCHEMA.md`](SCHEMA.md), [`RESEARCH_PROTOCOL.md`](RESEARCH_PROTOCOL.md) y las investigaciones aplicables en `bugs/investigacion/BUG-NNNN/`.

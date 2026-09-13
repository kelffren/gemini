# KELO WORLD — Bug Registry

`/bugs` es la fuente operativa compartida para defectos encontrados por jugadores, pruebas, humanos e IAs.

## Objetivo

Un bug no debe vivir solamente en un chat, un commit o la memoria de un agente. Todo defecto reproducible que pueda requerir trabajo posterior debe quedar registrado aquí con un ID estable.

Flujo oficial:

`DETECTAR → REGISTRAR → TRIAGE → CLAIM → FIXED_PENDING_VERIFY → VERIFIED → CLOSED`

La IA que modifica código **no obtiene permiso automático para cerrar el bug**. `FIXED_PENDING_VERIFY` significa exactamente: existe una corrección candidata, pero todavía falta una verificación independiente.

## Estructura

- `incoming/` — reportes crudos antes de deduplicar/triage. Futuro destino de reportes de jugadores y automatizaciones.
- `registry/` — un JSON por bug canónico (`BUG-0001.json`).
- `templates/` — contratos de bug y reporte.
- `SCHEMA.md` — campos, estados e invariantes.
- `AI_BRIDGE.md` — protocolo obligatorio para cualquier IA que lea o modifique bugs.

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

## IDs

- Bug canónico: `BUG-NNNN`.
- Reporte individual: `REPORT-NNNNNN`.
- Nunca reutilizar IDs cerrados.
- Antes de crear un bug, buscar duplicados por título, área, síntomas, archivos y reproducción.

## Reportes de jugadores — plug-and-play

El contrato ya reserva `incoming/` y `REPORT_TEMPLATE.json` para que más adelante el cliente del juego pueda enviar descripción + captura + contexto técnico. Las imágenes pesadas NO deben versionarse dentro de Git: deben vivir en storage y el reporte solo guarda una referencia segura.

Un reporte puede convertirse en bug nuevo o enlazarse a un bug existente. Muchos reportes pueden apuntar al mismo bug.

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

Antes de registrar, reclamar, arreglar, verificar o cerrar un bug, leer [`AI_BRIDGE.md`](AI_BRIDGE.md) y [`SCHEMA.md`](SCHEMA.md).

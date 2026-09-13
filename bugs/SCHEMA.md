# KELO WORLD — Bug Schema

Este documento define el contrato humano/IA para `/bugs`.

## Bug canónico

Cada archivo `bugs/registry/BUG-NNNN.json` debe contener como mínimo:

- `schema_version`: entero. Empieza en `1`.
- `id`: ID estable `BUG-NNNN`.
- `title`: síntoma corto, no teoría de causa.
- `status`: uno de los estados permitidos.
- `severity`: `critical | high | medium | low`.
- `area`: lista de áreas afectadas.
- `source`: `player | ai | test | human | monitoring | mixed`.
- `discovered_at`: fecha/hora ISO cuando se conoce; usar solo precisión real.
- `reported_by`: lista de orígenes/actores sin datos sensibles.
- `reports`: IDs de reportes crudos asociados.
- `environment`: entorno donde se observa; usar `null`/`unknown` si no se sabe.
- `reproduction`: pasos reproducibles. Puede estar vacío si aún no se conoce.
- `expected`: comportamiento esperado.
- `actual`: comportamiento observado.
- `evidence`: referencias a logs, screenshots, Actions, BrowserStack u otras pruebas.
- `suspected_files`: pistas, nunca presentarlas como causa confirmada.
- `owner_hint`: owner/área probable según Foundation; puede ser `null`.
- `claimed_by`: agente/persona que lo reclama; `null` si libre.
- `claim_started_at`: ISO o `null`.
- `fix`: objeto con `status`, `commits`, `files`, `summary`.
- `verification`: objeto con `status`, `method`, `evidence`, `verified_by`, `verified_at`.
- `blocked_by`: IDs de bugs/dependencias conocidas.
- `duplicate_of`: bug canónico si este registro terminó siendo duplicado; normalmente `null`.
- `related_bugs`: IDs relacionados pero distintos.
- `notes`: hechos importantes y limitaciones.
- `updated_at`: última fecha/hora conocida de cambio.

## Reporte crudo

`bugs/incoming/REPORT-NNNNNN.json` representa una observación, no necesariamente un bug único.

Campos principales:

- `id`
- `created_at`
- `source`
- `player_description`
- `category`
- `screenshot_ref`
- `environment`
- `game_context`
- `diagnostics`
- `sanitized`
- `triage.status`
- `triage.bug_id`

Las capturas deben almacenarse fuera del repositorio; `screenshot_ref` contiene solamente una referencia segura.

## Máquina de estados

Transiciones normales:

`OPEN -> TRIAGED -> CLAIMED -> FIXED_PENDING_VERIFY -> VERIFIED -> CLOSED`

Transiciones adicionales:

- `OPEN|TRIAGED|CLAIMED -> BLOCKED`
- `BLOCKED -> TRIAGED|CLAIMED`
- `FIXED_PENDING_VERIFY -> REOPENED` si falla la verificación.
- `VERIFIED|CLOSED -> REOPENED` si reaparece en una versión aplicable.
- `OPEN|TRIAGED -> WONT_FIX` solo con razón explícita.

## Invariantes duras

1. `FIXED_PENDING_VERIFY` requiere al menos una corrección identificable: commit, patch o cambio concreto.
2. `VERIFIED` requiere `verification.status = PASS` y evidencia reproducible.
3. `CLOSED` requiere haber pasado primero por `VERIFIED`, salvo duplicados administrativos que apunten a otro bug canónico.
4. El agente que escribió el fix puede ejecutar tests, pero una validación independiente debe ser la base para `VERIFIED` en bugs críticos o user-facing.
5. Un bug que vuelve a aparecer se marca `REOPENED`; no se crea otro ID salvo que la causa/síntoma sea realmente distinto.
6. No modificar la reproducción o `actual` para hacer que un fix parezca correcto. Si cambia el síntoma, añadir nota/evidencia.
7. `suspected_files` y `owner_hint` son hipótesis hasta que exista causa raíz demostrada.
8. Nunca almacenar secretos o PII innecesaria.

## Severidad

- `critical`: bloquea acceso, pérdida/corrupción grave, seguridad/autoridad, crash sistemático o rompe una ruta principal.
- `high`: feature principal inutilizable o regresión seria con workaround pobre.
- `medium`: defecto importante con workaround razonable.
- `low`: visual/menor, no rompe el flujo principal.

## Cierre correcto

Un cierre válido debe poder contestar:

1. ¿Qué bug exacto se reprodujo?
2. ¿Cuál fue la causa raíz o el cambio que lo corrige?
3. ¿Qué commit(s) contienen el fix?
4. ¿Qué prueba independiente demuestra que ya no ocurre?
5. ¿En qué entorno/versión se verificó?

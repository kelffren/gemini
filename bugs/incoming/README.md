# Incoming bug reports

Esta carpeta representa la cola de reportes crudos antes del triage.

Formato esperado: `REPORT-NNNNNN.json`, basado en `../templates/REPORT_TEMPLATE.json`.

Fuentes futuras permitidas:

- jugador desde el juego;
- BrowserStack/Playwright;
- monitorización;
- IA auditora;
- humano/QA.

Reglas:

1. Sanitizar antes de persistir.
2. No guardar secretos, cookies ni tokens.
3. Screenshots/videos viven en storage externo; aquí solo se guarda la referencia.
4. Un reporte no equivale automáticamente a un bug nuevo.
5. El triage debe buscar un bug canónico en `../registry/` y enlazarlo cuando corresponda.
6. Después del triage, conservar el reporte si aporta evidencia útil; no duplicar contenido innecesariamente.

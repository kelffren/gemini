# KELO WORLD — AI Bug Bridge

Este es el puente obligatorio para cualquier IA/agente que inspeccione o modifique bugs de KELO WORLD.

## 0. Antes de tocar un bug

1. Leer `AGENTS.md`.
2. Leer `bugs/README.md`.
3. Leer `bugs/SCHEMA.md`.
4. Leer todos los bugs relevantes en `bugs/registry/`.
5. Buscar duplicados antes de crear uno nuevo.
6. Inspeccionar el `main` actual; no asumir que un chat, commit viejo o memoria describe el runtime actual.

## 1. Si descubres un bug nuevo

Regístralo si es reproducible, serio o requiere trabajo posterior.

NO crees un bug nuevo si ya existe uno con el mismo síntoma/flujo. En ese caso añade la nueva evidencia/reporte al bug existente.

Proceso:

`DESCUBRIR -> BUSCAR DUPLICADO -> REGISTRAR/ENLAZAR -> TRIAGE`

Al crear un bug:

- usar el siguiente `BUG-NNNN` libre;
- describir el síntoma, no inventar la causa;
- escribir pasos de reproducción reales;
- marcar datos desconocidos como `unknown`/`null`;
- añadir evidencia concreta;
- separar hipótesis de hechos;
- no almacenar secretos.

## 2. Si quieres trabajar en un bug

Antes de editar código:

- comprobar que no está `CLOSED`, `WONT_FIX` o reclamado activamente por otro agente;
- si está libre y entendido, mover a `CLAIMED`;
- rellenar `claimed_by` y `claim_started_at`;
- inspeccionar owner/arquitectura según Foundation;
- reproducir el problema antes del fix cuando sea posible.

No reclames muchos bugs para bloquear a otros agentes. Reclama solamente el que vas a trabajar.

## 3. Cómo marcar un bug como fixed

NUNCA pasar directamente de `CLAIMED` a `CLOSED`.

Cuando exista una corrección candidata:

1. Ejecuta los tests relevantes.
2. Registra commit(s) y archivos tocados en `fix`.
3. Resume qué cambió sin exagerar.
4. Cambia estado a `FIXED_PENDING_VERIFY`.
5. Libera `claimed_by` si ya no estás trabajando activamente.
6. Deja `verification.status = PENDING`.

Ejemplo conceptual:

```json
{
  "status": "FIXED_PENDING_VERIFY",
  "fix": {
    "status": "candidate",
    "commits": ["abc123"],
    "files": ["src/foo.js"],
    "summary": "Evita que el gate vuelva a abrir después de una sesión Guest anónima válida."
  },
  "verification": {
    "status": "PENDING",
    "method": "Real iPhone Safari E2E",
    "evidence": [],
    "verified_by": null,
    "verified_at": null
  }
}
```

`FIXED_PENDING_VERIFY` NO significa que el bug esté resuelto para el jugador. Significa que hay una corrección lista para ser atacada por el verificador.

## 4. Cómo verificar un fix

Preferiblemente un agente/prueba diferente al que hizo el fix:

1. Leer el bug original, no solo el commit.
2. Reproducir el mismo flujo y entorno que fallaba.
3. Ejecutar prueba negativa/edge cuando aplique.
4. Comprobar regresiones relacionadas.
5. Guardar evidencia.

Si pasa:

- `verification.status = PASS`;
- registrar método, evidencia, agente y fecha;
- mover a `VERIFIED`.

Después puede pasar a `CLOSED` cuando el cierre administrativo sea apropiado.

Si falla:

- `verification.status = FAIL`;
- añadir evidencia;
- mover a `REOPENED`;
- explicar el síntoma actual;
- NO borrar el historial del intento anterior.

## 5. Si encuentras un duplicado

No mantengas dos bugs activos para el mismo defecto.

- conservar el bug canónico más útil/antiguo;
- en el duplicado, rellenar `duplicate_of`;
- enlazar sus reportes/evidencia al bug canónico;
- no perder screenshots/logs únicos.

## 6. Si un jugador reporta algo

Los reportes de jugador entran primero como `REPORT-*`.

Triage:

`REPORT -> sanitizar -> buscar duplicado -> enlazar BUG existente o crear BUG nuevo`

Nunca confiar ciegamente en la causa sugerida por el jugador. Su descripción sí es evidencia del síntoma.

Fotos/videos/logs se referencian por storage externo. No versionar binarios grandes en Git.

## 7. Si un test automático descubre algo

Un test rojo no siempre es un bug de producto. Determina primero si es:

- bug de producto;
- bug del test/harness;
- infraestructura externa;
- configuración incompatible.

Registra cada defecto por separado cuando las causas son distintas. Ejemplo: un test de World puede estar bloqueado por un bug de BrowserStack; no mezclar ambos como si fueran el mismo fallo.

## 8. Conflictos entre agentes

Si dos agentes trabajan el mismo bug:

- el segundo no debe sobrescribir silenciosamente el claim;
- comparar ramas/commits y conservar el fix más probado;
- registrar ambos intentos en `notes` si aportaron evidencia;
- nunca falsificar el historial para que parezca trabajo lineal.

## 9. Regla de oro

**DETECTAR no es ARREGLAR. ARREGLAR no es VERIFICAR. VERIFICAR no es CERRAR.**

La misión del bridge es impedir que una IA diga “fixed” solo porque escribió código.

## 10. Prompt corto para cualquier IA

> Lee `AGENTS.md`, `bugs/README.md`, `bugs/SCHEMA.md` y `bugs/AI_BRIDGE.md`. Revisa `bugs/registry/`. Si descubres un bug reproducible, regístralo o enlázalo a uno existente. Si corriges un bug, márcalo `FIXED_PENDING_VERIFY` con commit y evidencia, nunca `CLOSED`. Solo una verificación independiente con el flujo original puede moverlo a `VERIFIED`; si vuelve a fallar, usa `REOPENED`.

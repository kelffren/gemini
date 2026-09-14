# KELO WORLD — Cortafuegos iPhone real

Contrato para que las mejoras automáticas no rompan el juego ni se den por válidas sin iPhone físico.

## Reglas

1. **Si no se prueba en iPhone real, la mejora no es válida.**
2. **Hasta que el bug no esté `VERIFIED` en iPhone Safari real, no se avanza.**
3. Headless, Chromium, Pixel 7 o “viewport iPhone” no sustituyen un iPhone.

## Qué cuenta como iPhone real

- BrowserStack `ios-real-iphone` / iPhone 14 Pro Safari
- Teléfono del jugador (Safari), con evidencia del flujo original

## Qué queda congelado

Mientras `BUG-0001`, `BUG-0002`, `BUG-0003` u otro bug iPhone/World `high`/`critical` siga abierto o `FIXED_PENDING_VERIFY`:

- Evolution Autopilot no corre
- No se mergean features, paneles, updaters ni refactors ajenos
- Solo se tocan archivos del bug (`suspected_files` / `fix.files`), tests iPhone, BrowserStack y este registro

## Comandos

```
npm run test:firewall:iphone
npm run firewall:iphone
npm run firewall:iphone -- --mode=freeze
```

CI: `.github/workflows/iphone-improvement-firewall.yml`

El autopilot llama `--mode=freeze` y sale 1 si hay bugs bloqueantes.

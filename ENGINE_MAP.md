# ENGINE_MAP — Kelo World
Fecha: 2026-08-31 19:50 EDT
Repo: kelffren/gemini  branch main
Pages: https://kelffren.github.io/gemini/?v=66
Titulo esperado: Kelo World — V5.15

Este archivo es el indice permanente. Si pasamos 30 mil horas, se abre ESTE archivo primero.
No borrar engines vacios todavia: son marcas de sistemas que ya existieron.

Leyenda
- CORE: no tocar sin auditoria. El juego nace aqui.
- LIVE: dueño actual de esa feature.
- WRAP: envuelve updateMovement/render. Peligro si hay dos WRAP del mismo tema.
- EMPTY: intencionalmente muerto. No rellenar.
- LEGACY: vive, pero no es el dueño. Candidato a vaciar cuando el LIVE este verificado.

## Dueños actuales (un solo jefe por tema)

| Tema | Dueño LIVE | No tocar / no duplicar |
|---|---|---|
| Loop, input, fisica base, player | engine-a.js | — |
| Combate / skills / dash data | engine-b.js + engine-p.js | — |
| Caminata walk/run + stop al soltar | engine-ac.js + engine-ah.js | engine-ag.js EMPTY |
| Plaza tiles / suelo | engine-c.js + engine-l.js | engine-i.js pisa plaza.jpg |
| Edificios solidos | engine-ae.js | — |
| Cafe entrar/salir | engine-ai.js | engine-af.js EMPTY |
| Hero sprite | engine-m.js | — |
| Bots + chat + mochila | engine-s.js | click-to-move YA QUITADO |
| NPCs | engine-d.js + engine-q.js | engine-r.js EMPTY (empuje) |
| Zoom telefono | engine-z.js | engine-t.js tambien toca zoom |
| Melee tap derecha | engine-w.js (confirmar) / historico en n | — |

## Inventario archivo por archivo

| Archivo | Bytes | Marca | Que es |
|---|---|---|---|
| index.html | 4540 | CORE | Carga scripts a-aj con ?v=66 |
| engine-a.js | 20556 | CORE | Mundo, player, joystick, AABB, camara, STATE, loop base |
| engine-b.js | 20568 | CORE | Skills, dash, loop wrap, paneles demo |
| engine-c.js | 7177 | LIVE | Draw plaza / menu / quickTravel |
| engine-d.js | 8585 | LIVE | NPCs + inspect |
| engine-e.js | 7701 | LIVE | HUD / applyState / jewels |
| engine-f.js | 2674 | LEGACY | Aim / FX parcial |
| engine-g.js | 6876 | LIVE | Combate extra / proyectiles |
| engine-h.js | 2928 | LIVE | Dummy / HiDPI mixto |
| engine-i.js | 1371 | LEGACY PELIGRO | Dibuja plaza.jpg y VUELVE a pintar avatares |
| engine-j.js | 4998 | LEGACY | Zoom / HUD |
| engine-k.js | 4310 | LEGACY | Combate / UI |
| engine-l.js | 4008 | LIVE | HiDPI + tileset |
| engine-m.js | 3478 | LIVE | Sprite heroe PNG |
| engine-n.js | 3002 | LIVE | Dibujo edificios |
| engine-o.js | 3051 | LEGACY | Capa extra |
| engine-p.js | 5483 | LIVE | Aim medible estilo ML |
| engine-q.js | 1802 | LIVE | NPC Maestro + prueba dummy 12s |
| engine-r.js | 98 | EMPTY | Empuje NPC/bots APAGADO 2026-08-31 |
| engine-s.js | 6257 | LIVE | Bots extra, chat, mochila. Nav click-to-move APAGADO |
| engine-t.js | 86 | LEGACY | Caps zoom |
| engine-u.js | 1136 | LEGACY | Capa extra |
| engine-v.js | 521 | LIVE | Escala radio heroe |
| engine-w.js | 2717 | LIVE | Melee / input derecha (auditar) |
| engine-x.js | 1165 | LEGACY | Capa extra |
| engine-y.js | 1767 | LEGACY | Capa extra |
| engine-z.js | 362 | LIVE | Zoom movil 11-14 tiles |
| engine-aa.js | 1938 | LEGACY | Capa extra |
| engine-ab.js | 3508 | LEGACY | Caminata vieja |
| engine-ac.js | 828 | LIVE WRAP | gait walk/run + CONFIG.speed |
| engine-ae.js | 1209 | LIVE | 4 edificios con hueco de puerta |
| engine-af.js | 74 | EMPTY | Cafe viejo (teleport 2360). NO revivir |
| engine-ag.js | 78 | EMPTY | Bob viejo. NO revivir |
| engine-ah.js | 1873 | LIVE WRAP | Bob por distancia + hard stop |
| engine-ai.js | 3563 | LIVE | Cafe Oro boton Cafe/Salir |
| engine-aj.js | 325 | LIVE | Dedup obstaculos |
| assets/hero.PNG | 2134082 | LIVE | Sprite heroe |
| plaza.json | 67 | LIVE | Meta plaza |
| updates_2026.md | 3147 | LOG | Bitacora |
| docs/* | — | LOG | Docs viejos 2026-08-30. Este mapa los sustituye para engines |

## Regla de trabajo

1. Un sistema = un dueño LIVE.
2. Si hay que parchear, se edita el dueño. No se crea engine-ak.
3. EMPTY se deja vacio a proposito (marca historica).
4. No decir ARREGLADO sin abrir Pages con ?v=xx nuevo y captura.
5. Cafe nunca teletransporta a 2360,2360. Interior sobre el edificio OX+18T, OY+14T.

## Links rapidos

- Mapa: https://github.com/kelffren/gemini/blob/main/ENGINE_MAP.md
- Codigo: https://github.com/kelffren/gemini
- Juego: https://kelffren.github.io/gemini/?v=66

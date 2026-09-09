/* KELO-INDEX
 * area: TEST / UI
 * owner: Premium main menu + player HUD contract audit
 * keys: MENU LUXE HUD PLAYER NOBILITY TITLE CLAN HP MANA GOLD GUIDE INPUT LOCK FOUNDATION
 * purpose: prueba estáticamente que Luxe reutiliza owners reales, monta un HUD único y no reintroduce legacy/polling
 * online: N/A; valida fronteras UI/owner, no autoridad gameplay
 */
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const luxe=read('src/ui/luxe-shell.js');
const playerHud=read('src/ui/luxe-player-hud.js');
const index=read('index.html');
const nobility=read('src/systems/nobility.js');
const titles=read('src/systems/title-system.js');
const character=read('src/ui/character-customizer-ui.js');
const selfUi=read('src/ui/self-interaction-ui.js');
const backpack=read('src/ui/backpack-ui.js');
const market=read('src/ui/market-ui.js');
const house=read('src/ui/house-instance-ui.js');
const studio=read('src/ui/studio-launcher.js');
const ability=read('src/abilities/kelo-ability-boot.js');
const engineC=read('engine-c.js');
const engineQ=read('engine-q.js');

assert(luxe.includes('KELO-INDEX'),'Luxe shell must carry KELO-INDEX');
assert(luxe.includes("luxe-shell-v4.0.2-premium-menu"),'Premium Luxe version missing');
assert(luxe.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),'Premium menu must use a two-column grid');
assert(luxe.includes("env(safe-area-inset-top)")&&luxe.includes("env(safe-area-inset-bottom)"),'Safe-area support missing');
assert(luxe.includes("min-height:78px")&&luxe.includes("width:44px;height:44px"),'Touch-target contract missing');
assert(luxe.includes("white-space:normal")&&luxe.includes("text-overflow:clip"),'Narrow-screen titles must not use ellipsis clipping');
assert(luxe.includes("KeloInputLocks")&&luxe.includes("luxe-main-menu")&&luxe.includes("luxe-chat"),'Token input-lock routes missing');
assert(!luxe.includes('KELO_MODAL_INPUT_LOCK='),'Luxe shell must not write legacy modal lock directly');
assert(!luxe.includes('setInterval('),'Luxe shell must not poll with setInterval');
assert(!studio.includes('setInterval(')&&!studio.includes('setTimeout(boot'),'Creators launcher must not poll/retry for the Luxe menu');

for(const id of ['bag','abilities','appearance','profile','market','chat','properties','nobility','emotes']){
  assert(luxe.includes("id:'"+id+"'"),'Missing real menu route: '+id);
}
assert(luxe.includes("KeloCharacterCustomizer?.open"),'Appearance must route to Character Creator owner');
assert(luxe.includes("KeloNobility?.open"),'Nobility must route to KeloNobility owner');
assert(luxe.includes("KeloSelfInteractionUI?.openEmotes"),'Emotes must route to self interaction owner');
assert(luxe.includes("KeloBackpackUI?.open"),'Backpack must route to KeloBackpackUI');
assert(luxe.includes("KeloMarketUI?.open"),'Market must route to KeloMarketUI');
assert(luxe.includes("KELO_HOUSE_UI?.show"),'Properties must route to house/property UI owner');
assert(luxe.includes("KeloAbilities?.openStonePanel"),'Abilities must route to KeloAbilities');
assert(ability.includes("let visibleStoneCount = 0")&&ability.includes("if (!html) return;")&&ability.includes("if (!equip) return;"),'Abilities inventory must safely ignore non-stone inventory entries');

assert(luxe.includes("KeloMissionsUI")&&luxe.includes("optional:true"),'Missions must be owner-gated, not a fake button');
assert(luxe.includes("KeloSettingsUI")&&luxe.includes("optional:true"),'Settings must be owner-gated, not a fake button');
assert(engineC.includes("tool === 'missions'")&&engineC.includes('acceso social preparado'),'Expected current missions placeholder contract not found');
assert(engineC.includes("tool === 'settings'")&&engineC.includes('Zoom HD por ahora'),'Expected current settings placeholder contract not found');
assert(engineQ.includes('legacy: mission prototype'),'Legacy Maestro trial must remain classified legacy rather than promoted as Missions UI');

assert(nobility.includes('window.KeloNobility = Object.freeze')&&nobility.includes('donateGold')&&nobility.includes('donateKC'),'Nobility owner/donation API missing');
assert(nobility.includes("{ id: 'knight', name: 'Caballero'")&&nobility.includes("{ id: 'king', name: 'Rey'"),'Nobility Caballero/Rey rank contract missing');
assert(nobility.includes("document.querySelector('#menu-sheet .menu-grid')"),'Audit expected stale legacy Nobility menu selector so Luxe can replace discoverability without duplicating owner');
assert(titles.includes('root.KeloTitles = Object.freeze')&&titles.includes('getEquipped: getEquipped'),'Title owner/equipped-title API missing');
assert(character.includes('window.KeloCharacterCustomizer=')||character.includes('root.KeloCharacterCustomizer='),'Character Creator owner missing');
assert(selfUi.includes('openEmotes')&&selfUi.includes('window.KeloSelfInteractionUI'),'Emote UI owner missing');
assert(backpack.includes('window.KeloBackpackUI=Object.freeze'),'Backpack UI owner missing');
assert(market.includes('window.KeloMarketUI=Object.freeze'),'Market UI owner missing');
assert(house.includes('window.KELO_HOUSE_UI=Object.freeze'),'Property/house UI owner missing');
assert(studio.includes("document.querySelector('#lx-menu-panel .lx-menu-grid')")&&studio.includes("Herramientas de creación"),'Creators launcher must reuse premium Luxe grid');

// Player HUD: subcomponente del mismo owner de presentación; no crea gameplay state.
assert(playerHud.includes('KELO-INDEX')&&playerHud.includes('owner: Kelo Luxe Shell presentation'),'Player HUD must remain under Luxe presentation ownership');
for(const id of ['kw-player-hud-wrap','kw-hud-avatar','kw-hud-name','kw-hud-id','kw-hud-clan','kw-hud-nobility','kw-hud-title','kw-hud-hp-bar','kw-hud-mana-bar','kw-player-guide']){
  assert(playerHud.includes(id),'Player HUD missing required element: '+id);
}
assert(playerHud.includes("root.KeloNobility?.getRank?.()"),'HUD nobleza must consume KeloNobility instead of calculating rank');
assert(playerHud.includes("root.KeloTitles?.getEquipped?.()")&&playerHud.includes("root.KeloTitles?.getTitle?.(id)"),'HUD title must consume KeloTitles equipped title');
assert(playerHud.includes("finite(state.gold)")&&playerHud.includes("finite(p.hp)")&&playerHud.includes("finite(p.maxHp)"),'HUD must consume existing gold/HP values');
assert(playerHud.includes("p?.mana??state?.playerProfile?.mana")&&playerHud.includes("'— / —'"),'Mana must fail visibly unavailable instead of inventing a resource');
assert(playerHud.includes("return 'Sin clan'")&&playerHud.includes("p?.clan?.name"),'Clan must use adapter/fallback without creating a parallel clan system');
assert(playerHud.includes('env(safe-area-inset-top)')&&playerHud.includes('env(safe-area-inset-left)'),'Player HUD must respect iOS safe areas');
assert(playerHud.includes('min-height:44px')&&playerHud.includes('@media(max-width:360px)'),'Player HUD must keep touch target and narrow-mobile layout');
assert(!playerHud.includes('setInterval('),'Player HUD must not poll with setInterval');
assert((playerHud.match(/requestAnimationFrame\(/g)||[]).length===1,'Player HUD may use one initial RAF, not a continuous frame loop');
assert(!/STATE\s*\.\s*gold\s*[+\-*/]?=/.test(playerHud),'Player HUD must not mutate gold');
assert(!/\.hp\s*[+\-*/]?=/.test(playerHud),'Player HUD must not mutate HP');

// La duplicación real venía de dos superficies DOM: telemetry legacy + Oro Luxe.
assert(index.includes('src/ui/luxe-player-hud.js?v=1'),'Player HUD bootstrap missing');
assert(!index.includes('id="telemetry-bar"'),'Legacy telemetry gold badge must be removed from runtime DOM');
assert(!index.includes('id="kelo-guide-link"'),'Legacy standalone guide link must be removed from runtime DOM');
assert(!index.includes('.hud-badge{'),'Legacy telemetry HUD CSS must be retired, not hidden');
assert(!index.includes('#kelo-guide-link{'),'Legacy guide CSS must be retired, not hidden');
assert(index.includes('<div id="ui-layer"><div class="action-bar"'),'UI layer should retain only its owned action bar surface');

assert(index.includes('src/ui/luxe-shell.js?v=229'),'Luxe cache-bust not updated');
assert(index.includes('src/abilities/kelo-ability-boot.js?v=157'),'Abilities cache-bust not updated');
assert(index.includes('src/ui/studio-launcher.js?v=3'),'Creators cache-bust not updated');

console.log(JSON.stringify({
  status:'PASS',
  owner:'Kelo Luxe Shell presentation',
  playerHud:'src/ui/luxe-player-hud.js',
  duplicateCause:'index telemetry-bar + Luxe gold rendered concurrently',
  legacyTelemetryRemoved:true,
  guideIntegrated:true,
  dataSources:['localPlayer','STATE','KeloNobility','KeloTitles'],
  clanFallback:true,
  manaHonestUnavailableFallback:true,
  recovered:['Apariencia','Nobleza','Burlas'],
  existingReal:['Mochila','Habilidades','Perfil','Mercado','Chat','Propiedades'],
  conditional:['Misiones','Ajustes'],
  creators:'authorization-gated launcher',
  noParallelMenu:true,
  noPolling:true,
  tokenInputLocks:true,
  narrowScreenTitles:'no-ellipsis'
},null,2));
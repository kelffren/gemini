/* KELO-INDEX
 * area: TEST / UI
 * owner: Premium main menu contract audit
 * keys: MENU LUXE ROUTES NOBILITY CHARACTER EMOTES INPUT LOCK FOUNDATION
 * purpose: prueba estáticamente que el menú Luxe reutiliza owners reales y no reintroduce rutas fake/polling
 * online: N/A; valida fronteras UI/owner, no autoridad gameplay
 */
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const luxe=read('src/ui/luxe-shell.js');
const index=read('index.html');
const nobility=read('src/systems/nobility.js');
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
assert(ability.includes("const equip=row.querySelector('[data-equip]');if(equip)"),'Abilities inventory must safely ignore non-stone inventory entries');

assert(luxe.includes("KeloMissionsUI")&&luxe.includes("optional:true"),'Missions must be owner-gated, not a fake button');
assert(luxe.includes("KeloSettingsUI")&&luxe.includes("optional:true"),'Settings must be owner-gated, not a fake button');
assert(engineC.includes("tool === 'missions'")&&engineC.includes('acceso social preparado'),'Expected current missions placeholder contract not found');
assert(engineC.includes("tool === 'settings'")&&engineC.includes('Zoom HD por ahora'),'Expected current settings placeholder contract not found');
assert(engineQ.includes('legacy: mission prototype'),'Legacy Maestro trial must remain classified legacy rather than promoted as Missions UI');

assert(nobility.includes('window.KeloNobility = Object.freeze')&&nobility.includes('donateGold')&&nobility.includes('donateKC'),'Nobility owner/donation API missing');
assert(nobility.includes("{ id: 'knight', name: 'Caballero'")&&nobility.includes("{ id: 'king', name: 'Rey'"),'Nobility Caballero/Rey rank contract missing');
assert(nobility.includes("document.querySelector('#menu-sheet .menu-grid')"),'Audit expected stale legacy Nobility menu selector so Luxe can replace discoverability without duplicating owner');
assert(character.includes('window.KeloCharacterCustomizer=')||character.includes('root.KeloCharacterCustomizer='),'Character Creator owner missing');
assert(selfUi.includes('openEmotes')&&selfUi.includes('window.KeloSelfInteractionUI'),'Emote UI owner missing');
assert(backpack.includes('window.KeloBackpackUI=Object.freeze'),'Backpack UI owner missing');
assert(market.includes('window.KeloMarketUI=Object.freeze'),'Market UI owner missing');
assert(house.includes('window.KELO_HOUSE_UI=Object.freeze'),'Property/house UI owner missing');
assert(studio.includes("document.querySelector('#lx-menu-panel .lx-menu-grid')")&&studio.includes("Herramientas de creación"),'Creators launcher must reuse premium Luxe grid');

assert(index.includes('src/ui/luxe-shell.js?v=229'),'Luxe cache-bust not updated');
assert(index.includes('src/abilities/kelo-ability-boot.js?v=157'),'Abilities cache-bust not updated');
assert(index.includes('src/ui/studio-launcher.js?v=3'),'Creators cache-bust not updated');

console.log(JSON.stringify({
  status:'PASS',
  owner:'src/ui/luxe-shell.js',
  recovered:['Apariencia','Nobleza','Burlas'],
  existingReal:['Mochila','Habilidades','Perfil','Mercado','Chat','Propiedades'],
  conditional:['Misiones','Ajustes'],
  creators:'authorization-gated launcher',
  noParallelMenu:true,
  noPolling:true,
  tokenInputLocks:true,
  narrowScreenTitles:'no-ellipsis'
},null,2));
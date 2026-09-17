/* KELO-INDEX
 * area: AUDIT / UI PRESENTATION FOUNDATION
 * owner: Main Stability Gate
 * keys: UI LUXE TOKENS ACCESSIBILITY TOUCH TARGET OVERLAY TOAST DIALOG BOOT CONTRACT
 * purpose: bloquea regresiones estructurales del contrato compartido de presentación Luxe/KeloUI
 * do-not: NO browser emulation; el flujo móvil real lo cubre main-stability-mobile.spec.js
 */
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('src/ui/luxe-ui-foundation.js');
const css=read('src/ui/responsive-foundation.css');
const html=read('index.html');
const test=read('tests/main-stability-mobile.spec.js');
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(ui.includes('KELO-INDEX'),'ui foundation missing KELO-INDEX');
expect(ui.includes("owner: KELO_LUXE"),'ui foundation must remain owned by KELO_LUXE presentation');
for(const api of ['toast','confirm','surfaces','busy','haptics','motion','auditTouchTargets','snapshot'])expect(ui.includes(api),`missing KeloUI API: ${api}`);
expect(ui.includes('KeloInputLocks')||ui.includes('root.KeloInputLocks'),'dialog must consume shared input locks');
expect(!ui.includes('setInterval('),'polling/setInterval forbidden in UI foundation');
expect(!/\bSTATE\s*\.[\w$]+\s*=/.test(ui),'UI foundation must not write STATE');
expect(!/\blocalPlayer\s*\.[\w$]+\s*=/.test(ui),'UI foundation must not write localPlayer');
expect(ui.includes('focusTrap:true'),'accessibility focus-trap audit flag missing');
expect(ui.includes('touchMinimumPx:44'),'44px touch target contract missing');

for(const token of ['--kelo-surface-base','--kelo-text-primary','--kelo-accent','--kelo-motion-normal','--kelo-z-dialog','--kelo-z-toast'])expect(css.includes(token),`missing semantic token ${token}`);
expect(css.includes(':focus-visible'),'focus-visible styling missing');
expect(css.includes('.kelo-ui-dialog-backdrop'),'dialog presentation missing');
expect(css.includes('.kelo-ui-toast-host'),'toast presentation missing');
expect(css.includes('html[data-kelo-motion="reduced"]'),'internal reduced-motion mode missing');

const luxeIndex=html.indexOf('src/ui/luxe-shell.js');
const uiIndex=html.indexOf('src/ui/luxe-ui-foundation.js');
const orientationIndex=html.indexOf('src/ui/mobile-orientation.js');
expect(luxeIndex>=0&&uiIndex>luxeIndex&&orientationIndex>uiIndex,'KeloUI must load after Luxe and before orientation/HUD');
expect(test.includes('window.KeloUI'),'main stability mobile smoke must prove KeloUI on exact PR bytes');

if(failures.length){console.error('LUXE UI FOUNDATION AUDIT FAILED');for(const failure of failures)console.error(' - '+failure);process.exit(1);}
console.log('LUXE UI FOUNDATION AUDIT PASS');
console.log(JSON.stringify({owner:'KELO_LUXE',semanticTokens:true,surfaceStack:true,toast:true,dialog:true,busy:true,hapticsFallback:true,motionPreference:true,touchMinimumPx:44,gameplayWrites:false,polling:false},null,2));

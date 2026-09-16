/* KELO-INDEX
 * area: QA / LEGACY TRANSITIONS
 * owner: KeloLegacyTransitionBridge contract
 * purpose: garantiza que el shim temporal usa owners modernos y se carga después de ellos
 */
import fs from 'node:fs';

const bridge=fs.readFileSync(new URL('../src/core/legacy-transition-bridge.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const failures=[];
function need(source,text,message){if(!source.includes(text))failures.push(message);}
function forbid(source,re,message){if(re.test(source))failures.push(message);}

need(bridge,'KeloPlayerPosition.teleport','bridge must use KeloPlayerPosition.teleport');
need(bridge,'KeloCamera.setTarget','bridge must use KeloCamera.setTarget');
forbid(bridge,/\blocalPlayer\.(?:x|y)\s*=/,'bridge must not write localPlayer position directly');
forbid(bridge,/\bcamera\.(?:targetX|targetY|x|y)\s*=/,'bridge must not write camera directly');

const position=html.indexOf('player-position-system.js');
const camera=html.indexOf('camera-system.js');
const bridgePos=html.indexOf('legacy-transition-bridge.js');
if(position<0||camera<0||bridgePos<0)failures.push('boot entries missing');
if(!(position<bridgePos&&camera<bridgePos))failures.push('legacy transition bridge must load after position and camera owners');

if(failures.length){for(const failure of failures)console.error('LEGACY_TRANSITION_FAIL:',failure);process.exit(1);}
console.log('LEGACY TRANSITION BRIDGE PASS');

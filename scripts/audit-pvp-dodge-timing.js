/* KELO-INDEX
 * area: TEST / PVP
 * owner: deterministic audit only
 * keys: PVP DODGE 60HZ 90HZ 120HZ TRAJECTORY RECOVERY CLIENT SERVER
 * purpose: cuantifica endpoint y diferencia temporal entre el dash lineal cliente y la autoridad cubic-out sin inventar gameplay
 * online: compara el contrato LIVE del cliente con server/pvp-authority.js
 * do-not: NO modificar gameplay, NO ocultar diferencias de trayectoria/recovery
 */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const pvp=fs.readFileSync(path.join(root,'src/systems/pvp-world.js'),'utf8');
const abilities=fs.readFileSync(path.join(root,'src/abilities/kelo-ability-boot.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server/pvp-authority.js'),'utf8');
const m=pvp.match(/dodge:Object\.freeze\(\{distance:([\d.]+),duration:([\d.]+),iFrames:([\d.]+),recovery:([\d.]+),cooldown:([\d.]+)/);
if(!m)throw new Error('PVP_DODGE_TUNING_NOT_FOUND');
const distance=Number(m[1]),duration=Number(m[2]),recovery=Number(m[4]);
if(!abilities.includes('const k=1-Math.max(0,dash.time)/dash.max'))throw new Error('CLIENT_DASH_LINEAR_CONTRACT_CHANGED');
if(!server.includes('ease=1-Math.pow(1-k,3)'))throw new Error('SERVER_DODGE_CUBIC_CONTRACT_CHANGED');
if(!server.includes('player._pvpDash=null'))throw new Error('SERVER_DODGE_END_CONTRACT_CHANGED');
function sample(hz){const dt=1/hz;let t=0,maxDelta=0,maxAt=0,client=0,authority=0,firstClient=0,firstAuthority=0,steps=0;while(t<duration-1e-12){t=Math.min(duration,t+dt);const k=Math.min(1,t/duration);client=distance*k;authority=distance*(1-Math.pow(1-k,3));const delta=Math.abs(authority-client);if(delta>maxDelta){maxDelta=delta;maxAt=t;}if(!steps){firstClient=client;firstAuthority=authority;}steps++;}return{hz,steps,clientEndpointPx:client,serverEndpointPx:authority,endpointDeltaPx:Math.abs(authority-client),firstStepClientPx:firstClient,firstStepServerPx:firstAuthority,maxTrajectoryDeltaPx:maxDelta,maxTrajectoryDeltaAtMs:maxAt*1000};}
const result={distancePx:distance,durationMs:duration*1000,clientRecoveryLockMs:recovery*1000,serverPostDashMovementLockMs:0,postDashControlDeltaMs:recovery*1000,refresh:[60,90,120].map(sample)};
for(const r of result.refresh){if(Math.abs(r.clientEndpointPx-distance)>.001||Math.abs(r.serverEndpointPx-distance)>.001||r.endpointDeltaPx>.001)throw new Error('DODGE_ENDPOINT_PARITY_FAILED_'+r.hz);}
console.log('PVP_DODGE_TIMING_AUDIT',JSON.stringify(result,null,2));

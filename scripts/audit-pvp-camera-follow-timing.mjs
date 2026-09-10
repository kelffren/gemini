/* KELO-INDEX
 * area: QA / CAMERA / PVP
 * owner: Camera Foundation CI
 * keys: CAMERA PVP DEADZONE FOLLOW LOOKAHEAD 60HZ 90HZ 120HZ DETERMINISTIC
 * purpose: instrumenta la misma matemática de follow de engine-a a 60/90/120 Hz y verifica que la dead-zone semántica conserve su fracción de pantalla bajo zoom landscape/desktop
 * online: N/A; cámara local de presentación
 */
const EPS=1e-9;
const speed=185.28;
const tuning=Object.freeze({deadXRatio:.10,lookAheadDist:36,lookAheadDecay:4,dampX:8});
const cases=[
  {name:'mobile-landscape',w:844,h:390,baseZoom:1.1079545454545454},
  {name:'desktop-landscape',w:1440,h:900,baseZoom:1.45}
];
function effectiveZoom(c){return c.baseZoom*(c.h/c.w);}
function simulate(c,hz,mode){
  const dt=1/hz,zoom=effectiveZoom(c),deadRatio=mode==='winner'?tuning.deadXRatio/zoom:tuning.deadXRatio;
  const deadWorld=c.w*deadRatio;
  let playerX=0,targetX=0,cameraX=0,lookOffsetX=0,onset=null;
  for(let step=1;step<=hz*3;step++){
    playerX+=speed*dt;
    const lookFactor=1-Math.exp(-tuning.lookAheadDecay*dt);
    lookOffsetX+=(tuning.lookAheadDist-lookOffsetX)*lookFactor;
    const deltaX=(playerX+lookOffsetX)-targetX;
    if(Math.abs(deltaX)>deadWorld){
      targetX+=deltaX-Math.sign(deltaX)*deadWorld;
      if(!onset)onset={step,t:step*dt,playerX,targetX,lookOffsetX,screenOffsetX:(playerX-cameraX)*zoom};
    }
    cameraX+=(targetX-cameraX)*(1-Math.exp(-tuning.dampX*dt));
    if(onset&&step>onset.step+Math.ceil(.25*hz))break;
  }
  return{hz,zoom,deadWorld,deadScreenPx:deadWorld*zoom,semanticPx:c.w*tuning.deadXRatio,onset};
}
const report=[];
for(const c of cases){
  for(const hz of [60,90,120]){
    const baseline=simulate(c,hz,'baseline');
    const winner=simulate(c,hz,'winner');
    if(Math.abs(winner.deadScreenPx-winner.semanticPx)>EPS)throw new Error(`DEADZONE_PARITY_${c.name}_${hz}`);
    if(!(winner.onset.t>baseline.onset.t))throw new Error(`ONSET_NOT_DELAYED_${c.name}_${hz}`);
    report.push({case:c.name,hz,baseline,winner});
  }
}
console.log('PVP_CAMERA_TIMING_OK '+JSON.stringify(report));

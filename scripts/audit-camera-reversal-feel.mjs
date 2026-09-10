/* KELO-INDEX
 * area: QA / CAMERA FEEL
 * owner: audit-camera-reversal-feel
 * keys: CAMERA REVERSAL LOOKAHEAD 60HZ 90HZ 120HZ A B RESPONSE CONTINUITY
 * purpose: reproduce la misma inversión RIGHT→LEFT y compara baseline 1x contra el winner 3x sin tocar gameplay
 * online: N/A; cámara/presentación cliente, sin autoridad gameplay
 * do-not: NO tuning runtime, NO segundo camera owner
 */
import fs from 'node:fs';

const cameraSource=fs.readFileSync(new URL('../src/core/camera-system.js',import.meta.url),'utf8');
if(!cameraSource.includes("kelo-camera-v1.6.0-reversal-response"))throw new Error('CAMERA_REVERSAL_VERSION_MISSING');
if(!cameraSource.includes('LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER=3'))throw new Error('CAMERA_REVERSAL_WINNER_NOT_LOCKED');

const DIST=60,DECAY=4;
function run(hz,multiplier){
  const dt=1/hz;
  let offset=0;
  for(let i=0;i<Math.ceil(1.5*hz);i++)offset+=(DIST-offset)*(1-Math.exp(-DECAY*dt));
  const start=offset;
  let crossMs=null,maxStep=0,prev=offset;
  const samples=[];
  for(let i=0;i<Math.ceil(.35*hz);i++){
    const reversing=offset>0;
    const decay=DECAY*(reversing?multiplier:1);
    offset+=(-DIST-offset)*(1-Math.exp(-decay*dt));
    const step=Math.abs(offset-prev);maxStep=Math.max(maxStep,step);prev=offset;
    const tMs=(i+1)*dt*1000;
    if(crossMs==null&&offset<=0)crossMs=tMs;
    samples.push({tMs:Number(tMs.toFixed(2)),offset:Number(offset.toFixed(3))});
  }
  return {hz,start:Number(start.toFixed(3)),crossMs:Number(crossMs.toFixed(2)),maxStep:Number(maxStep.toFixed(3)),samples:samples.slice(0,8)};
}
const rows=[];
for(const hz of [60,90,120]){
  const baseline=run(hz,1),candidate=run(hz,3);
  rows.push({hz,baseline,candidate,crossGainMs:Number((baseline.crossMs-candidate.crossMs).toFixed(2)),stepIncrease:Number((candidate.maxStep-baseline.maxStep).toFixed(3))});
}
const maxCandidateCross=Math.max(...rows.map(r=>r.candidate.crossMs));
const maxCandidateStep=Math.max(...rows.map(r=>r.candidate.maxStep));
const minGain=Math.min(...rows.map(r=>r.crossGainMs));
const ok=maxCandidateCross<=70&&maxCandidateStep<19&&minGain>=100;
console.log(JSON.stringify({ok,contract:{baselineMultiplier:1,candidateMultiplier:3,maxCrossMs:70,maxWorldStep:19,minGainMs:100},rows},null,2));
if(!ok)throw new Error('CAMERA_REVERSAL_FEEL_CONTRACT_FAILED');
/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / POSE TEMPLATES
 * owner: canonical animation pose plans for Sprite AI V3
 * purpose: provide deterministic semantic/keypoint hints without coupling the compiler to one AI provider
 * does-not-own: model inference, image pixels, gameplay animation timing
 */

export const SPRITE_DIRECTIONS=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);

const freezePose=(name,phase,keypoints)=>Object.freeze({name,phase,keypoints:Object.freeze(keypoints)});

// Normalized coordinates are intentionally provider-neutral. (0,0) is the top-left
// of the sprite cell and (1,1) the bottom-right. They describe pose intent, not exact art.
export const WALK_POSE_SEQUENCE=Object.freeze([
  freezePose('contact-a','contact',{
    head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftHand:[.34,.48],rightHand:[.66,.44],leftFoot:[.37,.88],rightFoot:[.65,.82]
  }),
  freezePose('passing-a','passing',{
    head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftHand:[.40,.44],rightHand:[.61,.50],leftFoot:[.46,.84],rightFoot:[.57,.88]
  }),
  freezePose('contact-b','opposite-contact',{
    head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftHand:[.66,.44],rightHand:[.34,.48],leftFoot:[.65,.82],rightFoot:[.37,.88]
  }),
  freezePose('passing-b','passing',{
    head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftHand:[.61,.50],rightHand:[.40,.44],leftFoot:[.57,.88],rightFoot:[.46,.84]
  })
]);

export const IDLE_POSE_SEQUENCE=Object.freeze([
  freezePose('idle-a','neutral',{head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftFoot:[.43,.87],rightFoot:[.57,.87]}),
  freezePose('idle-b','breath-up',{head:[.50,.17],chest:[.50,.37],hips:[.50,.58],leftFoot:[.43,.87],rightFoot:[.57,.87]}),
  freezePose('idle-c','neutral',{head:[.50,.18],chest:[.50,.38],hips:[.50,.58],leftFoot:[.43,.87],rightFoot:[.57,.87]}),
  freezePose('idle-d','breath-down',{head:[.50,.19],chest:[.50,.39],hips:[.50,.58],leftFoot:[.43,.87],rightFoot:[.57,.87]})
]);

export const POSE_TEMPLATES=Object.freeze({walk:WALK_POSE_SEQUENCE,idle:IDLE_POSE_SEQUENCE});

export function getPoseSequence(action='walk'){
  const key=String(action||'walk').trim().toLowerCase();
  return POSE_TEMPLATES[key]||WALK_POSE_SEQUENCE;
}

export function serializePoseSequence(action='walk'){
  return JSON.stringify({version:1,action:String(action||'walk').toLowerCase(),frames:getPoseSequence(action)});
}

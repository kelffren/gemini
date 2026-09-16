/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / POSE TEMPLATES
 * owner: canonical animation skeleton plans for Sprite AI V3
 * purpose: provide deterministic normalized joints that can drive a real pose backend without coupling the compiler to one model
 * does-not-own: model inference, image pixels, gameplay animation timing
 */

export const SPRITE_DIRECTIONS=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);
export const SKELETON_SCHEMA='kelo-biped-v2';
export const SKELETON_JOINTS=Object.freeze(['head','neck','leftShoulder','rightShoulder','leftElbow','rightElbow','leftHand','rightHand','chest','hips','leftHip','rightHip','leftKnee','rightKnee','leftFoot','rightFoot']);

const freezePose=(name,phase,keypoints)=>Object.freeze({schema:SKELETON_SCHEMA,name,phase,keypoints:Object.freeze(keypoints)});

// Coordinates are normalized to one sprite cell: (0,0) top-left, (1,1) bottom-right.
// The richer joint set maps deterministically to an OpenPose-style control image on the
// inference backend. Legacy aliases (head/chest/hips/hands/feet) remain present.
export const WALK_POSE_SEQUENCE=Object.freeze([
  freezePose('contact-a','contact',{
    head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.36,.40],rightElbow:[.64,.38],leftHand:[.31,.49],rightHand:[.68,.45],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.41,.72],rightKnee:[.60,.73],leftFoot:[.34,.88],rightFoot:[.66,.83]
  }),
  freezePose('passing-a','passing',{
    head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.39,.39],rightElbow:[.61,.42],leftHand:[.38,.45],rightHand:[.63,.51],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.47,.72],rightKnee:[.56,.73],leftFoot:[.46,.84],rightFoot:[.58,.88]
  }),
  freezePose('contact-b','opposite-contact',{
    head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.36,.38],rightElbow:[.64,.40],leftHand:[.68,.45],rightHand:[.31,.49],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.60,.73],rightKnee:[.41,.72],leftFoot:[.66,.83],rightFoot:[.34,.88]
  }),
  freezePose('passing-b','passing',{
    head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.39,.42],rightElbow:[.61,.39],leftHand:[.63,.51],rightHand:[.38,.45],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.56,.73],rightKnee:[.47,.72],leftFoot:[.58,.88],rightFoot:[.46,.84]
  })
]);

export const IDLE_POSE_SEQUENCE=Object.freeze([
  freezePose('idle-a','neutral',{head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.39,.42],rightElbow:[.61,.42],leftHand:[.38,.54],rightHand:[.62,.54],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.44,.73],rightKnee:[.56,.73],leftFoot:[.42,.87],rightFoot:[.58,.87]}),
  freezePose('idle-b','breath-up',{head:[.50,.15],neck:[.50,.26],leftShoulder:[.41,.30],rightShoulder:[.59,.30],leftElbow:[.39,.41],rightElbow:[.61,.41],leftHand:[.38,.53],rightHand:[.62,.53],chest:[.50,.38],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.44,.73],rightKnee:[.56,.73],leftFoot:[.42,.87],rightFoot:[.58,.87]}),
  freezePose('idle-c','neutral',{head:[.50,.16],neck:[.50,.27],leftShoulder:[.41,.31],rightShoulder:[.59,.31],leftElbow:[.39,.42],rightElbow:[.61,.42],leftHand:[.38,.54],rightHand:[.62,.54],chest:[.50,.39],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.44,.73],rightKnee:[.56,.73],leftFoot:[.42,.87],rightFoot:[.58,.87]}),
  freezePose('idle-d','breath-down',{head:[.50,.17],neck:[.50,.28],leftShoulder:[.41,.32],rightShoulder:[.59,.32],leftElbow:[.39,.43],rightElbow:[.61,.43],leftHand:[.38,.55],rightHand:[.62,.55],chest:[.50,.40],hips:[.50,.58],leftHip:[.45,.59],rightHip:[.55,.59],leftKnee:[.44,.73],rightKnee:[.56,.73],leftFoot:[.42,.87],rightFoot:[.58,.87]})
]);

export const POSE_TEMPLATES=Object.freeze({walk:WALK_POSE_SEQUENCE,idle:IDLE_POSE_SEQUENCE});

export function getPoseSequence(action='walk'){
  const key=String(action||'walk').trim().toLowerCase();
  return POSE_TEMPLATES[key]||WALK_POSE_SEQUENCE;
}

export function buildPosePayload(action='walk'){
  return Object.freeze({schema:SKELETON_SCHEMA,version:2,action:String(action||'walk').toLowerCase(),frames:getPoseSequence(action)});
}

export function serializePoseSequence(action='walk'){
  return JSON.stringify(buildPosePayload(action));
}

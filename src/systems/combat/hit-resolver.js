/* KELO-INDEX
 * area: COMBAT
 * keys: HIT RESOLVER RANGE GEOMETRY PURE
 * hace: resuelve geometría/alcance sin mutar HP, cooldown, visuals o UI
 */
(function (root) {
  'use strict';

  const VERSION = 'hit-resolver-v1.0.0';
  function point(entity) {
    return { x:Number(entity && entity.x) || 0, y:Number(entity && entity.y) || 0 };
  }
  function distance(a,b) {
    const p=point(a),q=point(b); return Math.hypot(p.x-q.x,p.y-q.y);
  }
  function withinRange(attacker,target,range) {
    const r=Math.max(0,Number(range)||0),d=distance(attacker,target);
    return Object.freeze({ hit:d<=r, distance:d, range:r, reason:d<=r?null:'OUT_OF_RANGE' });
  }

  root.KELO_HIT_RESOLVER_AUDIT={version:VERSION,ready:true,pure:true,gameplayMutation:false};
  root.KeloHitResolver=Object.freeze({version:VERSION,point:point,distance:distance,withinRange:withinRange});
})(typeof globalThis !== 'undefined' ? globalThis : window);

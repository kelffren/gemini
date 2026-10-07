/* KELO-INDEX
 * area: WORLD / MAP FORGE / AUTHORED CITY
 * purpose: visual reset baseline; authored visual composition intentionally empty
 * note: gameplay/map systems remain intact while the visual direction is rebuilt
 */
export const KELO_AUTHORED_CAPITAL_QUARTER=Object.freeze({
  version:'visual-reset-v1',
  bounds:Object.freeze({x:0,y:0,w:0,h:0}),
  spawn:null,
  roads:Object.freeze([]),
  landmarks:Object.freeze([]),
  placements:Object.freeze([])
});

export function applyAuthoredCapitalQuarter(parts){
  return parts;
}

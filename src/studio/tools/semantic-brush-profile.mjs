/* KELO-INDEX
 * area: STUDIO / SEMANTIC BRUSH PROFILE
 * owner: Kelo World Building
 * keys: SEMANTIC BRUSH ROLE WEIGHT DENSITY PRESET CANOPY UNDERSTORY DETAIL ROADSIDE WATERSIDE STRUCTURE
 * owns: pure classification and deterministic semantic palette descriptors
 * does-not-own: placement, input, history, authority, downloads or rendering
 * public-api: inferSemanticRole(), buildSemanticPalette(), applySemanticPreset(), semanticPresetLabel()
 * online: no
 */

export const SEMANTIC_ROLES=Object.freeze(['canopy','understory','detail','roadside','waterside','structure','generic']);
export const SEMANTIC_PRESETS=Object.freeze(['balanced','principal','filler','detail']);

const ROLE_RULES=Object.freeze([
  ['canopy',/\b(tree|trees|oak|pine|birch|willow|palm|maple|cedar|trunk|canopy|arbol|árbol|pino|roble|palmera)\b/i],
  ['understory',/\b(bush|shrub|fern|hedge|grass|weed|vine|moss|bamboo|arbusto|helecho|seto|pasto|hierba|musgo)\b/i],
  ['waterside',/\b(reed|lily|lotus|water|river|pond|coral|kelp|driftwood|cattail|junco|nenufar|nenúfar|rio|río|agua)\b/i],
  ['roadside',/\b(lamp|lantern|bench|sign|fence|post|bollard|barrel|crate|cart|farol|banco|letrero|señal|senal|valla|cerca|poste|barril|caja)\b/i],
  ['structure',/\b(house|home|building|wall|door|roof|tower|bridge|gate|arch|shop|castle|casa|edificio|pared|puerta|techo|torre|puente|porton|portón|arco|tienda|castillo)\b/i],
  ['detail',/\b(flower|flowers|rock|stone|pebble|mushroom|stump|log|debris|leaf|leaves|bone|skull|flowerbed|flor|flores|roca|piedra|hongo|seta|tronco|hoja|hojas|escombro)\b/i]
]);

const ROLE_DEFAULTS=Object.freeze({
  canopy:{weight:1,scaleMin:.9,scaleMax:1.15,spacingScale:1.28,radiusScale:1,rotations:[0]},
  understory:{weight:1.1,scaleMin:.85,scaleMax:1.12,spacingScale:.82,radiusScale:.9,rotations:[0]},
  detail:{weight:1.25,scaleMin:.8,scaleMax:1.18,spacingScale:.62,radiusScale:1.05,rotations:[0,90,180,270]},
  roadside:{weight:.9,scaleMin:.95,scaleMax:1.05,spacingScale:1,radiusScale:.55,rotations:[0,180]},
  waterside:{weight:.95,scaleMin:.9,scaleMax:1.08,spacingScale:.78,radiusScale:.65,rotations:[0]},
  structure:{weight:.55,scaleMin:1,scaleMax:1,spacingScale:1.7,radiusScale:.35,rotations:[0,90,180,270]},
  generic:{weight:1,scaleMin:.9,scaleMax:1.1,spacingScale:1,radiusScale:.8,rotations:[0]}
});

const PRESET_MULTIPLIERS=Object.freeze({
  balanced:{canopy:1,understory:1,detail:1,roadside:1,waterside:1,structure:1,generic:1},
  principal:{canopy:1.75,understory:.55,detail:.35,roadside:.85,waterside:.75,structure:1.65,generic:.8},
  filler:{canopy:.45,understory:1.55,detail:1.25,roadside:.9,waterside:1.05,structure:.25,generic:1},
  detail:{canopy:.12,understory:.75,detail:2.35,roadside:1.2,waterside:1.1,structure:.08,generic:.65}
});

const clean=value=>String(value??'').replace(/[_/\-]+/g,' ').trim();
const tokensFor=row=>[
  row?.label,row?.name,row?.category,row?.family,row?.source,row?.semanticRole,
  ...(Array.isArray(row?.tags)?row.tags:[]),
  ...(Array.isArray(row?.keywords)?row.keywords:[])
].map(clean).filter(Boolean).join(' ');

export function inferSemanticRole(row={}){
  const explicit=clean(row?.semanticRole||row?.role).toLowerCase();
  if(SEMANTIC_ROLES.includes(explicit))return explicit;
  const hay=tokensFor(row);
  for(const [role,rule] of ROLE_RULES)if(rule.test(hay))return role;
  return 'generic';
}

export function semanticDefaults(role='generic'){
  const key=SEMANTIC_ROLES.includes(String(role))?String(role):'generic';
  const row=ROLE_DEFAULTS[key]||ROLE_DEFAULTS.generic;
  return {...row,rotations:[...(row.rotations||[0])]};
}

export function buildSemanticDescriptor(row={},overrides={}){
  const role=inferSemanticRole({...row,...overrides});
  const base=semanticDefaults(role);
  const weight=Number(overrides.weight??row.weight??base.weight);
  const scaleMin=Number(overrides.scaleMin??row.scaleMin??base.scaleMin);
  const scaleMax=Number(overrides.scaleMax??row.scaleMax??base.scaleMax);
  const rotations=Array.isArray(overrides.rotations)?overrides.rotations:Array.isArray(row.rotations)?row.rotations:base.rotations;
  return Object.freeze({
    id:String(overrides.id??row.id??''),
    role,
    weight:Number.isFinite(weight)&&weight>0?weight:base.weight,
    scaleMin:Math.max(.1,Math.min(8,Number.isFinite(scaleMin)?scaleMin:base.scaleMin)),
    scaleMax:Math.max(.1,Math.min(8,Number.isFinite(scaleMax)?scaleMax:base.scaleMax)),
    spacingScale:Math.max(.25,Math.min(4,Number(overrides.spacingScale??row.spacingScale??base.spacingScale)||1)),
    radiusScale:Math.max(.1,Math.min(2,Number(overrides.radiusScale??row.radiusScale??base.radiusScale)||1)),
    rotations:[...new Set((rotations||[0]).map(v=>Math.round((Number(v)||0)/90)*90))].slice(0,4)
  });
}

export function buildSemanticPalette(rows=[]){
  const out=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const descriptor=buildSemanticDescriptor(row);
    if(descriptor.id)out.push(descriptor);
  }
  return out;
}

export function normalizeSemanticPreset(value='balanced'){
  const preset=String(value||'balanced').toLowerCase();
  return SEMANTIC_PRESETS.includes(preset)?preset:'balanced';
}

export function applySemanticPreset(entry,preset='balanced'){
  const role=SEMANTIC_ROLES.includes(entry?.role)?entry.role:'generic';
  const key=normalizeSemanticPreset(preset),multiplier=PRESET_MULTIPLIERS[key]?.[role]??1;
  return Math.max(.001,(Number(entry?.weight)||1)*multiplier);
}

export function semanticPresetLabel(value='balanced'){
  switch(normalizeSemanticPreset(value)){
    case'principal':return'PRINCIPAL';
    case'filler':return'RELLENO';
    case'detail':return'DETALLE';
    default:return'AUTO';
  }
}

export function semanticRoleCounts(entries=[]){
  const counts=Object.fromEntries(SEMANTIC_ROLES.map(role=>[role,0]));
  for(const entry of Array.isArray(entries)?entries:[])counts[SEMANTIC_ROLES.includes(entry?.role)?entry.role:'generic']++;
  return counts;
}

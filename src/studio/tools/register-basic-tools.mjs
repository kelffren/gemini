/* KELO-INDEX
 * area: STUDIO / BASIC TOOLS
 * owns: registration of baseline reusable tools
 * does-not-own: UI
 * public-api: registerBasicTools()
 * online: no
 */

import { createSelectTool } from './select-tool.mjs';
import { createMarqueeSelectTool } from './marquee-select-tool.mjs';
import { createPlacementTool } from './placement-tool.mjs';
import { createTransformTool } from './transform-tool.mjs';
import { createTerrainTool } from './terrain-tool.mjs';
import { createCollisionTool } from './collision-tool.mjs';
import { createPrefabStampTool } from './prefab-stamp-tool.mjs';

export function registerBasicTools(kernel) {
  const select=createSelectTool(kernel),marquee=createMarqueeSelectTool(kernel),placement=createPlacementTool(kernel),transform=createTransformTool(kernel),terrain=createTerrainTool(kernel),collision=createCollisionTool(kernel),prefabStamp=createPrefabStampTool(kernel);
  for(const tool of [select,marquee,placement,transform,terrain,collision,prefabStamp])if(!kernel.tools.get(tool.id))kernel.tools.register(tool);
  return Object.freeze({select,marquee,placement,transform,terrain,collision,prefabStamp});
}

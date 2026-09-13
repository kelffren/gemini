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
import { createPaintCopiesTool } from './paint-copies-tool.mjs';
import { createQuickBuildTool } from './quick-build-tool.mjs';

export function registerBasicTools(kernel) {
  const select=createSelectTool(kernel),marquee=createMarqueeSelectTool(kernel),placement=createPlacementTool(kernel),transform=createTransformTool(kernel),terrain=createTerrainTool(kernel),collision=createCollisionTool(kernel),prefabStamp=createPrefabStampTool(kernel),paintCopies=createPaintCopiesTool(kernel);
  for(const tool of [select,marquee,placement,transform,terrain,collision,prefabStamp,paintCopies])if(!kernel.tools.get(tool.id))kernel.tools.register(tool);
  const quickBuild=createQuickBuildTool(kernel,{placement});
  if(!kernel.tools.get(quickBuild.id))kernel.tools.register(quickBuild);
  return Object.freeze({select,marquee,placement,transform,terrain,collision,prefabStamp,paintCopies,quickBuild});
}

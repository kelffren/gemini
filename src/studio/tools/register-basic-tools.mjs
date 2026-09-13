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
import { createRoomBuildTool } from './room-build-tool.mjs';
import { createRoomOpeningTool } from './room-opening-tool.mjs';

export function registerBasicTools(kernel) {
  const select=createSelectTool(kernel),marquee=createMarqueeSelectTool(kernel),placement=createPlacementTool(kernel),transform=createTransformTool(kernel),terrain=createTerrainTool(kernel),collision=createCollisionTool(kernel),prefabStamp=createPrefabStampTool(kernel),paintCopies=createPaintCopiesTool(kernel);
  for(const tool of [select,marquee,placement,transform,terrain,collision,prefabStamp,paintCopies])if(!kernel.tools.get(tool.id))kernel.tools.register(tool);
  let quickBuild=kernel.tools.get('quickBuild');
  if(!quickBuild){quickBuild=createQuickBuildTool(kernel,{placement});kernel.tools.register(quickBuild);}
  let roomBuild=kernel.tools.get('roomBuild');
  if(!roomBuild){roomBuild=createRoomBuildTool(kernel,{placement,quickBuild});kernel.tools.register(roomBuild);}
  let roomOpening=kernel.tools.get('roomOpening');
  if(!roomOpening){roomOpening=createRoomOpeningTool(kernel);kernel.tools.register(roomOpening);}
  return Object.freeze({select,marquee,placement,transform,terrain,collision,prefabStamp,paintCopies,quickBuild,roomBuild,roomOpening});
}

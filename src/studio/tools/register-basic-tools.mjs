/* KELO-INDEX
 * area: STUDIO / BASIC TOOLS
 * owns: registration of baseline reusable tools
 * does-not-own: UI
 * public-api: registerBasicTools()
 * online: no
 */

import { createSelectTool } from './select-tool.mjs';
import { createPlacementTool } from './placement-tool.mjs';
import { createTransformTool } from './transform-tool.mjs';
import { createTerrainTool } from './terrain-tool.mjs';
import { createCollisionTool } from './collision-tool.mjs';

export function registerBasicTools(kernel) {
  const select = createSelectTool(kernel), placement = createPlacementTool(kernel), transform = createTransformTool(kernel), terrain = createTerrainTool(kernel), collision = createCollisionTool(kernel);
  for (const tool of [select, placement, transform, terrain, collision]) if (!kernel.tools.get(tool.id)) kernel.tools.register(tool);
  return Object.freeze({ select, placement, transform, terrain, collision });
}

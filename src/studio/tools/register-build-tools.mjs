/* KELO-INDEX
 * area: STUDIO / BUILD TOOLS
 * owns: paint-copies, quick-build and room tools loaded after World chrome
 * does-not-own: select/placement core, live shell, authority
 * public-api: registerBuildTools()
 * reuse: registerBasicTools() composes this after registerCoreTools()
 * mobile: kept off the first Studio request wave so iPhone can keep the launch chrome
 * online: no
 */
import { createPaintCopiesTool } from './paint-copies-tool.mjs';
import { createQuickBuildTool } from './quick-build-tool.mjs';
import { createRoomBuildTool } from './room-build-tool.mjs';
import { createRoomOpeningTool } from './room-opening-tool.mjs';
import { createRoomMaterialTool } from './room-material-tool.mjs';

export function registerBuildTools(kernel,core={}){
  const placement=core.placement||kernel.tools.get('placement');
  let paintCopies=kernel.tools.get('paintCopies');
  if(!paintCopies){paintCopies=createPaintCopiesTool(kernel);kernel.tools.register(paintCopies);}
  let quickBuild=kernel.tools.get('quickBuild');
  if(!quickBuild){quickBuild=createQuickBuildTool(kernel,{placement});kernel.tools.register(quickBuild);}
  let roomBuild=kernel.tools.get('roomBuild');
  if(!roomBuild){roomBuild=createRoomBuildTool(kernel,{placement,quickBuild});kernel.tools.register(roomBuild);}
  let roomOpening=kernel.tools.get('roomOpening');
  if(!roomOpening){roomOpening=createRoomOpeningTool(kernel);kernel.tools.register(roomOpening);}
  let roomMaterial=kernel.tools.get('roomMaterial');
  if(!roomMaterial){roomMaterial=createRoomMaterialTool(kernel);kernel.tools.register(roomMaterial);}
  return {paintCopies,quickBuild,roomBuild,roomOpening,roomMaterial};
}

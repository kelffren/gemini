/* KELO-INDEX
 * area: STUDIO / CORE TOOLS / SERIAL
 * owner: Kelo Studio phone-safe core tool registration
 * keys: STUDIO MOBILE CORE TOOLS PAINT COPIES SCENE PAINTER SURGERY LAZY
 * owns: phone World-open tool registration without a static tool barrel, plus the tiny early Scene Painter capability needed for mobile editing
 * does-not-own: desktop/audit sync registerCoreTools(), Scene Painter behavior, Studio shell behavior or world authority
 * public-api: registerCoreToolsSerial()
 * mobile: each await import() happens between paint yields so Safari never evaluates the full tool graph as one unit; Paint Copies is the only optional build tool promoted into this early wave
 * surgery: Paint Copies still obeys Basic / Build Tools + Paint Copies kill switches before its module is imported
 * online: no; Scene Painter commits continue through Studio Kernel commands / authority mirror
 */
function pick(kernel,id,create){
  const existing=kernel.tools.get(id);
  if(existing)return existing;
  const tool=create();
  kernel.tools.register(tool);
  return tool;
}

function scenePainterEnabled(root=globalThis){
  const surgery=root?.KELO_WORLD_SURGERY;
  return surgery?.enabled?.('basicTools')!==false&&surgery?.enabled?.('paintCopies')!==false;
}

function exposeEarlyScenePainterSlot(root=globalThis){
  const shell=root?.document?.getElementById?.('kelo-studio-live');
  const slot=shell?.querySelector?.('.ks-productivity-edit-slot');
  if(!slot)return false;
  // The shell already owns this extension slot. Alias it to the selector consumed by
  // Paint Copies so Scene Painter does not wait for the 22s productivity-panel wave.
  slot.classList.add('ks-ext-edit');
  slot.dataset.keloScenePainterSlot='early';
  return true;
}

async function registerEarlyScenePainter(kernel,{wait=async()=>{},root=globalThis}={}){
  const surgery=root?.KELO_WORLD_SURGERY;
  if(!scenePainterEnabled(root)){
    surgery?.moduleDisabled?.('paintCopies','CORE_TOOLS_SERIAL_EARLY:switch-off');
    return kernel.tools.get('paintCopies')||null;
  }
  const existing=kernel.tools.get('paintCopies');
  if(existing)return existing;
  const started=surgery?.moduleStart?.('paintCopies','CORE_TOOLS_SERIAL_EARLY');
  try{
    exposeEarlyScenePainterSlot(root);
    const paintMod=await import('./paint-copies-tool.mjs');
    await wait();
    exposeEarlyScenePainterSlot(root);
    const tool=pick(kernel,'paintCopies',()=>paintMod.createPaintCopiesTool(kernel));
    surgery?.moduleDone?.('paintCopies',started);
    return tool;
  }catch(error){
    surgery?.moduleFailed?.('paintCopies',error);
    throw error;
  }
}

export async function registerCoreToolsSerial(kernel,{wait=async()=>{}}={}){
  const selectMod=await import('./select-tool.mjs');await wait();
  const marqueeMod=await import('./marquee-select-tool.mjs');await wait();
  const placementMod=await import('./placement-tool.mjs');await wait();
  const transformMod=await import('./transform-tool.mjs');await wait();
  const terrainMod=await import('./terrain-tool.mjs');await wait();
  const collisionMod=await import('./collision-tool.mjs');await wait();
  const prefabMod=await import('./prefab-stamp-tool.mjs');await wait();

  const tools={
    select:pick(kernel,'select',()=>selectMod.createSelectTool(kernel)),
    marquee:pick(kernel,'marquee',()=>marqueeMod.createMarqueeSelectTool(kernel)),
    placement:pick(kernel,'placement',()=>placementMod.createPlacementTool(kernel)),
    transform:pick(kernel,'transform',()=>transformMod.createTransformTool(kernel)),
    terrain:pick(kernel,'terrain',()=>terrainMod.createTerrainTool(kernel)),
    collision:pick(kernel,'collision',()=>collisionMod.createCollisionTool(kernel)),
    prefabStamp:pick(kernel,'prefabStamp',()=>prefabMod.createPrefabStampTool(kernel))
  };

  // Scene Painter is small enough to load in the phone-safe early wave and is
  // useless if it appears only after the full optional-build delay. The later
  // build-tools pass reuses this registered instance and therefore does not
  // duplicate listeners, commands or UI.
  tools.paintCopies=await registerEarlyScenePainter(kernel,{wait,root:globalThis});
  return tools;
}

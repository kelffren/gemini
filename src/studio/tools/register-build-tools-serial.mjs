/* KELO-INDEX
 * area: STUDIO / BUILD TOOLS SERIAL
 * owner: Kelo Studio Build Tool Registration
 * keys: STUDIO MOBILE BUILD PAINT COPIES QUICK EDIT ROOM SURGERY LAZY
 * owns: phone-safe registration of paint/quick/edit/room tools without a static barrel spike
 * does-not-own: core tools, live shell or tool behavior
 * public-api: registerBuildToolsSerial()
 * mobile: imported only after chrome; each enabled tool module loads between yields
 * surgery: disabled modules are never imported, so a kill switch prevents side effects
 * online: no
 */

const surgery=()=>globalThis.KELO_WORLD_SURGERY||null;
const enabled=key=>surgery()?.enabled?.(key)!==false;
const disabled=(key,reason='switch-off')=>surgery()?.moduleDisabled?.(key,`BUILD_TOOLS_SERIAL:${reason}`);

export async function registerBuildToolsSerial(kernel,core={},{wait=async()=>{}}={}){
  const placement=core.placement||kernel.tools.get('placement');
  const out={paintCopies:null,quickBuild:null,quickEdit:null,roomBuild:null,roomOpening:null,roomMaterial:null};
  if(!enabled('basicTools')){
    for(const key of Object.keys(out))disabled(key,'basicTools-master-off');
    return Object.freeze(out);
  }

  const ensure=async(id,path,factory,{requires=[]}={})=>{
    let tool=kernel.tools.get(id);
    if(tool){out[id]=tool;return tool;}
    if(!enabled(id)){disabled(id);return null;}
    for(const dependency of requires){if(!dependency){disabled(id,'dependency-off');return null;}}
    const S=surgery(),started=S?.moduleStart?.(id,'BUILD_TOOLS_SERIAL');
    try{
      const mod=await import(path);await wait();
      tool=factory(mod);kernel.tools.register(tool);out[id]=tool;
      S?.moduleDone?.(id,started);await wait();return tool;
    }catch(error){S?.moduleFailed?.(id,error);throw error;}
  };

  const paintCopies=await ensure('paintCopies','./paint-copies-tool.mjs',m=>m.createPaintCopiesTool(kernel));
  const quickBuild=await ensure('quickBuild','./quick-build-tool.mjs',m=>m.createQuickBuildTool(kernel,{placement}));
  const quickEdit=await ensure('quickEdit','./quick-edit-tool.mjs',m=>m.createQuickEditTool(kernel,{quickBuild}),{requires:[quickBuild]});
  const roomBuild=await ensure('roomBuild','./room-build-tool.mjs',m=>m.createRoomBuildTool(kernel,{placement,quickBuild}),{requires:[quickBuild]});
  const roomOpening=await ensure('roomOpening','./room-opening-tool.mjs',m=>m.createRoomOpeningTool(kernel));
  const roomMaterial=await ensure('roomMaterial','./room-material-tool.mjs',m=>m.createRoomMaterialTool(kernel));
  return Object.freeze({paintCopies,quickBuild,quickEdit,roomBuild,roomOpening,roomMaterial});
}

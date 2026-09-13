/* KELO-INDEX
 * area: CREATORS / IMAGE LAB WORKSPACE
 * owner: Kelo Creator Assets workspace manifest only
 * keys: IMAGE LAB WORKSPACE NONDESTRUCTIVE CONVERTER
 * owns: lazy route from Creator Hub into Image Lab
 * does-not-own: image rendering, binary storage, project semantics, runtime assets or publishing
 */
export function createImageLabWorkspaceManifest({loader=()=>import('../ui/image-lab-workspace.mjs')}={}){
  return Object.freeze({
    id:'image-lab',label:'Image Lab',category:'visual',projectTypes:[],capability:null,availability:'active',
    async open(context={}){const module=await loader();if(typeof module.openImageLabWorkspace!=='function')throw new Error('CREATOR_IMAGE_LAB_ENTRY_MISSING');return module.openImageLabWorkspace(context);}
  });
}
export function registerImageLabWorkspace(registry,options={}){return registry.register(createImageLabWorkspaceManifest(options));}

/* KELO-INDEX
 * area: CREATORS / IMAGE LAB WORKSPACE
 * owner: Kelo Creators workspace registry adapter
 * keys: IMAGE LAB CREATOR WORKSPACE LAZY PHOTO PREP
 * purpose: route Kelo Creators into the existing Image Lab without adding a second image editor
 * public-api: createImageLabWorkspaceManifest, registerImageLabWorkspace
 * consumes: creator workspace registry + src/creators/ui/image-lab-workspace.mjs
 * state-owned: none
 * extension-points: Image Lab UI/asset pipeline owns image operations
 * reuse: Creator Library tool routing
 * online: authoring remains local/private; publish authority is separate
 * do-not: do not duplicate Image Lab tools or load them during normal game boot
 */
export function createImageLabWorkspaceManifest({loader=()=>import('../ui/image-lab-workspace.mjs')}={}){
  return Object.freeze({
    id:'image-lab',label:'Image Lab',category:'visual',projectTypes:[],capability:null,availability:'active',
    async open(context={}){
      const mod=await loader();
      if(typeof mod.openImageLabWorkspace!=='function')throw new Error('CREATOR_IMAGE_LAB_ENTRY_MISSING');
      return mod.openImageLabWorkspace(context);
    }
  });
}
export function registerImageLabWorkspace(registry,options={}){return registry.register(createImageLabWorkspaceManifest(options));}

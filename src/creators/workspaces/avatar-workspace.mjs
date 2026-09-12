/* KELO-INDEX
 * area: CREATORS / AVATAR WORKSPACE
 * owner: Avatar Quick Import + Frame Surgery workspace manifest only
 * owns: lazy route into finger-first avatar upload/repair/preview/use UI
 * does-not-own: rendering, upload transport or character persistence
 */
export function createAvatarWorkspaceManifest({loader=()=>import('../ui/avatar-frame-surgery-workspace.mjs')}={}){return Object.freeze({id:'avatar',label:'Avatar',category:'visual',projectTypes:['CHARACTER'],capability:null,availability:'active',isSessionAlive(session,{root=globalThis}={}){const shell=session?.shell;return !!(shell?.isConnected&&root.document?.getElementById?.('kelo-avatar-quick')===shell);},async open(context={}){const mod=await loader();if(typeof mod.openAvatarQuickImport!=='function')throw new Error('CREATOR_AVATAR_ENTRY_MISSING');return mod.openAvatarQuickImport(context);}});}
export function registerAvatarWorkspace(registry,options={}){return registry.register(createAvatarWorkspaceManifest(options));}
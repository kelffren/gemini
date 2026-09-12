/* KELO-INDEX
 * area: CREATORS / AVATAR WORKSPACE
 * owner: Avatar Quick Import workspace manifest only
 * owns: lazy route into avatar upload/preview/use UI and optional 4x4 frame-builder entry composition
 * does-not-own: rendering, upload transport or character persistence
 */
export function createAvatarWorkspaceManifest({loader=()=>import('../ui/avatar-workspace.mjs'),builderHookLoader=()=>import('../ui/avatar-frame-builder-hook.mjs')}={}){return Object.freeze({id:'avatar',label:'Avatar',category:'visual',projectTypes:['CHARACTER'],capability:null,availability:'active',isSessionAlive(session,{root=globalThis}={}){const shell=session?.shell;return !!(shell?.isConnected&&root.document?.getElementById?.('kelo-avatar-quick')===shell);},async open(context={}){const mod=await loader();if(typeof mod.openAvatarQuickImport!=='function')throw new Error('CREATOR_AVATAR_ENTRY_MISSING');const session=await mod.openAvatarQuickImport(context);try{const hook=await builderHookLoader();const entry=hook.installAvatarFrameBuilderEntry?.({...context,session});const previousClose=session?.close;return Object.freeze({...session,close(){try{entry?.dispose?.();}catch{}return previousClose?.();}});}catch(error){console.warn('[Avatar] frame builder entry unavailable',error);return session;}}});}
export function registerAvatarWorkspace(registry,options={}){return registry.register(createAvatarWorkspaceManifest(options));}

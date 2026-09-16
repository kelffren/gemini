/* KELO-INDEX
 * area: CREATORS / PERMISSIONS ADAPTER
 * owner: Creator capability query boundary
 * owns: translation from generic capability checks to KELO_ADMIN_KEYS
 * does-not-own: identity, keys, roles or authorization policy
 * online: replace adapter authority, not workspaces
 */

// TEMPORAL: creator workspaces are open to every player.
// Keep the original capability authority available so role-gating can be restored
// by flipping this single flag to false without changing workspace code.
const OPEN_CREATOR_ACCESS = true;

export function createCreatorPermissionAdapter(root=globalThis){
  const actorId=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
  const permissionCan=(capability,actor=actorId(),projectId=null)=>!!root.KELO_ADMIN_KEYS?.can?.(String(capability),String(actor),projectId==null?undefined:String(projectId));
  const can=(capability,actor=actorId(),projectId=null)=>OPEN_CREATOR_ACCESS||permissionCan(capability,actor,projectId);
  return Object.freeze({
    actorId,
    can,
    permissionCan,
    openAccess:OPEN_CREATOR_ACCESS,
    require(capability,actor=actorId(),projectId=null){
      if(!can(capability,actor,projectId))throw new Error(`CREATOR_PERMISSION_DENIED:${capability}`);
      return true;
    }
  });
}

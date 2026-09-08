/* KELO-INDEX
 * area: CREATORS / WORLD COMPATIBILITY ADAPTER
 * owner: mapping existing World Draft/Revision semantics into CreatorProject boundary
 * owns: mapping only
 * does-not-own: World drafts, revisions, placements, terrain, collisions or publishing
 * consumes: KELO_WORLD_EDIT; no second World authority
 */
import { normalizeCreatorProject } from '../core/creator-project.mjs';
const WORLD_PROJECT_ID='world:kelo-main';
const mapStatus=status=>({DRAFT:'TEAM_DRAFT',SUBMITTED:'IN_REVIEW',APPROVED:'APPROVED',REJECTED:'CHANGES_REQUESTED',PUBLISHED:'PUBLISHED',DISCARDED:'ARCHIVED'}[String(status||'').toUpperCase()]||'TEAM_DRAFT');
const revisionIdOf=d=>d?.publishedRevisionId||d?.revisionId||d?.baseRevisionId||null;
export function createWorldCreatorAdapter({root=globalThis,permission=null}={}){
  const actor=()=>String(permission?.actorId?.()||root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
  const allowed=()=>permission?.can?permission.can('world.edit',actor(),WORLD_PROJECT_ID):!!root.KELO_ADMIN_KEYS?.can?.('world.edit',actor());
  async function current(){if(!root.KELO_WORLD_EDIT?.ready)return null;try{return (await root.KELO_WORLD_EDIT.getCurrentDraft?.())?.draft||null;}catch{return null;}}
  async function project(){const d=await current();return normalizeCreatorProject({projectId:WORLD_PROJECT_ID,type:'WORLD',name:'Kelo World',description:'Main Kelo World creator project',ownerId:actor(),status:mapStatus(d?.status),visibility:d?.status==='PUBLISHED'?'PUBLIC':'TEAM',draftRevisionId:d?.draftId||null,approvedRevisionId:d?.status==='APPROVED'?revisionIdOf(d):null,publishedRevisionId:d?.status==='PUBLISHED'?revisionIdOf(d):null,workspaceSettings:{domain:'world',authority:'KELO_WORLD_EDIT'}});}
  return Object.freeze({
    id:'world-existing-authority',handlesType:type=>String(type).toUpperCase()==='WORLD',
    async list(){return allowed()?[await project()]:[];},
    async get(projectId){return allowed()&&String(projectId)===WORLD_PROJECT_ID?project():null;},
    async create(){if(!allowed())throw new Error('CREATOR_PERMISSION_DENIED:world.edit');return project();},
    async saveDraft(projectId,_document,{draftId=null}={}){if(String(projectId)!==WORLD_PROJECT_ID)throw new Error('CREATOR_WORLD_PROJECT_INVALID');permission?.require?.('world.edit',actor(),WORLD_PROJECT_ID);return root.KELO_WORLD_EDIT.request('world:draft:save',{actorId:actor(),draftId:draftId||undefined});},
    async loadDraft(projectId){if(String(projectId)!==WORLD_PROJECT_ID)throw new Error('CREATOR_WORLD_PROJECT_INVALID');const d=await current();if(!d)return null;return root.KELO_WORLD_EDIT.request('world:draft:get',{actorId:actor(),draftId:d.draftId});},
    async archive(){throw new Error('CREATOR_WORLD_ARCHIVE_UNSUPPORTED');}
  });
}
export { WORLD_PROJECT_ID };

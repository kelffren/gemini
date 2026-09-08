/* KELO-INDEX
 * area: CREATORS / WORKSPACE REGISTRY
 * owner: Creator Workspace registry
 * owns: workspace manifests and lazy open dispatch
 * does-not-own: Studio core, workspace implementation, permissions or networking
 * reused-by: every Creator workspace
 */
export function createCreatorWorkspaceRegistry() {
  const rows=new Map();
  function register(manifest){
    if(!manifest?.id||!manifest?.label||!manifest?.category||!Array.isArray(manifest.projectTypes))throw new Error('CREATOR_WORKSPACE_MANIFEST_INVALID');
    const id=String(manifest.id).toLowerCase();if(rows.has(id))throw new Error(`CREATOR_WORKSPACE_DUPLICATE:${id}`);
    const normalized=Object.freeze({...manifest,id,projectTypes:Object.freeze(manifest.projectTypes.map(v=>String(v).toUpperCase()))});rows.set(id,normalized);return normalized;
  }
  function resolve(id){return rows.get(String(id||'').toLowerCase())||null;}
  function list({category=null}={}){const all=[...rows.values()];return category?all.filter(row=>row.category===category):all;}
  async function open(id,context={}){const row=resolve(id);if(!row)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);if(typeof row.open!=='function')throw new Error(`CREATOR_WORKSPACE_NOT_AVAILABLE:${id}`);return row.open(context);}
  return Object.freeze({register,resolve,list,open,get size(){return rows.size;}});
}

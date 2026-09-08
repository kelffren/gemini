/* KELO-INDEX
 * area: STUDIO / AUTHORITY MIRROR
 * owns: translation of confirmed Studio entity Commands into KELO_WORLD_EDIT operations
 * does-not-own: drag previews, gameplay, draft lifecycle or Property internals
 * public-api: installStudioAuthorityMirror()
 * online: one authority request per confirmed command/history action
 */

const quarter = degrees => ((Math.round((Number(degrees) || 0) / 90) % 4) + 4) % 4;
const placementIdFromEntity = (entity, ids) => ids.get(String(entity?.id || '')) || entity?.source?.authorityPlacementId || entity?.id || null;

export function installStudioAuthorityMirror({ adapter, actorId, getDraftId } = {}) {
  if (!adapter?.installCommandMirror || !adapter?.worldEditRequest) throw new Error('STUDIO_AUTHORITY_ADAPTER_REQUIRED');
  const authorityIds = new Map();
  const draft = () => { const id = getDraftId?.(); if (!id) throw new Error('STUDIO_DRAFT_REQUIRED'); return id; };
  const base = extra => ({ actorId: actorId || undefined, draftId: draft(), ...extra });
  async function create(entity) {
    const result = await adapter.worldEditRequest('world:placement:create', base({ assetId: entity.prefabId, x: Number(entity.transform?.x) || 0, y: Number(entity.transform?.y) || 0, rotation: quarter(entity.transform?.rotation) }));
    const id = result?.placement?.placementId || result?.placementId;
    if (!id) throw new Error('STUDIO_AUTHORITY_PLACEMENT_ID_MISSING');
    authorityIds.set(String(entity.id), String(id));
    return result;
  }
  async function remove(entity) {
    const id = placementIdFromEntity(entity, authorityIds); if (!id) throw new Error('STUDIO_AUTHORITY_PLACEMENT_ID_MISSING');
    return adapter.worldEditRequest('world:placement:remove', base({ placementId: String(id) }));
  }
  async function move(command, target) {
    const id = authorityIds.get(String(command.id)) || command.id; if (!id) throw new Error('STUDIO_AUTHORITY_PLACEMENT_ID_MISSING');
    return adapter.worldEditRequest('world:placement:move', base({ placementId: String(id), x: Number(target?.x) || 0, y: Number(target?.y) || 0 }));
  }
  async function rotate(command, fromRotation, toRotation) {
    const id = authorityIds.get(String(command.id)) || command.id; if (!id) throw new Error('STUDIO_AUTHORITY_PLACEMENT_ID_MISSING');
    const from = quarter(fromRotation), to = quarter(toRotation), delta = ((to - from) % 4 + 4) % 4;
    if (!delta) return null;
    return adapter.worldEditRequest('world:placement:rotate', base({ placementId: String(id), delta }));
  }
  async function mirror(event) {
    const command = event?.command || {}, action = event?.type || 'execute';
    if (!String(command.type || '').startsWith('entity.')) return null;
    if (command.type === 'entity.place') return action === 'undo' ? remove(command.entity) : create(command.entity);
    if (command.type === 'entity.remove') return action === 'undo' ? create(command.entity) : remove(command.entity || { id: command.id });
    if (command.type === 'entity.move') return move(command, action === 'undo' ? command.from : command.to);
    if (command.type === 'entity.patch') {
      const before = command.previous?.transform?.rotation ?? 0, after = command.patch?.transform?.rotation ?? before;
      return action === 'undo' ? rotate(command, after, before) : rotate(command, before, after);
    }
    return null;
  }
  const uninstall = adapter.installCommandMirror(mirror);
  return Object.freeze({ uninstall, authorityIdFor: id => authorityIds.get(String(id)) || null, seed(entityId, placementId) { if (entityId && placementId) authorityIds.set(String(entityId), String(placementId)); }, clear: () => authorityIds.clear() });
}

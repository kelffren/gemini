/* KELO-INDEX
 * area: STUDIO / AUTHORITY MIRROR
 * owns: translation of confirmed Studio Commands into KELO_WORLD_EDIT operations
 * does-not-own: drag previews, gameplay, draft lifecycle, Property internals or collision resolution
 * public-api: installStudioAuthorityMirror()
 * online: one authority request per confirmed command/history action
 */

const quarter = degrees => ((Math.round((Number(degrees) || 0) / 90) % 4) + 4) % 4;
const placementIdFromEntity = (entity, ids) => ids.get(String(entity?.id || '')) || entity?.source?.authorityPlacementId || entity?.id || null;
const surfaceState = value => value == null ? null : (typeof value === 'string' ? { material: value, role: 'terrain' } : value);

export function installStudioAuthorityMirror({ adapter, actorId, getDraftId } = {}) {
  if (!adapter?.installCommandMirror || !adapter?.worldEditRequest) throw new Error('STUDIO_AUTHORITY_ADAPTER_REQUIRED');
  const authorityIds = new Map(), collisionAuthorityIds = new Map();
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
    const result = await adapter.worldEditRequest('world:placement:remove', base({ placementId: String(id) }));
    authorityIds.delete(String(entity?.id || ''));
    return result;
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
  async function applySurface(command, value) {
    const state = surfaceState(value);
    if (!state) return adapter.worldEditRequest('world:tile:clear', base({ x: Number(command.x) || 0, y: Number(command.y) || 0, brushSize: 1 }));
    return adapter.worldEditRequest('world:tile:paint', base({ x: Number(command.x) || 0, y: Number(command.y) || 0, brushSize: 1, material: String(state.material || ''), role: state.role === 'path' ? 'path' : 'terrain' }));
  }
  const collisionAuthorityId = id => collisionAuthorityIds.get(String(id)) || String(id || '');
  async function createCollision(collision) {
    const authoringId = String(collision?.collisionId || collision?.id || ''); if (!authoringId) throw new Error('STUDIO_COLLISION_ID_REQUIRED');
    const result = await adapter.worldEditRequest('world:collision:create', base({ x: Number(collision.x) || 0, y: Number(collision.y) || 0, w: Number(collision.w) || 32, h: Number(collision.h) || 32, label: collision.label || 'Studio Collision' }));
    const authorityId = result?.collision?.collisionId || result?.collisionId;
    if (!authorityId) throw new Error('STUDIO_AUTHORITY_COLLISION_ID_MISSING');
    collisionAuthorityIds.set(authoringId, String(authorityId));
    return result;
  }
  async function removeCollision(collision) {
    const authoringId = String(collision?.collisionId || collision?.id || ''); const id = collisionAuthorityId(authoringId); if (!id) throw new Error('STUDIO_AUTHORITY_COLLISION_ID_MISSING');
    const result = await adapter.worldEditRequest('world:collision:remove', base({ collisionId: id }));
    collisionAuthorityIds.delete(authoringId);
    return result;
  }
  async function moveCollision(command, target) {
    const id = collisionAuthorityId(command.id); if (!id) throw new Error('STUDIO_AUTHORITY_COLLISION_ID_MISSING');
    return adapter.worldEditRequest('world:collision:update', base({ collisionId: id, x: Number(target?.x) || 0, y: Number(target?.y) || 0, w: Number(target?.w) || 32, h: Number(target?.h) || 32 }));
  }
  async function mirror(event) {
    const command = event?.command || {}, action = event?.type || 'execute';
    if (command.type === 'surface.cell') return applySurface(command, action === 'undo' ? command.before : command.after);
    if (command.type === 'collision.create') return action === 'undo' ? removeCollision(command.collision) : createCollision(command.collision);
    if (command.type === 'collision.remove') return action === 'undo' ? createCollision(command.collision) : removeCollision(command.collision || { collisionId: command.id });
    if (command.type === 'collision.move') return moveCollision(command, action === 'undo' ? command.from : command.to);
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
  return Object.freeze({
    uninstall,
    authorityIdFor: id => authorityIds.get(String(id)) || null,
    collisionAuthorityIdFor: id => collisionAuthorityIds.get(String(id)) || null,
    seed(entityId, placementId) { if (entityId && placementId) authorityIds.set(String(entityId), String(placementId)); },
    seedCollision(collisionId, authorityId = collisionId) { if (collisionId && authorityId) collisionAuthorityIds.set(String(collisionId), String(authorityId)); },
    clear() { authorityIds.clear(); collisionAuthorityIds.clear(); }
  });
}

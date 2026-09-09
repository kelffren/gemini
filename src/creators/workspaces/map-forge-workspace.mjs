/* KELO-INDEX
 * area: CREATORS / MAP FORGE WORKSPACE
 * owner: Map Forge workspace manifest only
 * owns: descriptor + lazy routing to Map Forge Creator UI
 * does-not-own: generator core, world renderer, Studio, collision, properties or gameplay
 * public-api: createMapForgeWorkspaceManifest(), registerMapForgeWorkspace()
 */
export function createMapForgeWorkspaceManifest({ loader = () => import('../ui/map-forge-workspace.mjs') } = {}) {
  return Object.freeze({
    id: 'map-forge',
    label: 'Map Forge',
    category: 'build',
    projectTypes: ['WORLD'],
    capability: 'world.edit',
    availability: 'active',
    async open({ root = globalThis } = {}) {
      const mod = await loader();
      if (typeof mod.openMapForgeWorkspace !== 'function') throw new Error('CREATOR_MAP_FORGE_ENTRY_MISSING');
      return mod.openMapForgeWorkspace({ root });
    }
  });
}
export function registerMapForgeWorkspace(registry, options = {}) { return registry.register(createMapForgeWorkspaceManifest(options)); }

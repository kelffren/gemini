from pathlib import Path


def text(path):
    return Path(path).read_text(encoding='utf-8')


env = text('src/environment/environment-layer-stack.js')
engine = text('engine-c.js')
contract = text('src/environment/prop-contract.js')
generic = text('src/environment/generic-props.js')
rural = text('src/environment/rural-ground.js')

checks = {
    'environment stack exposes props_back pre-actor phase': "PRE_ACTOR_PHASES=new Set(['props_back'])" in env,
    'environment stack exposes drawPreActors': 'function drawPreActors(g)' in env and 'drawPreActors,drawPostActors' in env,
    'environment stack reports formal base/back/actor/front mode': "formal-base-back-actor-front-order-v1" in env,
    'engine calls pre-actor pass': 'KELO_WORLD_RENDERER.drawPreActors(ctx)' in engine,
    'pre-actor pass occurs after farm scene': engine.find('renderFarm(STATE.farm)') < engine.find('KELO_WORLD_RENDERER.drawPreActors(ctx)'),
    'pre-actor pass occurs before avatars': engine.find('KELO_WORLD_RENDERER.drawPreActors(ctx)') < engine.find('renderAvatar(arenaPvP.rival'),
    'rural boundary is layer-stack owned': "rural-boundary',ownership:'rural-farm-boundary-props-v1',priority:8,renderMode:'layer-stack'" in contract,
    'rural source exposes dynamic instances': 'instances:function()' in contract and 'buildRuralFarmBoundary(STATE.farm)' in contract,
    'generic renderer consumes dynamic sources': 'sourcePropsFor(groupKey)' in generic and 'source.instances()' in generic,
    'rural renderer no longer draws generic props immediately': 'GENERIC_PROPS.drawInstances' not in rural,
    'rural audit declares formal props_back mode': "boundaryMode:'environment-layer-stack-props-back-v1'" in rural,
    'rural audit declares no immediate boundary draw': 'immediateBoundaryDraw:false' in rural,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)
if failed:
    raise SystemExit('Depth pipeline validation failed: ' + '; '.join(failed))
print(f'PASS: {len(checks)} formal depth pipeline checks')

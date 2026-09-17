import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath = new URL('../src/core/universal-look-runtime-bridge.js', import.meta.url);
const launcherPath = new URL('../src/ui/asset-library-launcher.js', import.meta.url);
const lookBuilderPath = new URL('../src/creators/assets/universal-look-builder.mjs', import.meta.url);
const source = fs.readFileSync(runtimePath, 'utf8');
const launcher = fs.readFileSync(launcherPath, 'utf8');
const lookBuilder = fs.readFileSync(lookBuilderPath, 'utf8');

const PREVIEW_KEY = 'kelo.universal.look.preview.v1';
const RUNTIME_KEY = 'kelo.universal.look.runtime.v1';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    dump() { return Object.fromEntries(data); }
  };
}

function canvasContext(order) {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    save() { order.push('save'); },
    restore() { order.push('restore'); },
    translate(x, y) { order.push(['translate', x, y]); },
    rotate(value) { order.push(['rotate', value]); },
    drawImage(...args) { order.push(['draw', ...args]); }
  };
}

function item(overrides = {}) {
  return {
    id: overrides.id || 'sprite-1',
    name: overrides.name || 'Test Sprite',
    provider: 'audit',
    contentKind: overrides.contentKind || 'sprite',
    previewUrl: overrides.previewUrl || 'data:image/png;base64,AA==',
    columns: overrides.columns ?? 1,
    rows: overrides.rows ?? 1,
    profile: {
      slot: overrides.slot || 'body',
      x: overrides.x ?? 0.5,
      y: overrides.y ?? 0.52,
      scale: overrides.scale ?? 0.78,
      rotation: overrides.rotation ?? 0,
      alpha: overrides.alpha ?? 1,
      layer: overrides.layer || 'front',
      order: overrides.order ?? 9
    }
  };
}

function boot({ session = {}, local = {}, imageMode = 'ready' } = {}) {
  const order = [];
  const sessionStorage = storage(session);
  const localStorage = storage(local);
  const context2d = canvasContext(order);
  let registration = null;

  class FakeImage {
    constructor() {
      this.naturalWidth = 46;
      this.naturalHeight = 46;
      this.width = 46;
      this.height = 46;
    }
    set src(value) {
      this._src = value;
      if (imageMode === 'ready') this.onload?.();
      else if (imageMode === 'error') this.onerror?.();
    }
    get src() { return this._src; }
  }

  const sandbox = {
    console,
    Map,
    Math,
    Number,
    Object,
    String,
    Array,
    JSON,
    Image: FakeImage,
    sessionStorage,
    localStorage,
    ctx: context2d,
    addEventListener() {},
    KeloAvatar: {
      use(owner, fn, priority) {
        registration = { owner, fn, priority };
        return 'audit-middleware-1';
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'universal-look-runtime-bridge.js' });
  return { sandbox, order, context2d, sessionStorage, localStorage, registration };
}

function invoke(env, actor = { x: 100, y: 160, radius: 20, frame: 0 }, isSelf = true) {
  let nextCalls = 0;
  env.order.length = 0;
  env.registration.fn(actor, isSelf, () => {
    nextCalls += 1;
    env.order.push('next');
  });
  return { nextCalls, order: [...env.order] };
}

function countDraw(order) {
  return order.filter((entry) => Array.isArray(entry) && entry[0] === 'draw').length;
}

function firstIndex(order, kind) {
  return order.findIndex((entry) => entry === kind || (Array.isArray(entry) && entry[0] === kind));
}

// Static wiring contract: Creator produces the Look key; the post-first-playable launcher
// loads the runtime only when committed state exists, keeping normal boot unchanged.
assert.match(lookBuilder, /kelo\.universal\.look\.preview\.v1/);
assert.match(launcher, /kelo\.universal\.look\.preview\.v1/);
assert.match(launcher, /kelo\.universal\.look\.runtime\.v1/);
assert.match(launcher, /universal-look-runtime-bridge\.js/);
assert.match(launcher, /maybeLoadLookRuntime/);

// Installs on the one avatar render owner, with high visual priority.
{
  const env = boot();
  assert.ok(env.registration, 'runtime must register on KeloAvatar');
  assert.equal(env.registration.owner, 'creator:universal-look-runtime');
  assert.equal(env.registration.priority, 900);
  assert.equal(env.sandbox.KeloUniversalLookRuntime.snapshot().installed, true);
}

// Empty Look is a complete no-op and preserves the original player renderer.
{
  const env = boot();
  const result = invoke(env);
  assert.equal(result.nextCalls, 1);
  assert.equal(countDraw(result.order), 0);
}

// A body sprite replaces only the local player's base visual and is drawn exactly once.
{
  const raw = JSON.stringify([item({ slot: 'body', layer: 'back' })]);
  const env = boot({ session: { [PREVIEW_KEY]: raw } });
  const result = invoke(env);
  assert.equal(result.nextCalls, 0, 'ready body sprite should replace base renderer');
  assert.equal(countDraw(result.order), 1, 'body must not double-render even when layer=back');
  assert.equal(env.context2d.imageSmoothingEnabled, true, 'canvas smoothing must be restored');
  assert.equal(env.localStorage.getItem(RUNTIME_KEY), raw, 'creator Look must mirror to persistent runtime storage');
}

// A failed/unready body image never makes the player invisible: base renderer remains active.
{
  const raw = JSON.stringify([item({ slot: 'body' })]);
  const env = boot({ session: { [PREVIEW_KEY]: raw }, imageMode: 'error' });
  const result = invoke(env);
  assert.equal(result.nextCalls, 1);
  assert.equal(countDraw(result.order), 0);
}

// Front accessories render after the original body; back accessories render before it.
{
  const raw = JSON.stringify([
    item({ id: 'back', slot: 'wings', layer: 'back', order: 1 }),
    item({ id: 'front', slot: 'weapon', layer: 'front', order: 2 })
  ]);
  const env = boot({ session: { [PREVIEW_KEY]: raw } });
  const result = invoke(env);
  assert.equal(result.nextCalls, 1);
  assert.equal(countDraw(result.order), 2);
  const firstDraw = firstIndex(result.order, 'draw');
  const next = firstIndex(result.order, 'next');
  const lastDraw = result.order.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => Array.isArray(entry) && entry[0] === 'draw').at(-1).index;
  assert.ok(firstDraw < next, 'back layer must draw before base body');
  assert.ok(lastDraw > next, 'front layer must draw after base body');
}

// Try-on geometry reaches the original game: drag offset, scale and rotation are honored.
{
  const raw = JSON.stringify([item({ slot: 'body', x: 0.7, y: 0.4, scale: 1.1, rotation: 30 })]);
  const env = boot({ session: { [PREVIEW_KEY]: raw } });
  const result = invoke(env);
  const translate = result.order.find((entry) => Array.isArray(entry) && entry[0] === 'translate');
  const rotate = result.order.find((entry) => Array.isArray(entry) && entry[0] === 'rotate');
  const draw = result.order.find((entry) => Array.isArray(entry) && entry[0] === 'draw');
  assert.ok(translate && translate[1] > 100, 'positive X try-on offset must move sprite right');
  assert.ok(rotate && Math.abs(rotate[1] - Math.PI / 6) < 1e-9, 'rotation must be applied');
  assert.ok(draw && Math.abs(draw.at(-1)) > 92, 'scale > 1 must enlarge the destination height');
}

// Only the local player is customized; other actors keep their normal renderer.
{
  const raw = JSON.stringify([item({ slot: 'body' })]);
  const env = boot({ session: { [PREVIEW_KEY]: raw } });
  const result = invoke(env, { x: 10, y: 10, radius: 20 }, false);
  assert.equal(result.nextCalls, 1);
  assert.equal(countDraw(result.order), 0);
}

// The last committed Look survives opening the original game in another tab/session.
{
  const raw = JSON.stringify([item({ slot: 'body' })]);
  const first = boot({ session: { [PREVIEW_KEY]: raw } });
  assert.equal(first.localStorage.getItem(RUNTIME_KEY), raw);
  const second = boot({ local: { [RUNTIME_KEY]: raw } });
  assert.equal(second.sandbox.KeloUniversalLookRuntime.snapshot().itemCount, 1);
  assert.equal(invoke(second).nextCalls, 0);
}

// Quitar/Vaciar semantics: [] from Creator wins over an older persisted Look.
{
  const stale = JSON.stringify([item({ slot: 'body' })]);
  const env = boot({ session: { [PREVIEW_KEY]: '[]' }, local: { [RUNTIME_KEY]: stale } });
  assert.equal(env.sandbox.KeloUniversalLookRuntime.snapshot().itemCount, 0);
  assert.equal(env.localStorage.getItem(RUNTIME_KEY), '[]');
  assert.equal(invoke(env).nextCalls, 1);
}

// Public clear is deterministic and removes both transport stores.
{
  const raw = JSON.stringify([item({ slot: 'body' })]);
  const env = boot({ session: { [PREVIEW_KEY]: raw }, local: { [RUNTIME_KEY]: raw } });
  env.sandbox.KeloUniversalLookRuntime.clear();
  assert.equal(env.sessionStorage.getItem(PREVIEW_KEY), null);
  assert.equal(env.localStorage.getItem(RUNTIME_KEY), null);
  assert.equal(env.sandbox.KeloUniversalLookRuntime.snapshot().itemCount, 0);
}

console.log('PASS universal-look-runtime-audit: Creator Look -> original game runtime, layers, body replacement, transforms, persistence, removal and fail-safe');

/* KELO-INDEX
 * area: STUDIO / POINTER ADAPTER
 * owns: optional DOM PointerEvent binding with capture and rAF-coalesced move
 * does-not-own: tool semantics or gameplay input
 * public-api: attachStudioPointerInput()
 * online: no
 */

export function attachStudioPointerInput({ element, router, toWorld = (x,y) => ({x,y}), requestFrame = globalThis.requestAnimationFrame } = {}) {
  if (!element?.addEventListener || !router) throw new Error('STUDIO_POINTER_DEPENDENCY_MISSING');
  let pointerId = null, latestMove = null, frame = 0;
  const raf = typeof requestFrame === 'function' ? requestFrame.bind(globalThis) : fn => setTimeout(fn, 16);

  function payload(event) { const world = toWorld(event.clientX, event.clientY); return { originalEvent: event, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, worldX: world.x, worldY: world.y, buttons: event.buttons, pressure: event.pressure, pointerType: event.pointerType }; }
  function flushMove() { frame = 0; const event = latestMove; latestMove = null; if (event) router.route('pointermove', payload(event)); }
  function down(event) { pointerId = event.pointerId; try { element.setPointerCapture?.(event.pointerId); } catch {} const result = router.route('pointerdown', payload(event)); if (result.handled) event.preventDefault(); }
  function move(event) { if (pointerId != null && event.pointerId !== pointerId) return; latestMove = event; if (!frame) frame = raf(flushMove); }
  function up(event) { if (pointerId != null && event.pointerId !== pointerId) return; if (latestMove) flushMove(); const result = router.route(event.type === 'pointercancel' ? 'pointercancel' : 'pointerup', payload(event)); try { element.releasePointerCapture?.(event.pointerId); } catch {} pointerId = null; if (result.handled) event.preventDefault(); }

  element.addEventListener('pointerdown', down, { passive: false });
  element.addEventListener('pointermove', move, { passive: true });
  element.addEventListener('pointerup', up, { passive: false });
  element.addEventListener('pointercancel', up, { passive: false });
  return () => { element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); };
}

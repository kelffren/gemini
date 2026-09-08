/* KELO-INDEX
 * area: STUDIO / COMMANDS
 * owns: single mutation boundary for authoring operations
 * does-not-own: UI, persistence, gameplay behavior
 * public-api: createCommandBus()
 * online: serialized commands may be forwarded by an adapter
 */

export function createCommandBus({ history, onAfterExecute } = {}) {
  if (!history) throw new Error('STUDIO_COMMAND_HISTORY_REQUIRED');
  const listeners = new Set();
  let executing = false;

  function validate(command) {
    if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
      throw new Error('STUDIO_COMMAND_INVALID');
    }
  }

  async function execute(command, context) {
    validate(command);
    if (executing) throw new Error('STUDIO_COMMAND_REENTRANT');
    executing = true;
    try {
      const result = await command.execute(context);
      const serialized = typeof command.serialize === 'function' ? command.serialize() : { type: command.type || 'anonymous' };
      const event = {
        type: 'execute',
        command: serialized,
        affectedRects: typeof command.affectedRects === 'function' ? command.affectedRects(context) : []
      };
      history.push({
        type: command.type || 'anonymous',
        label: command.label || command.type || 'Command',
        serialized,
        affectedRects: event.affectedRects,
        undo: () => command.undo(context),
        redo: () => typeof command.redo === 'function' ? command.redo(context) : command.execute(context)
      });
      if (typeof onAfterExecute === 'function') await onAfterExecute(event, context, command);
      for (const fn of listeners) { try { fn(event); } catch {} }
      return result;
    } finally {
      executing = false;
    }
  }

  return Object.freeze({
    execute,
    on(fn) { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); },
    get executing() { return executing; }
  });
}

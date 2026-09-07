/* KELO-INDEX
 * area: CHARACTERS
 * keys: VISUAL PRESETS SPRITESHEET SOCKET WEAPON REUSABLE
 * hace: fabrica descriptores visuales reutilizables para contenido modular de personaje
 * online: datos visuales puros; no contiene stats, inventario ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-visual-presets-v1.0.1';
  const DEFAULT_FACE_ROWS = Object.freeze({ down:0, left:1, right:2, up:3 });

  function clone(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const out = {};
    Object.keys(value).forEach(function (key) { out[key] = clone(value[key]); });
    return out;
  }

  function source(base, file, version) {
    const prefix = String(base || '');
    const name = String(file || '');
    const suffix = version == null ? '' : '?v=' + encodeURIComponent(String(version));
    return prefix + name + suffix;
  }

  function sheet(src, options) {
    const o = options || {};
    return {
      mode:'sheet',
      source:String(src || ''),
      columns:Math.max(1, Math.floor(Number(o.columns) || 4)),
      rows:Math.max(1, Math.floor(Number(o.rows) || 4)),
      faceRows:Object.assign({}, DEFAULT_FACE_ROWS, o.faceRows || {}),
      anchor:Object.assign({ x:0.5, y:1 }, o.anchor || {}),
      heightScale:Number(o.heightScale) || 1,
      rotation:Number(o.rotation) || 0,
      offsets:clone(o.offsets || {}),
      layer:String(o.layer || 'front'),
      preview:Object.assign({ kind:'actor-sheet' }, clone(o.preview || {}))
    };
  }

  function socket(src, socketName, options) {
    const o = options || {};
    return {
      mode:'socket',
      source:String(src || ''),
      socket:String(socketName || o.socket || 'center'),
      layer:String(o.layer || 'front'),
      width:Number(o.width) || 28,
      height:Number(o.height) || 28,
      anchor:Object.assign({ x:0.5, y:1 }, o.anchor || {}),
      rotation:Number(o.rotation) || 0,
      offsets:clone(o.offsets || {}),
      preview:Object.assign({ kind:'socket', leftPercent:50, bottomPercent:20, widthPercent:24 }, clone(o.preview || {}))
    };
  }

  function weapon(src, options) {
    const o = options || {};
    return socket(src, 'weapon', {
      layer:o.layer || 'front',
      width:Number(o.width) || 58,
      height:Number(o.height) || 58,
      anchor:Object.assign({ x:0.5, y:0.88 }, o.anchor || {}),
      rotation:Number(o.rotation) || 0,
      offsets:Object.assign({
        down:{ x:2, y:7, rotation:180 },
        up:{ x:-2, y:-5, rotation:0 },
        left:{ x:-7, y:0, rotation:-90 },
        right:{ x:7, y:0, rotation:90 }
      }, clone(o.offsets || {})),
      preview:Object.assign({ kind:'socket', leftPercent:66, bottomPercent:22, widthPercent:27, rotationDeg:180, anchorX:0.5, anchorY:0.88 }, clone(o.preview || {}))
    });
  }

  root.KeloCharacterVisualPresets = Object.freeze({
    version:VERSION,
    defaultFaceRows:DEFAULT_FACE_ROWS,
    source:source,
    sheet:sheet,
    socket:socket,
    weapon:weapon
  });

  root.KELO_CHARACTER_VISUAL_PRESETS_AUDIT = Object.freeze({
    version:VERSION,
    ready:true,
    pureData:true,
    responsivePreviewMetadata:true,
    factories:Object.freeze(['source','sheet','socket','weapon'])
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);

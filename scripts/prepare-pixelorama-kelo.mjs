#!/usr/bin/env node
/* KELO-INDEX
 * area: BUILD / CREATORS / PIXELORAMA
 * owner: Kelo Creators build tooling
 * keys: PIXELORAMA PATCH GODOT WEB MEMORY UNDO FPS BRIDGE FILEDATA
 * purpose: aplica sobre un checkout upstream fijado las adaptaciones Kelo sin almacenar WASM/PCK en gemini
 * online: N/A build-time only
 * do-not: NO descarga dependencias por sí solo, NO publica, NO modifica Kelo runtime
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Usage: node scripts/prepare-pixelorama-kelo.mjs <pixelorama-checkout>');
const read=rel=>fs.readFile(path.join(root,rel),'utf8');
const write=(rel,text)=>fs.writeFile(path.join(root,rel),text,'utf8');
function replaceOnce(text,needle,replacement,label){
  if(!text.includes(needle))throw new Error(`Pixelorama patch point missing: ${label}`);
  return text.replace(needle,replacement);
}

const globalPath='src/Autoload/Global.gd';
let global=await read(globalPath);
global=replaceOnce(global,'var max_undo_steps := 0:\n','var max_undo_steps := 64 if OS.has_feature("web") else 0:\n','mobile bounded undo');
await write(globalPath,global);

const exchangePath='src/Autoload/HTML5FileExchange.gd';
let exchange=await read(exchangePath);
exchange=replaceOnce(exchange,
  '\tvar image_name: String = JavaScriptBridge.eval("fileName;", true)\n\n\tvar image := Image.new()\n',
  '\tvar image_name: String = JavaScriptBridge.eval("fileName;", true)\n\t# KELO WEB: release the JS-side duplicate as soon as Godot owns the bytes.\n\tJavaScriptBridge.eval("fileData = null; fileType = null; fileName = null;", true)\n\n\tvar image := Image.new()\n',
  'release imported browser buffer');
await write(exchangePath,exchange);

const bridgePath='src/Autoload/KeloWebBridge.gd';
await fs.mkdir(path.dirname(path.join(root,bridgePath)),{recursive:true});
await write(bridgePath,`extends Node\n## KELO-INDEX CREATORS/PIXELORAMA WEB BRIDGE\n## Exposes a tiny same-origin command callback. Authoring only; never gameplay authority.\n\nvar _callback: JavaScriptObject\n\nfunc _ready() -> void:\n\tif not OS.has_feature("web"):\n\t\treturn\n\tvar window := JavaScriptBridge.get_interface("window")\n\t_callback = JavaScriptBridge.create_callback(_on_command)\n\twindow.keloPixeloramaCommand = _callback\n\tGlobal.max_undo_steps = 64\n\tEngine.max_fps = 60\n\nfunc _on_command(args: Array) -> void:\n\tif args.is_empty():\n\t\treturn\n\tvar command := str(args[0])\n\tmatch command:\n\t\t"set_fps":\n\t\t\tif args.size() > 1:\n\t\t\t\tEngine.max_fps = clampi(int(args[1]), 10, 60)\n\t\t"set_undo_limit":\n\t\t\tif args.size() > 1:\n\t\t\t\tGlobal.max_undo_steps = clampi(int(args[1]), 10, 200)\n\t\t"open_path":\n\t\t\tif args.size() > 1:\n\t\t\t\t_open_path(str(args[1]))\n\t\t"release_browser_buffer":\n\t\t\tJavaScriptBridge.eval("fileData = null; fileType = null; fileName = null;", true)\n\nfunc _open_path(file_path: String) -> void:\n\tvar extension := file_path.get_extension().to_lower()\n\tif extension == "pxo":\n\t\tOpenSave.open_pxo_file(file_path)\n\t\treturn\n\tvar bytes := FileAccess.get_file_as_bytes(file_path)\n\tif bytes.is_empty():\n\t\treturn\n\tvar image := Image.new()\n\tvar error := ERR_FILE_UNRECOGNIZED\n\tmatch extension:\n\t\t"png": error = image.load_png_from_buffer(bytes)\n\t\t"jpg", "jpeg": error = image.load_jpg_from_buffer(bytes)\n\t\t"webp": error = image.load_webp_from_buffer(bytes)\n\t\t"bmp": error = image.load_bmp_from_buffer(bytes)\n\t\t"tga": error = image.load_tga_from_buffer(bytes)\n\tif error == OK:\n\t\tOpenSave.handle_loading_image(file_path.get_file(), image)\n`);

const projectPath='project.godot';
let project=await read(projectPath);
project=replaceOnce(project,'Global="*res://src/Autoload/Global.gd"\n','Global="*res://src/Autoload/Global.gd"\nKeloWebBridge="*res://src/Autoload/KeloWebBridge.gd"\n','autoload Kelo bridge');
await write(projectPath,project);

const exportPath='export_presets.cfg';
let presets=await read(exportPath);
if(!presets.includes('variant/thread_support=false'))throw new Error('Pixelorama Web must remain threadless for Kelo mobile profile');
// Kelo owns caching; do not let an embedded tool register a second service worker.
presets=presets.replace('progressive_web_app/enabled=true','progressive_web_app/enabled=false');
await write(exportPath,presets);

console.log(JSON.stringify({ok:true,root,changes:[globalPath,exchangePath,bridgePath,projectPath,exportPath],profile:{webUndoSteps:64,threads:false,pwa:false}},null,2));

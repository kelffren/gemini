/* KELO-INDEX
 * area: STUDIO / CREATOR PRODUCTIVITY UI
 * owner: Kelo Studio Creator Productivity Panel
 * keys: STUDIO UI COPY PASTE PREFAB GRID SNAP CAMERA ZOOM VALIDATION MOBILE REFERENCE PHONE
 * owns: modular Copy/Paste, Prefab, Snap/Grid, Camera/Zoom, Check Map, reference mobile navigation and mobile creator chrome
 * does-not-own: world mutations, validation rules, camera math, rendering or persistence
 * public-api: createCreatorProductivityPanel()
 * online: no; callbacks and shell actions delegate all mutations to creator owners
 */

export function createCreatorProductivityPanel({
  shell,onCopy,onPaste,onSavePrefab,onValidate,onSnapChange,onGridToggle,
  onCameraToggle,onZoomIn,onZoomOut,onZoomReset
}={}){
  const root=shell?.root,document=root?.ownerDocument;
  if(!root||!document)throw new Error('STUDIO_PRODUCTIVITY_SHELL_REQUIRED');
  const view=document.defaultView||globalThis;

  const style=document.createElement('style');
  style.dataset.keloStudioUi='1';
  style.dataset.keloStudioMobileReference='1';
  style.textContent=`
    #kelo-studio-live .ks-ext-strip{display:flex;gap:5px;align-items:center;min-width:0}
    #kelo-studio-live .ks-ext-strip button,
    #kelo-studio-live .ks-ext-strip select{
      min-height:36px;border:1px solid rgba(231,197,106,.22);border-radius:10px;
      background:#101b1e;color:#dce6e0;font-size:7px;font-weight:900;padding:0 9px;
      white-space:nowrap;letter-spacing:.025em
    }
    #kelo-studio-live .ks-ext-strip button.on,
    #kelo-studio-live .ks-mobile-tool.on,
    #kelo-studio-live .ks-mobile-rail button.on{
      border-color:#e7c56a;background:linear-gradient(180deg,#29493c,#1d372f);color:#fff1b8;
      box-shadow:0 0 0 1px rgba(231,197,106,.08),0 0 16px rgba(231,197,106,.08)
    }
    #kelo-studio-live .ks-ext-strip button:disabled,
    #kelo-studio-live .ks-ext-strip select:disabled{opacity:.35}
    #kelo-studio-live .ks-ext-edit{display:inline-flex}
    #kelo-studio-live .ks-ext-map{overflow-x:auto;padding-bottom:1px}
    #kelo-studio-live .ks-ext-view{overflow-x:auto;max-width:100%}
    #kelo-studio-live .ks-zoom-label{min-width:48px;padding:0 7px!important}
    #kelo-studio-live .ks-minimize{
      display:inline-flex;align-items:center;justify-content:center;min-width:38px!important;
      padding:0 8px!important;font-size:14px!important;line-height:1
    }
    #kelo-studio-live .ks-mobile-rail,
    #kelo-studio-live .ks-mobile-zoom,
    #kelo-studio-live .ks-mobile-history{display:none}
    #kelo-studio-live .ks-mobile-pane[data-pane="paint"],
    #kelo-studio-live .ks-mobile-pane[data-pane="map"],
    #kelo-studio-live .ks-mobile-pane[data-pane="settings"]{padding:9px;overflow:auto}
    #kelo-studio-live .ks-mobile-tool-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    #kelo-studio-live .ks-mobile-tool{
      min-height:58px;border:1px solid rgba(231,197,106,.18);border-radius:14px;
      background:linear-gradient(180deg,rgba(17,31,33,.96),rgba(10,21,23,.96));color:#dce7e1;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
      font-size:7px;font-weight:900;letter-spacing:.05em
    }
    #kelo-studio-live .ks-mobile-tool .ks-mobile-icon{font-size:18px;color:#d7e4df;line-height:1}
    #kelo-studio-live .ks-mobile-section-title{
      margin:2px 2px 7px;color:#e9cf79;font-size:7px;font-weight:950;letter-spacing:.16em
    }
    #kelo-studio-live .ks-mobile-control-row{display:flex;align-items:center;gap:7px;margin-top:8px}
    #kelo-studio-live .ks-mobile-control-row>*{flex:1;min-width:0}
    #kelo-studio-live .ks-mobile-control-row select,
    #kelo-studio-live .ks-mobile-control-row button{
      min-height:44px;border:1px solid rgba(231,197,106,.2);border-radius:12px;background:#0e1a1c;color:#eaf1ed;
      font-size:7px;font-weight:900;padding:0 9px
    }
    #kelo-studio-live .ks-mobile-asset-footer{
      display:flex;align-items:center;gap:9px;margin:7px 7px 2px;padding:7px 8px;
      border:1px solid rgba(231,197,106,.17);border-radius:13px;background:rgba(12,25,27,.88)
    }
    #kelo-studio-live .ks-mobile-asset-footer .ks-compact-asset{display:flex;align-items:center;gap:7px;min-width:0;flex:1}
    #kelo-studio-live .ks-mobile-asset-footer canvas{width:38px;height:38px;border-radius:9px;image-rendering:pixelated}
    #kelo-studio-live .ks-mobile-asset-footer small{display:block;color:#82998f;font-size:5.5px;letter-spacing:.08em}
    #kelo-studio-live .ks-mobile-asset-footer strong{display:block;max-width:150px;color:#f0d984;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #kelo-studio-live .ks-modal-backdrop{
      position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.52);display:grid;place-items:center;
      pointer-events:auto;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)
    }
    #kelo-studio-live .ks-modal{
      width:min(430px,calc(100vw - 28px));max-height:min(72vh,620px);overflow:auto;
      border:1px solid rgba(231,197,106,.46);border-radius:18px;
      background:linear-gradient(180deg,#091517,#071012);padding:15px;
      box-shadow:0 26px 80px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,255,255,.035)
    }
    #kelo-studio-live .ks-modal h3{margin:0 0 10px;color:#ecd174;font-family:Georgia,"Times New Roman",serif;font-size:12px;letter-spacing:.08em}
    #kelo-studio-live .ks-modal p,#kelo-studio-live .ks-modal li{font-size:9px;color:#b8c8c0;line-height:1.55}
    #kelo-studio-live .ks-modal input{width:100%;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0d1719;color:#fff;padding:0 10px;margin:5px 0 12px;outline:none}
    #kelo-studio-live .ks-modal input:focus{border-color:rgba(231,197,106,.58)}
    #kelo-studio-live .ks-modal-actions{display:flex;gap:7px;justify-content:flex-end}
    #kelo-studio-live .ks-modal-actions button{min-height:36px;border:1px solid rgba(231,197,106,.28);border-radius:10px;background:#14231f;color:#fff1b8;font-size:8px;font-weight:900;padding:0 13px}
    #kelo-studio-live .ks-health-counts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
    #kelo-studio-live .ks-health-counts div{border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d1719;padding:8px;font-size:8px;color:#92aa9f}
    #kelo-studio-live .ks-health-counts b{display:block;color:#fff;font-size:14px;margin-top:3px}
    #kelo-studio-live .ks-health-ok{color:#82d6a7!important}
    #kelo-studio-live .ks-health-error{color:#ff9b9b!important}
    #kelo-studio-live .ks-health-warn{color:#ead078!important}

    @media(max-width:900px){
      #kelo-studio-live{--ks-phone-gap:8px;--ks-phone-top:66px;--ks-phone-sheet:min(36dvh,355px)}
      #kelo-studio-live .ks-top{
        left:var(--ks-phone-gap)!important;right:var(--ks-phone-gap)!important;
        top:max(7px,env(safe-area-inset-top))!important;min-height:58px!important;height:58px!important;
        padding:6px!important;gap:6px!important;border-radius:18px!important;
        border-color:rgba(231,197,106,.32)!important;background:rgba(5,15,18,.94)!important;
        box-shadow:0 12px 34px rgba(0,0,0,.45)!important
      }
      #kelo-studio-live .ks-minimize{
        order:-5;display:grid!important;place-items:center;width:44px!important;min-width:44px!important;height:44px!important;
        min-height:44px!important;border-radius:13px!important;padding:0!important;font-size:0!important
      }
      #kelo-studio-live .ks-minimize::before{content:'☰';font-size:20px;line-height:1;color:#e6ece8}
      #kelo-studio-live[data-creator-minimized="1"] .ks-minimize::before{content:'▴';font-size:18px}
      #kelo-studio-live .ks-brand{gap:6px!important;min-width:0;flex:1}
      #kelo-studio-live .ks-brand-mark{display:none!important}
      #kelo-studio-live .ks-title{font-size:11px!important;letter-spacing:.12em!important}
      #kelo-studio-live .ks-subtitle{font-size:5px!important;letter-spacing:.19em!important;margin-top:4px!important}
      #kelo-studio-live .ks-spacer{display:none!important}
      #kelo-studio-live .ks-top [data-act="play"],#kelo-studio-live .ks-top [data-act="save"]{
        min-width:62px!important;height:44px!important;min-height:44px!important;padding:0 9px!important;border-radius:13px!important;
        font-size:7px!important
      }
      #kelo-studio-live .ks-top [data-act="save"]{border-color:#e7c56a!important;box-shadow:0 0 20px rgba(231,197,106,.14)!important}
      #kelo-studio-live .ks-top [data-act="close"]{display:none!important}
      #kelo-studio-live .ks-left,#kelo-studio-live .ks-right,#kelo-studio-live .ks-scale-hud{display:none!important}
      #kelo-studio-live .ks-deck,#kelo-studio-live .ks-status,#kelo-studio-live .ks-compact-bar{display:none!important}

      #kelo-studio-live .ks-bottom,
      #kelo-studio-live .ks-bottom.ks-compact{
        left:var(--ks-phone-gap)!important;right:var(--ks-phone-gap)!important;bottom:max(7px,env(safe-area-inset-bottom))!important;
        transform:none!important;width:auto!important;height:var(--ks-phone-sheet)!important;max-height:none!important;
        overflow:hidden!important;padding:8px!important;border-radius:22px!important;
        border:1px solid rgba(231,197,106,.28)!important;background:rgba(4,15,18,.965)!important;
        box-shadow:0 20px 55px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.035)!important;
        backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important
      }
      #kelo-studio-live[data-creator-minimized="1"] .ks-bottom{display:none!important}
      #kelo-studio-live .ks-tabs,
      #kelo-studio-live .ks-bottom.ks-compact>.ks-tabs{
        display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 0 6px!important;height:46px
      }
      #kelo-studio-live .ks-tabs button{
        min-width:0!important;min-height:44px!important;height:44px!important;padding:0 5px!important;border-radius:13px!important;
        font-size:6.4px!important;letter-spacing:.02em!important
      }
      #kelo-studio-live .ks-tabs button::first-letter{font-size:10px}
      #kelo-studio-live .ks-mobile-sheet,
      #kelo-studio-live[data-sheet-open="1"] .ks-mobile-sheet,
      #kelo-studio-live .ks-bottom.ks-compact>.ks-mobile-sheet{
        display:block!important;height:calc(100% - 52px)!important;max-height:none!important;overflow:hidden!important;
        margin:0!important;border:1px solid rgba(255,255,255,.055)!important;border-radius:15px!important;
        background:rgba(5,13,15,.6)!important
      }
      #kelo-studio-live .ks-mobile-pane{height:100%!important;max-height:none!important}
      #kelo-studio-live .ks-mobile-pane.on{display:block!important}
      #kelo-studio-live .ks-mobile-pane:not(.on){display:none!important}
      #kelo-studio-live .ks-mobile-pane .ks-search{height:36px!important;margin:6px 7px 4px!important;border-radius:11px!important}
      #kelo-studio-live .ks-mobile-pane.assets-pane{display:none;height:100%!important;padding-bottom:55px;position:relative}
      #kelo-studio-live .ks-mobile-pane.assets-pane.on{display:block!important}
      #kelo-studio-live .ks-mobile-pane.assets-pane .ks-assets{height:calc(100% - 46px)!important;padding-bottom:54px}
      #kelo-studio-live .ks-mobile-pane .ks-assets,#kelo-studio-live .ks-mobile-pane .ks-explorer{height:100%}
      #kelo-studio-live .ks-mobile-pane .ks-properties{height:100%;padding:10px!important}
      #kelo-studio-live .ks-mobile-pane .ks-row{
        left:6px!important;right:6px!important;height:62px!important;border-radius:13px!important;
        background:linear-gradient(180deg,rgba(15,29,31,.96),rgba(9,19,21,.96))!important
      }
      #kelo-studio-live .ks-mobile-pane .ks-row canvas{width:50px!important;height:50px!important;border-radius:11px!important}
      #kelo-studio-live .ks-mobile-pane .ks-row.on{border-color:#e7c56a!important;box-shadow:0 0 0 1px rgba(231,197,106,.08),0 0 18px rgba(231,197,106,.08)!important}
      #kelo-studio-live .ks-mobile-pane .ks-row small{font-size:6px!important}
      #kelo-studio-live .ks-mobile-pane .ks-tree-row{border-radius:12px!important}

      #kelo-studio-live .ks-mobile-rail{
        display:flex;position:absolute;right:8px;top:calc(max(7px,env(safe-area-inset-top)) + 76px);z-index:38;
        width:64px;flex-direction:column;gap:6px;padding:6px;border:1px solid rgba(231,197,106,.2);border-radius:20px;
        background:rgba(5,15,18,.9);box-shadow:0 15px 40px rgba(0,0,0,.42);pointer-events:auto;
        backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px)
      }
      #kelo-studio-live .ks-mobile-rail button{
        width:52px;height:58px;min-height:58px;padding:3px;border:1px solid rgba(255,255,255,.08);border-radius:14px;
        background:rgba(13,26,29,.94);color:#dce6e1;font-size:5.7px;font-weight:900;letter-spacing:.04em;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px
      }
      #kelo-studio-live .ks-mobile-rail .ks-mobile-icon{font-size:18px;line-height:1;color:#dce7e2}
      #kelo-studio-live .ks-mobile-rail button.on .ks-mobile-icon{color:#f2db83}
      #kelo-studio-live[data-creator-minimized="1"] .ks-mobile-rail{opacity:.78}

      #kelo-studio-live .ks-mobile-zoom{
        display:flex;position:absolute;left:8px;top:41%;transform:translateY(-50%);z-index:37;width:54px;
        flex-direction:column;overflow:hidden;border:1px solid rgba(231,197,106,.18);border-radius:19px;
        background:rgba(5,15,18,.9);box-shadow:0 12px 34px rgba(0,0,0,.42);pointer-events:auto
      }
      #kelo-studio-live .ks-mobile-zoom button,#kelo-studio-live .ks-mobile-zoom span{
        width:54px;height:48px;display:grid;place-items:center;border:0;border-bottom:1px solid rgba(255,255,255,.07);
        background:transparent;color:#ecf2ef;font-size:20px;font-weight:800;padding:0
      }
      #kelo-studio-live .ks-mobile-zoom span{font-size:8px;color:#d7e2dc}
      #kelo-studio-live .ks-mobile-zoom button:last-child{border-bottom:0;font-size:17px}

      #kelo-studio-live .ks-mobile-history{
        display:flex;position:absolute;left:8px;bottom:calc(var(--ks-phone-sheet) + max(17px,env(safe-area-inset-bottom)));z-index:37;
        border:1px solid rgba(231,197,106,.18);border-radius:15px;overflow:hidden;background:rgba(5,15,18,.9);
        pointer-events:auto;box-shadow:0 12px 32px rgba(0,0,0,.4)
      }
      #kelo-studio-live .ks-mobile-history button{
        width:48px;height:45px;border:0;border-right:1px solid rgba(255,255,255,.07);background:transparent;color:#e9efec;font-size:19px
      }
      #kelo-studio-live .ks-mobile-history button:last-child{border-right:0}
      #kelo-studio-live .ks-mobile-history button:disabled{opacity:.3}
      #kelo-studio-live[data-creator-minimized="1"] .ks-mobile-history{bottom:max(12px,env(safe-area-inset-bottom))}

      #kelo-studio-live .ks-mobile-asset-footer{
        position:absolute;left:7px;right:7px;bottom:5px;z-index:2;margin:0;background:rgba(7,18,20,.96)
      }
      #kelo-studio-live .ks-mobile-tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      #kelo-studio-live .ks-modal{max-height:75dvh}
    }

    @media(max-width:430px){
      #kelo-studio-live{--ks-phone-sheet:min(35dvh,328px)}
      #kelo-studio-live .ks-top{height:56px!important;min-height:56px!important}
      #kelo-studio-live .ks-minimize{width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important}
      #kelo-studio-live .ks-title{font-size:9.5px!important}
      #kelo-studio-live .ks-subtitle{font-size:4.6px!important}
      #kelo-studio-live .ks-top [data-act="play"],#kelo-studio-live .ks-top [data-act="save"]{min-width:55px!important;height:42px!important;min-height:42px!important;padding:0 7px!important}
      #kelo-studio-live .ks-top .ks-ico{margin-right:2px!important;font-size:10px!important}
      #kelo-studio-live .ks-mobile-rail{width:59px;padding:5px;right:7px}
      #kelo-studio-live .ks-mobile-rail button{width:47px;height:53px;min-height:53px;font-size:5.2px}
      #kelo-studio-live .ks-mobile-rail .ks-mobile-icon{font-size:16px}
      #kelo-studio-live .ks-mobile-zoom{left:7px;width:50px}
      #kelo-studio-live .ks-mobile-zoom button,#kelo-studio-live .ks-mobile-zoom span{width:50px;height:45px}
      #kelo-studio-live .ks-mobile-history{left:7px}
      #kelo-studio-live .ks-mobile-history button{width:46px;height:43px}
      #kelo-studio-live .ks-tabs button{font-size:5.8px!important}
      #kelo-studio-live .ks-mobile-tool{min-height:54px}
    }

    @media(max-width:900px) and (orientation:landscape){
      #kelo-studio-live{--ks-phone-sheet:min(46dvh,270px)}
      #kelo-studio-live .ks-mobile-rail{top:75px;transform:scale(.9);transform-origin:top right}
      #kelo-studio-live .ks-mobile-zoom{top:43%;transform:translateY(-50%) scale(.9);transform-origin:left center}
      #kelo-studio-live .ks-bottom,#kelo-studio-live .ks-bottom.ks-compact{left:74px!important;right:78px!important}
      #kelo-studio-live .ks-mobile-history{bottom:calc(var(--ks-phone-sheet) + 12px);transform:scale(.9);transform-origin:bottom left}
      #kelo-studio-live .ks-mobile-tool-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
    }
  `;
  document.head.appendChild(style);

  const host=root.querySelector('.ks-bottom');
  if(!host)throw new Error('STUDIO_PRODUCTIVITY_HOST_MISSING');

  const editSlot=root.querySelector('.ks-productivity-edit-slot');
  const mapSlot=root.querySelector('.ks-productivity-map-slot');
  const viewSlot=root.querySelector('.ks-productivity-view-slot');

  const editBar=document.createElement('div');
  editBar.className='ks-ext-strip ks-ext-edit';
  editBar.innerHTML=`
    <button data-ext="copy"><span class="ks-ico">⧉</span>COPY</button>
    <button data-ext="paste" disabled><span class="ks-ico">▤</span>PASTE</button>
  `;

  const mapBar=document.createElement('div');
  mapBar.className='ks-ext-strip ks-ext-map';
  mapBar.innerHTML=`
    <button data-ext="prefab"><span class="ks-ico">▱</span>SAVE PREFAB</button>
    <button data-ext="check"><span class="ks-ico">⌑</span>CHECK MAP</button>
    <button class="on" data-ext="grid"><span class="ks-ico">▦</span>GRID</button>
    <select data-ext="snap" aria-label="Snap">
      <option value="1">FREE</option><option value="8">SNAP 8</option><option value="16">SNAP 16</option>
      <option value="32" selected>SNAP 32</option><option value="64">SNAP 64</option>
    </select>
  `;

  const viewBar=document.createElement('div');
  viewBar.className='ks-ext-strip ks-ext-view';
  viewBar.innerHTML=`
    <button data-ext="camera"><span class="ks-ico">⌖</span>CAMERA</button>
    <button data-ext="zoom-out" aria-label="Zoom out">−</button>
    <button class="ks-zoom-label" data-ext="zoom-reset">100%</button>
    <button data-ext="zoom-in" aria-label="Zoom in">+</button>
  `;

  (editSlot||host).appendChild(editBar);
  (mapSlot||host).appendChild(mapBar);
  (viewSlot||host).appendChild(viewBar);

  const top=root.querySelector('.ks-top');
  const brand=top?.querySelector('.ks-brand')||null;
  const minimize=document.createElement('button');
  minimize.type='button';
  minimize.className='ks-minimize';
  minimize.dataset.studioMinimize='1';
  if(top)top.insertBefore(minimize,brand||top.firstChild);

  const tabs=root.querySelector('.ks-tabs');
  if(tabs)tabs.innerHTML=`
    <button class="on" data-tab="assets"><span class="ks-ico">◇</span>ASSETS</button>
    <button data-tab="paint"><span class="ks-ico">✎</span>PAINT</button>
    <button data-tab="explorer"><span class="ks-ico">▱</span>LAYERS</button>
    <button data-tab="properties"><span class="ks-ico">▤</span>PROPERTIES</button>
  `;

  const mobileSheet=root.querySelector('.ks-mobile-sheet');
  const paintPane=document.createElement('div');
  paintPane.className='ks-mobile-pane';
  paintPane.dataset.pane='paint';
  paintPane.innerHTML=`
    <div class="ks-mobile-section-title">PAINT / WORLD TOOLS</div>
    <div class="ks-mobile-tool-grid">
      <button class="ks-mobile-tool" data-mode="terrain"><span class="ks-mobile-icon">▦</span>GROUND</button>
      <button class="ks-mobile-tool" data-mode="path"><span class="ks-mobile-icon">⌁</span>ROAD</button>
      <button class="ks-mobile-tool" data-mode="collision"><span class="ks-mobile-icon">◇</span>COLLISION</button>
      <button class="ks-mobile-tool" data-mode="select"><span class="ks-mobile-icon">↖</span>SELECT</button>
      <button class="ks-mobile-tool" data-mode="move"><span class="ks-mobile-icon">✥</span>MOVE</button>
      <button class="ks-mobile-tool" data-act="erase"><span class="ks-mobile-icon">⌫</span>ERASE</button>
    </div>
    <div class="ks-mobile-control-row">
      <select data-act="brush-size" aria-label="Brush size"><option value="1">BRUSH 1</option><option value="2">BRUSH 2</option><option value="3">BRUSH 3</option><option value="5">BRUSH 5</option></select>
      <button data-act="rotate">⟳ ROTATE</button>
      <button data-act="duplicate">⧉ DUPLICATE</button>
    </div>
  `;

  const mapPane=document.createElement('div');
  mapPane.className='ks-mobile-pane';
  mapPane.dataset.pane='map';
  mapPane.innerHTML=`
    <div class="ks-mobile-section-title">MAP / CAMERA</div>
    <div class="ks-mobile-tool-grid">
      <button class="ks-mobile-tool" data-ext="prefab"><span class="ks-mobile-icon">▱</span>PREFAB</button>
      <button class="ks-mobile-tool" data-ext="check"><span class="ks-mobile-icon">⌑</span>CHECK MAP</button>
      <button class="ks-mobile-tool on" data-ext="grid"><span class="ks-mobile-icon">▦</span>GRID</button>
      <button class="ks-mobile-tool" data-ext="camera"><span class="ks-mobile-icon">⌖</span>CAMERA</button>
      <button class="ks-mobile-tool" data-ext="zoom-out"><span class="ks-mobile-icon">−</span>ZOOM OUT</button>
      <button class="ks-mobile-tool" data-ext="zoom-in"><span class="ks-mobile-icon">＋</span>ZOOM IN</button>
    </div>
    <div class="ks-mobile-control-row">
      <select data-ext="snap" aria-label="Snap"><option value="1">FREE</option><option value="8">SNAP 8</option><option value="16">SNAP 16</option><option value="32" selected>SNAP 32</option><option value="64">SNAP 64</option></select>
      <button data-ext="zoom-reset">RESET ZOOM</button>
    </div>
  `;

  const settingsPane=document.createElement('div');
  settingsPane.className='ks-mobile-pane';
  settingsPane.dataset.pane='settings';
  settingsPane.innerHTML=`
    <div class="ks-mobile-section-title">STUDIO / QUICK ACTIONS</div>
    <div class="ks-mobile-tool-grid">
      <button class="ks-mobile-tool" data-act="save"><span class="ks-mobile-icon">▣</span>SAVE</button>
      <button class="ks-mobile-tool" data-act="play"><span class="ks-mobile-icon">▶</span>PLAY</button>
      <button class="ks-mobile-tool" data-ext="check"><span class="ks-mobile-icon">⌑</span>CHECK MAP</button>
      <button class="ks-mobile-tool" data-act="close"><span class="ks-mobile-icon">×</span>CLOSE STUDIO</button>
    </div>
  `;
  mobileSheet?.append(paintPane,mapPane,settingsPane);

  const rail=document.createElement('nav');
  rail.className='ks-mobile-rail';
  rail.setAttribute('aria-label','Kelo Studio mobile tools');
  rail.innerHTML=`
    <button data-tab="explorer"><span class="ks-mobile-icon">▱</span>LAYERS</button>
    <button class="on" data-tab="assets"><span class="ks-mobile-icon">◇</span>ASSETS</button>
    <button data-tab="paint"><span class="ks-mobile-icon">✎</span>PAINT</button>
    <button data-tab="map"><span class="ks-mobile-icon">⌘</span>MAP</button>
    <button data-tab="settings"><span class="ks-mobile-icon">⚙</span>SETTINGS</button>
  `;
  root.appendChild(rail);

  const zoomDock=document.createElement('div');
  zoomDock.className='ks-mobile-zoom';
  zoomDock.innerHTML=`
    <button data-ext="zoom-in" aria-label="Zoom in">＋</button>
    <span data-mobile-zoom-label>100%</span>
    <button data-ext="zoom-out" aria-label="Zoom out">−</button>
    <button data-ext="zoom-reset" aria-label="Center camera">⌖</button>
  `;
  root.appendChild(zoomDock);

  const historyDock=document.createElement('div');
  historyDock.className='ks-mobile-history';
  historyDock.innerHTML=`<button data-act="undo" aria-label="Undo">↶</button><button data-act="redo" aria-label="Redo">↷</button>`;
  root.appendChild(historyDock);

  const compactAsset=root.querySelector('.ks-compact-asset');
  const assetPane=root.querySelector('[data-pane="assets"]');
  const assetFooter=document.createElement('div');
  assetFooter.className='ks-mobile-asset-footer';
  if(compactAsset)assetFooter.appendChild(compactAsset);
  assetPane?.appendChild(assetFooter);

  const compactSmall=root.querySelector('.ks-compact-copy small');
  const compactLabel=root.querySelector('.ks-active-asset-label');

  let clipboard=0,grid=true,snap=32,camera=false,zoom=1,modal=null,manualMinimized=false;
  const isReferenceMobile=()=>typeof view.matchMedia==='function'?view.matchMedia('(max-width:900px)').matches:Number(view.innerWidth||0)<=900;
  const isCompact=()=>isReferenceMobile()?manualMinimized:host.classList.contains('ks-compact');
  const selectionCount=()=>Math.max(0,Number(root.dataset.selectionCount)||0);

  function syncTabPeers(tabName){
    if(!tabName)return;
    root.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('on',button.dataset.tab===tabName));
    root.querySelectorAll('[data-pane]').forEach(pane=>pane.classList.toggle('on',pane.dataset.pane===tabName));
    root.dataset.sheetOpen='1';
  }

  function syncAvailability(){
    const hasSelection=selectionCount()>0;
    const copy=editBar.querySelector('[data-ext="copy"]');
    const paste=editBar.querySelector('[data-ext="paste"]');
    if(copy)copy.disabled=!hasSelection;
    if(paste)paste.disabled=!clipboard;
    root.querySelectorAll('[data-ext="prefab"]').forEach(button=>button.disabled=!hasSelection);
  }

  function syncMinimizeUi(){
    const compact=isCompact();
    if(!isReferenceMobile())minimize.textContent=compact?'▴':'—';
    else minimize.textContent='';
    minimize.title=compact?'Expandir Studio':'Minimizar Studio';
    minimize.setAttribute('aria-label',compact?'Expandir Kelo Studio':'Minimizar Kelo Studio');
    root.dataset.creatorMinimized=compact?'1':'0';
    if(compact&&!root.dataset.activeAsset){
      if(compactSmall)compactSmall.textContent='KELO STUDIO';
      if(compactLabel)compactLabel.textContent='MODO CREADOR';
    }else if(root.dataset.activeAsset&&compactSmall){
      compactSmall.textContent='ASSET ACTIVO';
    }
  }

  function setMinimized(next){
    const compact=!!next;
    if(isReferenceMobile()){
      manualMinimized=compact;
      root.dataset.creatorMinimized=compact?'1':'0';
      if(!compact)root.dataset.sheetOpen='1';
      if(compact)document.activeElement?.blur?.();
    }else{
      host.classList.toggle('ks-compact',compact);
      root.dataset.compact=compact?(root.dataset.activeAsset?'asset':'manual'):'full';
      if(compact){root.dataset.sheetOpen='0';document.activeElement?.blur?.();}
    }
    syncMinimizeUi();
    return compact;
  }

  function syncCameraUi(){
    root.querySelectorAll('[data-ext="camera"]').forEach(button=>button.classList.toggle('on',camera));
    root.querySelectorAll('[data-ext="zoom-reset"]').forEach(button=>{
      if(button.classList.contains('ks-zoom-label'))button.textContent=`${Math.round(zoom*100)}%`;
    });
    const mobileZoom=root.querySelector('[data-mobile-zoom-label]');
    if(mobileZoom)mobileZoom.textContent=`${Math.round(zoom*100)}%`;
  }

  function syncGridUi(){
    root.querySelectorAll('[data-ext="grid"]').forEach(button=>button.classList.toggle('on',grid));
  }

  function syncSnapUi(){
    root.querySelectorAll('select[data-ext="snap"]').forEach(select=>select.value=String(snap));
  }

  const observer=new MutationObserver(()=>{
    syncMinimizeUi();
    syncAvailability();
  });
  observer.observe(host,{attributes:true,attributeFilter:['class']});
  observer.observe(root,{attributes:true,attributeFilter:['data-selection-count','data-active-asset']});
  minimize.addEventListener('click',()=>setMinimized(!isCompact()));

  function closeModal(){modal?.remove();modal=null;}

  function modalShell(title){
    closeModal();
    modal=document.createElement('div');
    modal.className='ks-modal-backdrop';
    modal.innerHTML=`<section class="ks-modal"><h3></h3><div class="ks-modal-content"></div><div class="ks-modal-actions"><button data-modal="cancel">CLOSE</button></div></section>`;
    modal.querySelector('h3').textContent=title;
    root.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-modal="cancel"]'))closeModal();});
    return modal.querySelector('.ks-modal-content');
  }

  function openPrefab(){
    const content=modalShell('SAVE AS PREFAB');
    content.innerHTML=`<p>Guarda la selección como una pieza reutilizable. Luego aparecerá en <b>My Prefabs</b>.</p><input data-prefab-name maxlength="48" placeholder="Ej. Blacksmith Shop"><div class="ks-modal-actions"><button data-modal="save-prefab">SAVE PREFAB</button></div>`;
    const input=content.querySelector('input');
    input.value=`Prefab ${Date.now().toString().slice(-4)}`;
    input.focus();
    content.querySelector('[data-modal="save-prefab"]').addEventListener('click',async()=>{
      const label=input.value.trim();if(!label)return;
      const result=await onSavePrefab?.(label);if(result!==false)closeModal();
    });
  }

  function openHealth(report){
    const content=modalShell(report?.ok?'MAP READY':'CHECK MAP');
    const counts=report?.counts||{},errors=report?.errors||[],warnings=report?.warnings||[];
    const title=document.createElement('p');
    title.className=errors.length?'ks-health-error':warnings.length?'ks-health-warn':'ks-health-ok';
    title.textContent=errors.length?`${errors.length} error(es) que debes corregir.`:warnings.length?`Sin errores · ${warnings.length} aviso(s).`:'Sin errores estructurales.';
    content.appendChild(title);
    const countGrid=document.createElement('div');countGrid.className='ks-health-counts';
    for(const [label,value] of [['Objects',counts.objects||0],['Surface',counts.surface||0],['Collision',counts.collisions||0],['Interactive',counts.interactive||0],['AI',counts.ai||0],['Particles',counts.particles||0]]){
      const d=document.createElement('div');d.textContent=label;const b=document.createElement('b');b.textContent=String(value);d.appendChild(b);countGrid.appendChild(d);
    }
    content.appendChild(countGrid);
    if(errors.length){const h=document.createElement('p');h.className='ks-health-error';h.textContent='ERRORS';content.appendChild(h);const ul=document.createElement('ul');for(const row of errors.slice(0,12)){const li=document.createElement('li');li.textContent=row.message;ul.appendChild(li);}content.appendChild(ul);}
    if(warnings.length){const h=document.createElement('p');h.className='ks-health-warn';h.textContent='WARNINGS';content.appendChild(h);const ul=document.createElement('ul');for(const row of warnings.slice(0,12)){const li=document.createElement('li');li.textContent=row.message;ul.appendChild(li);}content.appendChild(ul);}
    const notice=document.createElement('p');notice.textContent=report?.performance?.notice||'';content.appendChild(notice);
  }

  async function handleAction(act,target){
    if(!act)return;
    if(act==='camera'){
      const next=!camera;const result=await onCameraToggle?.(next);camera=typeof result==='boolean'?result:next;syncCameraUi();
    }else if(act==='zoom-in'){
      zoom=Number(await onZoomIn?.())||zoom;syncCameraUi();
    }else if(act==='zoom-out'){
      zoom=Number(await onZoomOut?.())||zoom;syncCameraUi();
    }else if(act==='zoom-reset'){
      zoom=Number(await onZoomReset?.())||1;syncCameraUi();
    }else if(act==='copy'){
      clipboard=Number(await onCopy?.())||0;syncAvailability();
    }else if(act==='paste'){
      await onPaste?.();
    }else if(act==='prefab'){
      openPrefab();
    }else if(act==='check'){
      openHealth(await onValidate?.());
    }else if(act==='grid'){
      grid=!grid;syncGridUi();onGridToggle?.(grid);
    }
  }

  function extClickHandler(e){
    const target=e.target.closest('[data-ext]');if(!target)return;
    e.preventDefault();e.stopPropagation();handleAction(target.dataset.ext,target);
  }
  editBar.addEventListener('click',extClickHandler);
  mapBar.addEventListener('click',extClickHandler);
  viewBar.addEventListener('click',extClickHandler);
  rail.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab]');
    if(tab)queueMicrotask(()=>syncTabPeers(tab.dataset.tab));
  });
  zoomDock.addEventListener('click',extClickHandler);
  mapPane.addEventListener('click',e=>{const target=e.target.closest('[data-ext]');if(target){e.preventDefault();e.stopPropagation();handleAction(target.dataset.ext,target);}});
  settingsPane.addEventListener('click',e=>{const target=e.target.closest('[data-ext]');if(target){e.preventDefault();e.stopPropagation();handleAction(target.dataset.ext,target);}});

  function snapChangeHandler(e){
    if(!e.target.matches('select[data-ext="snap"]'))return;
    snap=Math.max(1,Number(e.target.value)||1);syncSnapUi();onSnapChange?.(snap);
  }
  mapBar.addEventListener('change',snapChangeHandler);
  mapPane.addEventListener('change',snapChangeHandler);

  root.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab]');
    if(tab)queueMicrotask(()=>syncTabPeers(tab.dataset.tab));
  });

  const resizeHandler=()=>{
    if(!isReferenceMobile())manualMinimized=false;
    syncMinimizeUi();syncCameraUi();
  };
  view.addEventListener?.('resize',resizeHandler,{passive:true});
  view.addEventListener?.('orientationchange',resizeHandler,{passive:true});

  syncCameraUi();syncGridUi();syncSnapUi();syncMinimizeUi();syncAvailability();
  if(isReferenceMobile())syncTabPeers('assets');

  return Object.freeze({
    setClipboard(count){clipboard=Math.max(0,Number(count)||0);syncAvailability();},
    setSnap(value){snap=Math.max(1,Number(value)||1);syncSnapUi();},
    setGrid(value){grid=!!value;syncGridUi();},
    setCamera(value){camera=!!value;syncCameraUi();},
    setZoom(value){zoom=Math.max(.01,Number(value)||1);syncCameraUi();},
    setMinimized,
    showHealth:openHealth,
    destroy(){
      closeModal();observer.disconnect();
      view.removeEventListener?.('resize',resizeHandler);view.removeEventListener?.('orientationchange',resizeHandler);
      minimize.remove();editBar.remove();mapBar.remove();viewBar.remove();rail.remove();zoomDock.remove();historyDock.remove();paintPane.remove();mapPane.remove();settingsPane.remove();assetFooter.remove();style.remove();
    },
    get minimized(){return isCompact();},
    get snap(){return snap;},get grid(){return grid;},get camera(){return camera;},get zoom(){return zoom;}
  });
}

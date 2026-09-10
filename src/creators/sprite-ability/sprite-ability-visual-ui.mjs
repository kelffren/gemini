/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY VISUAL UI
 * owner: Sprite Ability Builder presentation layer
 * keys: MOBILE VISUAL LIVE PREVIEW SLIDERS TIMING ACTIVE IMPACT HITBOX TOUCH
 * purpose: convertir el builder técnico en un editor mobile-first visual sin duplicar autoridad de combate
 * does-not-own: combat math, document normalization, project persistence or runtime authority
 * reuse: reads/writes the existing Sprite Ability controls so generated drafts keep the same canonical pipeline
 */
import { getSpriteAbilityBuilder } from './sprite-ability-live-controller.mjs';

const STYLE_ID='kelo-sprite-ability-visual-v13-style';
const CONTROL_SPECS=[
  {field:'Damage',label:'Daño',help:'Cuánto daño inflige la habilidad.',icon:'✦',tone:'damage',min:0,max:100,step:1},
  {field:'Range',label:'Rango',help:'Distancia de alcance.',icon:'◎',tone:'range',min:8,max:320,step:1},
  {field:'Arc °',label:'Arco de ataque',help:'Ángulo de cobertura.',icon:'◒',tone:'arc',min:1,max:360,step:1},
  {field:'Knockback',label:'Retroceso',help:'Fuerza de empuje al golpear.',icon:'➤',tone:'knockback',min:0,max:80,step:1},
  {field:'Hitstop ms',label:'Hitstop',help:'Pausa al impactar.',icon:'⌛',tone:'hitstop',min:0,max:250,step:1},
  {field:'Impact Frame',label:'Frame de impacto',help:'Cuándo ocurre el golpe.',icon:'ϟ',tone:'impact',min:0,max:60,step:1,dynamic:true},
];

const CSS=`
#kelo-studio-workspace.sab-visual-v13{--sab-gold:#e4ba57;--sab-blue:#35a9ff;--sab-red:#ff4f62;--sab-purple:#b869ff;--sab-green:#29e6a1;--sab-panel:rgba(7,18,25,.96);--sab-line:rgba(173,213,231,.20)}
#kelo-studio-workspace .sab-v-brand,#kelo-studio-workspace .sab-v-live,#kelo-studio-workspace .sab-v-preview-tools,#kelo-studio-workspace .sab-v-transport,#kelo-studio-workspace .sab-v-controls,#kelo-studio-workspace .sab-v-timing{display:none}
@media(max-width:760px){
body.kelo-sprite-ability-builder-active{overflow:hidden!important}
#kelo-studio-workspace.sab-visual-v13{display:block;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;pointer-events:auto;background:radial-gradient(circle at 50% 0,rgba(14,67,111,.28),transparent 35%),linear-gradient(180deg,#06111a 0%,#030a10 65%,#07121b 100%);padding:8px 10px max(24px,env(safe-area-inset-bottom));scrollbar-width:none}
#kelo-studio-workspace.sab-visual-v13::-webkit-scrollbar{display:none}
#kelo-studio-workspace.sab-visual-v13:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.28;background-image:linear-gradient(45deg,transparent 48%,rgba(231,197,106,.035) 49%,rgba(231,197,106,.035) 51%,transparent 52%);background-size:34px 34px}
#kelo-studio-workspace.sab-visual-v13 .ksw-top{position:sticky!important;inset:auto!important;top:0!important;z-index:30;width:100%;height:68px;margin:0;padding:8px 10px;border:1px solid rgba(231,197,106,.42);border-radius:16px;background:rgba(4,14,21,.96);box-shadow:0 12px 30px rgba(0,0,0,.34);transform:none!important;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center}
#kelo-studio-workspace.sab-visual-v13 .ksw-title{max-width:none;font-size:14px;letter-spacing:.18em;color:#fff7dd;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#kelo-studio-workspace.sab-visual-v13 .ksw-title:after{content:'CREA Y AJUSTA HABILIDADES';display:block;margin-top:3px;font:700 7px/1 system-ui;letter-spacing:.16em;color:#778f9c}
#kelo-studio-workspace.sab-visual-v13 .ksw-badge,#kelo-studio-workspace.sab-visual-v13 .ksw-top [data-act="undo"],#kelo-studio-workspace.sab-visual-v13 .ksw-top [data-act="redo"],#kelo-studio-workspace.sab-visual-v13 .ksw-top [data-act="preview"]{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .ksw-spacer{display:none}
#kelo-studio-workspace.sab-visual-v13 .ksw-top button{height:42px;padding:0 13px;border-radius:11px;font-size:9px}
#kelo-studio-workspace.sab-visual-v13 .ksw-top [data-act="save"]{border-color:var(--sab-gold);color:#ffedae;background:rgba(231,197,106,.055);letter-spacing:.11em}
#kelo-studio-workspace.sab-visual-v13 .ksw-top [data-act="close"]{width:42px;padding:0;font-size:18px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-brand{display:flex;align-items:center;gap:7px;color:#f0c769;min-width:72px;font-family:Georgia,serif;font-weight:900;letter-spacing:.12em;font-size:10px;line-height:1.05}
#kelo-studio-workspace.sab-visual-v13 .sab-v-brand-mark{font-size:25px;filter:drop-shadow(0 0 9px rgba(231,197,106,.25))}
#kelo-studio-workspace.sab-visual-v13 .sab-v-brand small{display:block;font:800 6px system-ui;letter-spacing:.28em;color:#d9b35b;margin-top:2px}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs{position:relative!important;left:auto!important;right:auto!important;top:auto!important;z-index:20;display:flex!important;width:100%;height:58px;margin:8px 0 0;padding:7px 2px;align-items:center;gap:7px;border-bottom:1px solid rgba(231,197,106,.18);background:transparent;pointer-events:auto;overflow:visible}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs>button{height:42px;padding:0 16px;border-radius:11px;font-size:9px;letter-spacing:.08em;background:rgba(8,20,27,.8)}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs>button[data-act="preview-mobile"]{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs .sab-mode{position:static!important;left:auto!important;top:auto!important;transform:none!important;margin-left:auto;display:flex!important;gap:6px;z-index:auto}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs .sab-mode button{height:42px;min-width:74px;padding:0 12px;border-radius:11px;font-size:9px;background:rgba(8,20,27,.9);border:1px solid rgba(173,213,231,.18);color:#dce8ee}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs .sab-mode button.on{border-color:#299bff;color:#fff;box-shadow:0 0 0 1px #1777ff inset,0 0 15px rgba(25,132,255,.45);background:rgba(22,85,145,.18)}
#kelo-studio-workspace.sab-visual-v13 .ksw-main{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:block!important;width:100%;height:340px;margin:0;padding:0;pointer-events:none}
#kelo-studio-workspace.sab-visual-v13 .ksw-viewport{position:relative!important;inset:auto!important;width:100%;height:100%;border:1px solid rgba(231,197,106,.58);border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#0a1a21,#071118);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03),0 14px 35px rgba(0,0,0,.32);pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .ksw-viewport canvas{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain}
#kelo-studio-workspace.sab-visual-v13 .ksw-viewport-card,#kelo-studio-workspace.sab-visual-v13 .sab-hitbox-hint{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .ksw-side{display:none;position:absolute!important;inset:8px!important;width:auto!important;height:auto!important;z-index:18;border-radius:14px;background:rgba(4,13,18,.985);box-shadow:0 20px 45px rgba(0,0,0,.55);pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .ksw-side.mobile-open{display:block!important}
#kelo-studio-workspace.sab-visual-v13 .sab-v-live{display:flex;position:absolute;left:12px;top:12px;z-index:12;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(4,15,21,.82);backdrop-filter:blur(8px);color:#f1f6f4;font:850 10px/1.15 system-ui;pointer-events:none}
#kelo-studio-workspace.sab-visual-v13 .sab-v-live:before{content:'';width:10px;height:10px;border-radius:50%;background:#35f85a;box-shadow:0 0 12px rgba(53,248,90,.75)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-live small{display:block;margin-top:3px;color:#93a6af;font:650 7px system-ui}
#kelo-studio-workspace.sab-visual-v13 .sab-v-preview-tools{display:flex;position:absolute;right:10px;top:10px;z-index:12;gap:5px;pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .sab-v-preview-tools button{height:34px;min-width:42px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(4,15,21,.82);color:#c9d5dc;font:850 8px system-ui}
#kelo-studio-workspace.sab-visual-v13 .sab-v-preview-tools button.on{border-color:#299bff;color:white;box-shadow:0 0 12px rgba(41,155,255,.38)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-transport{display:flex;position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:12;gap:8px;align-items:center;pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .sab-v-transport button{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(3,13,19,.88);color:white;font:950 16px system-ui;box-shadow:0 5px 14px rgba(0,0,0,.28)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-transport button[data-v-play]{width:54px;height:54px;border-color:#299bff;box-shadow:0 0 0 1px #1f7dff inset,0 0 16px rgba(41,155,255,.45);font-size:20px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-transport button[data-v-full]{position:absolute;left:calc(50vw - 76px);width:38px;height:38px;border-radius:9px;font-size:13px}
#kelo-studio-workspace.sab-visual-v13 .ksw-status{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .ksw-timeline{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;width:100%;height:194px;margin:10px 0 0;border:1px solid var(--sab-line);border-radius:15px;overflow:hidden;background:rgba(4,15,21,.92);pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .sab-timeline{height:112px!important;display:block!important}
#kelo-studio-workspace.sab-visual-v13 .sab-timeline-tools{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .sab-timeline-scroll{height:112px;padding:9px 10px 8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
#kelo-studio-workspace.sab-visual-v13 .sab-timeline-scroll::-webkit-scrollbar{display:none}
#kelo-studio-workspace.sab-visual-v13 .sab-timeline-track{height:92px;gap:4px}
#kelo-studio-workspace.sab-visual-v13 .sab-frame{width:52px!important;min-height:82px!important;border-radius:6px;background:#081319}
#kelo-studio-workspace.sab-visual-v13 .sab-frame canvas{width:44px!important;height:49px!important;margin-top:4px}
#kelo-studio-workspace.sab-visual-v13 .sab-frame-num{display:none!important}
#kelo-studio-workspace.sab-visual-v13 .sab-frame-phase{height:16px!important;font-size:5px!important;bottom:2px!important}
#kelo-studio-workspace.sab-visual-v13 .sab-frame.current{outline-color:#2b9bff!important;box-shadow:0 0 12px rgba(43,155,255,.45)}
#kelo-studio-workspace.sab-visual-v13 .sab-hit-marker:before{background:#ffbd3b;color:#251600}
#kelo-studio-workspace.sab-visual-v13 .sab-hit-marker:after{background:#ffd35d}
#kelo-studio-workspace.sab-visual-v13 .sab-v-timing{display:grid;height:80px;grid-template-rows:1fr 1fr;gap:2px;padding:0 12px 8px;border-top:1px solid rgba(255,255,255,.055)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-lane{display:grid;grid-template-columns:86px minmax(0,1fr);align-items:center;gap:8px;color:#aebbc1;font:750 8px system-ui;touch-action:none}
#kelo-studio-workspace.sab-visual-v13 .sab-v-line{position:relative;height:4px;border-radius:99px;background:rgba(177,205,218,.16)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-active-fill{position:absolute;top:-2px;height:8px;border-radius:99px;background:#269dff;box-shadow:0 0 10px rgba(38,157,255,.4)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-active-fill:before,#kelo-studio-workspace.sab-visual-v13 .sab-v-active-fill:after{content:'';position:absolute;top:50%;width:10px;height:18px;border-radius:5px;background:#4eb5ff;transform:translate(-50%,-50%);box-shadow:0 0 8px rgba(41,155,255,.5)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-active-fill:after{left:100%}
#kelo-studio-workspace.sab-visual-v13 .sab-v-impact-dot{position:absolute;top:50%;width:13px;height:13px;background:#ffd357;transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 10px rgba(255,211,87,.5)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-controls{display:block;position:relative;width:100%;margin-top:14px;padding-bottom:14px;pointer-events:auto}
#kelo-studio-workspace.sab-visual-v13 .sab-v-section-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 9px;color:#e9c56b;font:900 10px system-ui;letter-spacing:.19em}
#kelo-studio-workspace.sab-visual-v13 .sab-v-section-head button{border:0;background:transparent;color:#9caeb6;font:750 8px system-ui;padding:8px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card{--tone:#35a9ff;min-width:0;min-height:112px;padding:12px;border:1px solid rgba(172,211,229,.22);border-radius:14px;background:linear-gradient(145deg,rgba(13,30,39,.96),rgba(6,18,25,.96));box-shadow:inset 0 1px rgba(255,255,255,.025);display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;align-items:center}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="damage"]{--tone:var(--sab-red)}#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="range"]{--tone:#4bb6ff}#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="arc"]{--tone:#ffd45f}#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="knockback"]{--tone:var(--sab-purple)}#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="hitstop"]{--tone:var(--sab-green)}#kelo-studio-workspace.sab-visual-v13 .sab-v-card[data-tone="impact"]{--tone:#ffbd3b}
#kelo-studio-workspace.sab-visual-v13 .sab-v-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:var(--tone);font:950 26px system-ui;text-shadow:0 0 12px rgba(255,255,255,.14);background:rgba(255,255,255,.035)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card-main{min-width:0}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#f1f4f5;font:850 9px system-ui}
#kelo-studio-workspace.sab-visual-v13 .sab-v-value{min-width:43px;padding:5px 7px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#fff;text-align:center;font:900 9px system-ui;background:rgba(2,10,15,.55)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card input[type="range"]{appearance:none;-webkit-appearance:none;width:100%;height:28px;margin:2px 0 0;background:transparent;touch-action:pan-y}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card input[type="range"]::-webkit-slider-runnable-track{height:7px;border-radius:99px;background:linear-gradient(90deg,var(--tone) 0 var(--fill,50%),rgba(150,180,194,.16) var(--fill,50%) 100%)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:21px;height:21px;margin-top:-7px;border:0;border-radius:50%;background:var(--tone);box-shadow:0 0 12px rgba(255,255,255,.12)}
#kelo-studio-workspace.sab-visual-v13 .sab-v-help{display:block;margin-top:0;color:#7f939c;font:650 7px/1.25 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#kelo-studio-workspace.sab-visual-v13 .sab-v-advanced{width:100%;height:58px;margin-top:10px;border:1px solid rgba(231,197,106,.58);border-radius:14px;background:rgba(6,17,24,.95);color:#e7ecee;text-align:left;padding:0 17px;font:850 9px system-ui;letter-spacing:.11em}
#kelo-studio-workspace.sab-visual-v13 .sab-v-advanced:after{content:'⌄';float:right;color:white;font-size:17px;line-height:1}
#kelo-studio-workspace.sab-visual-v13 .sab-v-foot{margin:14px 0 4px;text-align:center;color:#617985;font:750 7px system-ui;letter-spacing:.22em}
#kelo-studio-workspace.sab-visual-v13.preview-focus{overflow:hidden;padding:0;background:#02080d}
#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-top{position:fixed!important;left:8px!important;right:8px!important;top:max(8px,env(safe-area-inset-top))!important;width:auto!important;height:50px!important;display:flex!important}
#kelo-studio-workspace.sab-visual-v13.preview-focus .sab-v-brand,#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-title,#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-top [data-act="close"]{display:none!important}
#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-top [data-act="preview"]{display:block!important;margin-left:auto}
#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-main{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important}
#kelo-studio-workspace.sab-visual-v13.preview-focus .ksw-viewport{border:0;border-radius:0}
#kelo-studio-workspace.sab-visual-v13.preview-focus .sab-v-live,#kelo-studio-workspace.sab-visual-v13.preview-focus .sab-v-preview-tools,#kelo-studio-workspace.sab-visual-v13.preview-focus .sab-v-transport{display:flex!important}
}
@media(max-width:430px){
#kelo-studio-workspace.sab-visual-v13{padding-left:7px;padding-right:7px}
#kelo-studio-workspace.sab-visual-v13 .ksw-top{grid-template-columns:58px minmax(0,1fr) auto auto;padding:7px 8px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-brand{min-width:58px;font-size:8px}#kelo-studio-workspace.sab-visual-v13 .sab-v-brand-mark{font-size:20px!important}
#kelo-studio-workspace.sab-visual-v13 .ksw-title{font-size:11px}
#kelo-studio-workspace.sab-visual-v13 .ksw-top button{height:38px;padding:0 10px;font-size:8px}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs>button{padding:0 11px;min-width:66px}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs .sab-mode{gap:4px}
#kelo-studio-workspace.sab-visual-v13 .ksw-mobile-tabs .sab-mode button{min-width:61px;padding:0 8px;font-size:8px}
#kelo-studio-workspace.sab-visual-v13 .ksw-main{height:300px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card{min-height:104px;padding:10px;grid-template-columns:34px minmax(0,1fr);gap:7px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-icon{width:34px;height:34px;font-size:21px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-card-head{font-size:8px}
#kelo-studio-workspace.sab-visual-v13 .sab-v-help{font-size:6.5px}
}
`;

function addStyle(doc){if(doc.getElementById(STYLE_ID))return;const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);}
function el(doc,tag,className,text=''){const node=doc.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;}
function byField(root,label){for(const row of root.querySelectorAll('.ksw-right .ksw-field')){if(row.querySelector('label')?.textContent?.trim()===label)return row.querySelector('input,select');}return null;}
function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function emitChange(root,label,value){const input=byField(root,label);if(!input)return false;input.value=String(value);const EventCtor=root.ownerDocument?.defaultView?.Event||Event;input.dispatchEvent(new EventCtor('change',{bubbles:true}));return true;}
function clickBy(root,selector,predicate){const nodes=[...root.querySelectorAll(selector)];const node=nodes.find(predicate);node?.click();return Boolean(node);}
function clickTimelineText(root,text){return clickBy(root,'.ksw-timeline button',b=>b.textContent?.trim()===text);}
function pct(value,min,max){const den=Math.max(1,max-min);return Math.max(0,Math.min(100,((value-min)/den)*100));}

function mountVisual(rootEl){
  if(!rootEl||rootEl.dataset.sabVisualReady==='1')return;
  const doc=rootEl.ownerDocument;rootEl.dataset.sabVisualReady='1';rootEl.classList.add('sab-visual-v13');
  const top=rootEl.querySelector('.ksw-top'),title=top?.querySelector('.ksw-title');
  if(top&&title&&!top.querySelector('.sab-v-brand')){const brand=el(doc,'div','sab-v-brand');brand.innerHTML='<span class="sab-v-brand-mark">✦</span><span>KELO<small>WORLD</small></span>';top.insertBefore(brand,title);}
  const save=top?.querySelector('[data-act="save"]');if(save)save.textContent='GUARDAR';
  if(title)title.textContent='SPRITE ABILITY';
  const tabs=rootEl.querySelector('.ksw-mobile-tabs');
  const leftTab=tabs?.querySelector('[data-panel="left"]'),rightTab=tabs?.querySelector('[data-panel="right"]');if(leftTab)leftTab.textContent='CLIP';if(rightTab)rightTab.textContent='EVENTOS';

  const viewport=rootEl.querySelector('.ksw-viewport');
  if(viewport&&!viewport.querySelector('.sab-v-live')){
    const live=el(doc,'div','sab-v-live');live.innerHTML='<span>Vista en tiempo real<small>Se actualiza al instante</small></span>';
    const speeds=el(doc,'div','sab-v-preview-tools');for(const rate of [1,.5,.25]){const b=el(doc,'button','',`${rate}x`);b.type='button';b.dataset.vSpeed=String(rate);b.onclick=()=>{clickBy(rootEl,'.ksw-timeline [data-speed]',n=>Number(n.dataset.speed)===rate);syncVisual(rootEl);};speeds.append(b);}
    const transport=el(doc,'div','sab-v-transport');
    const prev=el(doc,'button','','◀');prev.type='button';prev.onclick=()=>clickTimelineText(rootEl,'◀');
    const play=el(doc,'button','','▶');play.type='button';play.dataset.vPlay='';play.onclick=()=>{clickBy(rootEl,'.ksw-timeline [data-sab-play]',()=>true);syncVisual(rootEl);};
    const next=el(doc,'button','','▶|');next.type='button';next.onclick=()=>clickTimelineText(rootEl,'▶|');
    const full=el(doc,'button','','⛶');full.type='button';full.dataset.vFull='';full.onclick=()=>rootEl.querySelector('[data-act="preview-mobile"]')?.click();
    transport.append(prev,play,next,full);viewport.append(live,speeds,transport);
  }

  if(!rootEl.querySelector('.sab-v-controls')){
    const controls=el(doc,'section','sab-v-controls');
    const head=el(doc,'div','sab-v-section-head');head.innerHTML='<span>⚔ AJUSTES PRINCIPALES</span>';
    const reset=el(doc,'button','','↻ Restablecer');reset.type='button';reset.onclick=()=>{const defaults={Damage:18,Range:120,'Arc °':92,Knockback:18,'Hitstop ms':45};for(const [field,value] of Object.entries(defaults))emitChange(rootEl,field,value);syncVisual(rootEl);};head.append(reset);
    const grid=el(doc,'div','sab-v-grid');
    for(const spec of CONTROL_SPECS){
      const card=el(doc,'article','sab-v-card');card.dataset.tone=spec.tone;card.dataset.field=spec.field;
      const icon=el(doc,'div','sab-v-icon',spec.icon),main=el(doc,'div','sab-v-card-main'),cardHead=el(doc,'div','sab-v-card-head'),label=el(doc,'span','',spec.label),value=el(doc,'output','sab-v-value','—'),range=doc.createElement('input'),help=el(doc,'small','sab-v-help',spec.help);
      range.type='range';range.min=String(spec.min);range.max=String(spec.max);range.step=String(spec.step);range.dataset.vRange=spec.field;
      range.oninput=()=>{value.textContent=range.value;range.style.setProperty('--fill',`${pct(number(range.value),number(range.min),number(range.max))}%`);emitChange(rootEl,spec.field,number(range.value));};
      cardHead.append(label,value);main.append(cardHead,range,help);card.append(icon,main);grid.append(card);
    }
    const advanced=el(doc,'button','sab-v-advanced','⚙  VALORES AVANZADOS');advanced.type='button';advanced.onclick=()=>rightTab?.click();
    const foot=el(doc,'div','sab-v-foot','CREA • PRUEBA • AJUSTA • JUEGA');
    controls.append(head,grid,advanced,foot);rootEl.append(controls);
  }

  if(!rootEl.__sabTimingPointerBound){rootEl.__sabTimingPointerBound=true;const move=e=>{const drag=rootEl.__sabTimingDrag;if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();const ratio=Math.max(0,Math.min(1,(e.clientX-drag.left)/Math.max(1,drag.width))),f=Math.round(drag.min+ratio*(drag.max-drag.min));if(drag.mode==='impact')emitChange(rootEl,'Impact Frame',f);else emitChange(rootEl,drag.field,f);syncVisual(rootEl);};const end=e=>{if(rootEl.__sabTimingDrag?.pointerId!==e.pointerId)return;rootEl.__sabTimingDrag=null;};rootEl.addEventListener('pointermove',move);rootEl.addEventListener('pointerup',end);rootEl.addEventListener('pointercancel',end);}
  const rootObserver=new MutationObserver(()=>{syncStructure(rootEl);syncVisual(rootEl);});rootObserver.observe(rootEl,{childList:true,subtree:true});rootEl.__sabVisualObserver=rootObserver;
  syncStructure(rootEl);syncVisual(rootEl);
}

function ensureTiming(rootEl){
  const timeline=rootEl.querySelector('.ksw-timeline');if(!timeline||timeline.querySelector('.sab-v-timing'))return;
  const doc=rootEl.ownerDocument,wrap=el(doc,'div','sab-v-timing');
  const activeLane=el(doc,'div','sab-v-lane'),activeLabel=el(doc,'span','','Ventana activa'),activeLine=el(doc,'div','sab-v-line'),activeFill=el(doc,'div','sab-v-active-fill');activeLine.append(activeFill);activeLane.append(activeLabel,activeLine);
  const impactLane=el(doc,'div','sab-v-lane'),impactLabel=el(doc,'span','','Impacto'),impactLine=el(doc,'div','sab-v-line'),impactDot=el(doc,'div','sab-v-impact-dot');impactLine.append(impactDot);impactLane.append(impactLabel,impactLine);wrap.append(activeLane,impactLane);timeline.append(wrap);
  const startDrag=(event,line,mode)=>{event.preventDefault();const d=getSpriteAbilityBuilder()?.draft;if(!d)return;const r=line.getBoundingClientRect(),min=number(d.sheet.startFrame,0),max=number(d.sheet.endFrame,1),ratio=Math.max(0,Math.min(1,(event.clientX-r.left)/Math.max(1,r.width))),f=Math.round(min+ratio*(max-min));let field=null;if(mode==='impact'){field='Impact Frame';emitChange(rootEl,field,f);}else{const a=number(d.combat.activeStartFrame),z=number(d.combat.activeEndFrame);field=Math.abs(f-a)<=Math.abs(f-z)?'Active Start':'Active End';emitChange(rootEl,field,f);}rootEl.__sabTimingDrag={pointerId:event.pointerId,mode,field,left:r.left,width:r.width,min,max};syncVisual(rootEl);};
  activeLine.addEventListener('pointerdown',e=>startDrag(e,activeLine,'active'));impactLine.addEventListener('pointerdown',e=>startDrag(e,impactLine,'impact'));
}
function syncStructure(rootEl){
  const tabs=rootEl.querySelector('.ksw-mobile-tabs'),modes=rootEl.querySelector('.sab-mode');if(tabs&&modes&&modes.parentElement!==tabs)tabs.append(modes);
  ensureTiming(rootEl);
  if(rootEl.dataset.sabVisualHitboxBoot!=='1'){const hitbox=rootEl.querySelector('.ksw-timeline [data-hitbox]');if(hitbox){rootEl.dataset.sabVisualHitboxBoot='1';if(!hitbox.classList.contains('on'))hitbox.click();}}
}

function syncVisual(rootEl){
  const active=getSpriteAbilityBuilder(),d=active?.draft;if(!d)return;
  for(const spec of CONTROL_SPECS){const card=rootEl.querySelector(`.sab-v-card[data-field="${CSS.escape(spec.field)}"]`),range=card?.querySelector('input[type="range"]'),output=card?.querySelector('output');if(!range)continue;const source=byField(rootEl,spec.field),value=number(source?.value,spec.field==='Impact Frame'?d.combat.impactFrame:0);if(spec.dynamic){range.min=String(d.sheet.startFrame);range.max=String(d.sheet.endFrame);}range.value=String(value);if(output)output.textContent=String(Math.round(value*100)/100);range.style.setProperty('--fill',`${pct(value,number(range.min),number(range.max))}%`);}
  const start=pct(d.combat.activeStartFrame,d.sheet.startFrame,d.sheet.endFrame),end=pct(d.combat.activeEndFrame,d.sheet.startFrame,d.sheet.endFrame),impact=pct(d.combat.impactFrame,d.sheet.startFrame,d.sheet.endFrame),fill=rootEl.querySelector('.sab-v-active-fill'),dot=rootEl.querySelector('.sab-v-impact-dot');if(fill){fill.style.left=`${start}%`;fill.style.width=`${Math.max(1,end-start)}%`;}if(dot)dot.style.left=`${impact}%`;
  const play=rootEl.querySelector('[data-v-play]'),nativePlay=rootEl.querySelector('.ksw-timeline [data-sab-play]');if(play&&nativePlay)play.textContent=nativePlay.textContent?.includes('■')?'Ⅱ':'▶';
  const rate=number(d.preview?.playbackRate,1);for(const b of rootEl.querySelectorAll('[data-v-speed]'))b.classList.toggle('on',number(b.dataset.vSpeed)===rate);
}

export function installSpriteAbilityVisualUI({root=globalThis}={}){
  const doc=root.document;if(!doc)return ()=>{};addStyle(doc);
  const scan=()=>{if(!doc.body?.classList.contains('kelo-sprite-ability-builder-active'))return;const workspace=doc.getElementById('kelo-studio-workspace');if(workspace)mountVisual(workspace);};
  const observer=new MutationObserver(scan);observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});scan();
  return ()=>observer.disconnect();
}

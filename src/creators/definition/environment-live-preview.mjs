/* KELO-INDEX
 * area: CREATORS / ENVIRONMENT LIVE PREVIEW
 * owner: generic Environment definition workspace
 * owns: zero-network visual preview model + DOM renderer
 * does-not-own: prompt parsing, persistence, gameplay runtime or world authority
 */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const safe=(value,fallback='')=>String(value??fallback).trim().toLowerCase();
const BIOMES=new Set(['plaza','city','forest','swamp','desert','snow','coast']);
const WEATHERS=new Set(['clear','rain','fog','storm','snow']);
const TIMES=new Set(['dawn','day','sunset','night']);
const SKY=Object.freeze({
  dawn:'linear-gradient(180deg,#262d58 0%,#d78375 48%,#efbd79 72%,#cbd0aa 100%)',
  day:'linear-gradient(180deg,#4b91c6 0%,#8fc3e1 56%,#d9e5d7 100%)',
  sunset:'linear-gradient(180deg,#2f2547 0%,#b94f55 43%,#ef9a55 72%,#493c55 100%)',
  night:'linear-gradient(180deg,#050914 0%,#0c1a35 52%,#172a39 100%)'
});
const GROUND=Object.freeze({
  plaza:'#242631',city:'#20252d',forest:'#14261f',swamp:'#1a2925',desert:'#8d6036',snow:'#cbd5dc',coast:'#5f704f'
});
const ACCENTS=Object.freeze({red:'rgba(223,72,72,.28)',orange:'rgba(233,137,54,.27)',yellow:'rgba(242,202,76,.22)',green:'rgba(70,180,110,.23)',blue:'rgba(67,124,220,.27)',purple:'rgba(137,85,214,.28)',pink:'rgba(232,105,167,.25)',white:'rgba(255,255,255,.16)',black:'rgba(0,0,0,.32)',gold:'rgba(220,178,73,.28)',silver:'rgba(190,204,220,.20)',teal:'rgba(50,170,166,.25)'});
const COLOR_KEYS=Object.freeze(Object.keys(ACCENTS));
const LIGHTING_KEYS=Object.freeze(['moonlit','golden','neon','soft','bright','low-light']);
const ATMOSPHERE_KEYS=Object.freeze(['cinematic','luxury','futuristic','creepy','dreamy']);

function extractIntent(notes=''){
  const text=String(notes||'').toLowerCase();
  return Object.freeze({
    palette:Object.freeze(COLOR_KEYS.filter(key=>text.includes(key))),
    lighting:LIGHTING_KEYS.find(key=>text.includes(key))||'',
    atmosphere:Object.freeze(ATMOSPHERE_KEYS.filter(key=>text.includes(key)))
  });
}
function explicitAccent(value){const text=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(text)?text:'';}

export function createEnvironmentPreviewModel(draft={}){
  const fields=draft?.fields&&typeof draft.fields==='object'?draft.fields:{};
  const biome=BIOMES.has(safe(fields.biome))?safe(fields.biome):'plaza';
  const weather=WEATHERS.has(safe(fields.weather))?safe(fields.weather):'clear';
  const timeOfDay=TIMES.has(safe(fields.timeOfDay))?safe(fields.timeOfDay):'day';
  const ambientDensity=clamp(fields.ambientDensity??50,0,100);
  const musicMood=safe(fields.musicMood,'calm')||'calm';
  const intent=extractIntent(fields.notes);
  const featureCount=Math.round(clamp(4+ambientDensity/8,4,16));
  const particleCount=weather==='clear'||weather==='fog'?0:Math.round(clamp(4+ambientDensity/7,4,18));
  const primaryColor=intent.palette[0]||'',savedAccent=explicitAccent(fields.accent??draft?.accent);
  return Object.freeze({
    biome,weather,timeOfDay,ambientDensity,musicMood,intent,featureCount,particleCount,
    sky:SKY[timeOfDay],ground:GROUND[biome],accent:savedAccent||ACCENTS[primaryColor]||'rgba(215,182,107,.12)',
    referenceImage:typeof draft?.referenceImage==='string'?draft.referenceImage:'',
    label:`${biome} · ${weather} · ${timeOfDay} · ${Math.round(ambientDensity)}%`
  });
}

function installStyle(doc){
  if(doc.querySelector?.('style[data-kelo-environment-live-preview]'))return;
  const style=doc.createElement('style');style.dataset.keloEnvironmentLivePreview='1';style.textContent=`
.kds-env-scene{position:relative;width:100%;height:100%;min-height:145px;overflow:hidden;isolation:isolate;background:#070b10;color:#fff;font-family:system-ui,-apple-system,sans-serif}.kds-env-sky,.kds-env-ref,.kds-env-tint,.kds-env-ground,.kds-env-features,.kds-env-weather,.kds-env-fog,.kds-env-flash{position:absolute;inset:0}.kds-env-sky{background:var(--kds-env-sky);transition:background .2s ease}.kds-env-ref{width:100%;height:100%;object-fit:cover;opacity:.5;filter:saturate(.92) contrast(1.06)}.kds-env-tint{background:linear-gradient(180deg,transparent 10%,var(--kds-env-accent) 100%);mix-blend-mode:screen;pointer-events:none}.kds-env-celestial{position:absolute;right:12%;top:13%;width:28px;height:28px;border-radius:50%;background:#ffe6a0;box-shadow:0 0 28px rgba(255,221,137,.35)}.kds-env-scene[data-time="night"] .kds-env-celestial{background:#dce6ef;box-shadow:0 0 28px rgba(191,220,255,.25)}.kds-env-scene[data-time="sunset"] .kds-env-celestial{background:#ffd09a}.kds-env-scene[data-time="dawn"] .kds-env-celestial{background:#ffe2b4}.kds-env-ground{top:auto;height:35%;background:linear-gradient(180deg,color-mix(in srgb,var(--kds-env-ground) 78%,transparent),var(--kds-env-ground));border-top:1px solid rgba(255,255,255,.06)}.kds-env-features{top:auto;height:58%;bottom:20%;pointer-events:none}.kds-env-feature{position:absolute;left:var(--x);bottom:0;width:var(--w);height:var(--h);opacity:var(--o);transform:translateZ(0)}.kds-env-scene[data-biome="forest"] .kds-env-feature,.kds-env-scene[data-biome="snow"] .kds-env-feature{background:linear-gradient(180deg,#254b36,#10291f);clip-path:polygon(50% 0,72% 28%,60% 28%,86% 62%,68% 62%,100% 100%,0 100%,32% 62%,14% 62%,40% 28%,28% 28%)}.kds-env-scene[data-biome="snow"] .kds-env-feature{background:linear-gradient(180deg,#e7f0f4 0 18%,#35515a 19% 100%)}.kds-env-scene[data-biome="plaza"] .kds-env-feature,.kds-env-scene[data-biome="city"] .kds-env-feature{background:linear-gradient(180deg,#3c4050,#1b1e28);border-radius:2px 2px 0 0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}.kds-env-scene[data-biome="city"] .kds-env-feature:nth-child(3n){height:88%!important;background:linear-gradient(180deg,#596274,#232833)}.kds-env-scene[data-biome="swamp"] .kds-env-feature{width:3px;background:#405a48;border-radius:99px;transform:rotate(var(--r));transform-origin:bottom}.kds-env-scene[data-biome="desert"] .kds-env-feature{bottom:-18%;height:55%;width:26%;background:#b47c45;border-radius:50% 50% 0 0;filter:brightness(var(--b))}.kds-env-scene[data-biome="coast"] .kds-env-feature{width:5px;background:#55402d;border-radius:99px;transform:rotate(var(--r));transform-origin:bottom}.kds-env-scene[data-biome="coast"] .kds-env-feature:before{content:"";position:absolute;left:50%;top:-6px;width:34px;height:16px;transform:translateX(-50%);background:#315c3e;clip-path:polygon(50% 50%,0 0,38% 42%,18% 100%,50% 58%,82% 100%,62% 42%,100% 0)}.kds-env-weather{pointer-events:none;overflow:hidden}.kds-env-particle{position:absolute;left:var(--x);top:-20px;animation:kds-env-fall var(--speed) linear infinite;animation-delay:var(--delay);transform:translateZ(0)}.kds-env-scene[data-weather="rain"] .kds-env-particle,.kds-env-scene[data-weather="storm"] .kds-env-particle{width:1px;height:18px;background:rgba(195,220,245,.58);transform:rotate(13deg)}.kds-env-scene[data-weather="snow"] .kds-env-particle{width:5px;height:5px;border-radius:50%;background:rgba(245,250,255,.88)}.kds-env-fog{display:none;background:radial-gradient(ellipse at 20% 70%,rgba(225,235,236,.28),transparent 42%),radial-gradient(ellipse at 76% 58%,rgba(225,235,236,.24),transparent 44%);animation:kds-env-drift 7s ease-in-out infinite alternate;transform:translateZ(0)}.kds-env-scene[data-weather="fog"] .kds-env-fog{display:block}.kds-env-flash{display:none;background:white;opacity:0;animation:kds-env-flash 5s steps(1,end) infinite}.kds-env-scene[data-weather="storm"] .kds-env-flash{display:block}.kds-env-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 28%,rgba(0,0,0,.38) 100%);pointer-events:none}.kds-env-meta{position:absolute;left:8px;right:8px;bottom:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:7px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 1px 3px #000}.kds-env-meta span{padding:4px 6px;border-radius:999px;background:rgba(5,8,12,.46);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(4px)}@keyframes kds-env-fall{to{transform:translate3d(14px,190px,0)}}@keyframes kds-env-drift{from{transform:translate3d(-5%,0,0)}to{transform:translate3d(5%,0,0)}}@keyframes kds-env-flash{0%,91%,94%,100%{opacity:0}92%,93%{opacity:.18}}@media(prefers-reduced-motion:reduce){.kds-env-particle,.kds-env-fog,.kds-env-flash{animation:none!important}.kds-env-particle{display:none}}`;
  doc.head.append(style);
}

const el=(doc,tag,cls)=>{const node=doc.createElement(tag);if(cls)node.className=cls;return node;};

export function renderEnvironmentLivePreview({doc,draft}={}){
  if(!doc?.createElement)throw new Error('ENVIRONMENT_PREVIEW_DOM_REQUIRED');installStyle(doc);
  const model=createEnvironmentPreviewModel(draft),scene=el(doc,'div','kds-env-scene');
  scene.dataset.biome=model.biome;scene.dataset.weather=model.weather;scene.dataset.time=model.timeOfDay;scene.setAttribute('role','img');scene.setAttribute('aria-label',`Environment preview: ${model.label}`);
  scene.style.setProperty('--kds-env-sky',model.sky);scene.style.setProperty('--kds-env-ground',model.ground);scene.style.setProperty('--kds-env-accent',model.accent);
  scene.append(el(doc,'div','kds-env-sky'));
  if(model.referenceImage){const img=el(doc,'img','kds-env-ref');img.src=model.referenceImage;img.alt='';img.setAttribute('aria-hidden','true');scene.append(img);}
  scene.append(el(doc,'div','kds-env-tint'),el(doc,'div','kds-env-celestial'),el(doc,'div','kds-env-ground'));
  const features=el(doc,'div','kds-env-features');features.setAttribute('aria-hidden','true');
  for(let i=0;i<model.featureCount;i++){const f=el(doc,'span','kds-env-feature'),seed=(i*37+model.featureCount*13)%97;f.style.setProperty('--x',`${2+(seed%92)}%`);f.style.setProperty('--h',`${35+((i*23)%75)}%`);f.style.setProperty('--w',`${8+((i*11)%18)}px`);f.style.setProperty('--o',String(.34+((i%5)*.11)));f.style.setProperty('--r',`${-8+((i*7)%17)}deg`);f.style.setProperty('--b',String(.82+((i%4)*.08)));features.append(f);}scene.append(features);
  const weather=el(doc,'div','kds-env-weather');weather.setAttribute('aria-hidden','true');for(let i=0;i<model.particleCount;i++){const p=el(doc,'span','kds-env-particle');p.style.setProperty('--x',`${(i*47+11)%101}%`);p.style.setProperty('--delay',`${-(i%7)*.31}s`);p.style.setProperty('--speed',`${1.15+(i%5)*.18}s`);weather.append(p);}scene.append(weather,el(doc,'div','kds-env-fog'),el(doc,'div','kds-env-flash'),el(doc,'div','kds-env-vignette'));
  const meta=el(doc,'div','kds-env-meta'),left=el(doc,'span',''),right=el(doc,'span','');left.textContent=model.label;right.textContent=model.intent.atmosphere[0]||model.intent.lighting||model.musicMood;meta.append(left,right);scene.append(meta);
  return scene;
}

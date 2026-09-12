/* KELO-INDEX
 * area: QA / UNIVERSAL SPRITE INGESTION / VISUAL LAB
 * owner: browser adversarial corpus runner and before/after runtime evidence
 * keys: SPRITE LAB BROWSER CORPUS METRICS ANIMATION BEFORE AFTER
 * purpose: compile every labelled degraded real sprite and expose machine- and human-readable results
 * online: static GitHub Pages audit surface; no auth and no persistence
 * do-not: upload assets, mutate player state or substitute green tests for visual review
 */
import {buildAdversarialSpriteCorpus} from '../tests/fixtures/sprite-ingestion-adversarial-corpus.mjs';
import {analyzeUniversalAvatarAsset,compileUniversalAvatarRuntime} from '../src/creators/avatar/kelo-universal-asset-compiler.mjs';
import {installCreatorAvatarRuntime} from '../src/characters/creator-avatar-runtime.mjs';

const root = globalThis;
const byId = id => document.getElementById(id);
const status = byId('status');
const stage = byId('stage');
const summary = byId('summary');
const before = byId('before');
const after = byId('after');
const directionRow = byId('directions');
const casesNode = byId('cases');
const filters = byId('filters');
const title = byId('case-title');
const meta = byId('case-meta');
const pct = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
const labels = {n:'N ↑',ne:'NE ↗',e:'E →',se:'SE ↘',s:'S ↓',sw:'SW ↙',w:'W ←',nw:'NW ↖'};
let corpus = null;
let results = [];
let selected = null;
let direction = 's';
let frame = 0;
let lastFrame = 0;
let runtimeDraw = null;
const runtimeUrls = [];
root.KeloAvatar = {use(_id, draw) { runtimeDraw = draw; return 'sprite-ingestion-lab'; }};
const runtimeApi = installCreatorAvatarRuntime({root});

function cloneCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
}

function scoreNode(label, value) {
  const node = document.createElement('div');
  node.className = 'score';
  node.innerHTML = `<b>${typeof value === 'number' && value <= 1 ? pct(value) : value}</b><span>${label}</span>`;
  return node;
}

function aggregate() {
  const completed = results.length;
  const detection = completed ? results.reduce((sum, result) => sum + result.validation.scores.detection, 0) / completed : 0;
  const health = completed ? results.reduce((sum, result) => sum + result.validation.scores.finalHealth, 0) / completed : 0;
  const expected = results.filter(result => result.statusMatches).length;
  const validCases = results.filter(result => result.spec.expectedStatus === 'VALIDATED');
  const recovered = validCases.filter(result => result.validation.status === 'VALIDATED').length;
  const exactFrames = results.filter(result => result.validation.counts.missedFrames === 0 && result.validation.counts.falseFrames === 0).length;
  return {completed, detection, health, expected, recovered, validTotal: validCases.length, exactFrames};
}

function paintSummary() {
  const totals = aggregate();
  summary.replaceChildren(
    scoreNode('CASES', `${totals.completed}/${corpus?.cases.length || 0}`),
    scoreNode('MEAN DETECTION', totals.detection),
    scoreNode('MEAN HEALTH', totals.health),
    scoreNode('EXACT FRAME COUNT', `${totals.exactFrames}/${totals.completed}`),
    scoreNode('AUTO-RECOVERED', `${totals.recovered}/${totals.validTotal}`),
    scoreNode('EXPECTED GATE', `${totals.expected}/${totals.completed}`)
  );
}

function paintDirections(result) {
  directionRow.replaceChildren();
  const keys = result.compiled.directionKeys;
  if (!keys.includes(direction)) direction = keys[0];
  for (const key of keys) {
    const button = document.createElement('button');
    button.textContent = labels[key] || key.toUpperCase();
    button.className = key === direction ? 'on' : '';
    button.onclick = () => { direction = key; frame = 0; paintDirections(result); };
    directionRow.append(button);
  }
}

function selectResult(result) {
  selected = result;
  frame = 0;
  before.replaceChildren(cloneCanvas(result.spec.canvas));
  const output = document.createElement('canvas');
  output.width = 380;
  output.height = 360;
  output.dataset.runtimePreview = 'true';
  after.replaceChildren(output);
  title.textContent = `${result.spec.tier} · ${result.spec.label}`;
  meta.textContent = `${result.compiled.strategy} · ${result.compiled.directions}D · frames ${result.validation.counts.detectedFrames}/${result.validation.counts.expectedFrames} · health ${pct(result.validation.scores.finalHealth)} · ${result.validation.status}`;
  const runtimeUrl = URL.createObjectURL(result.compiled.blob);
  runtimeUrls.push(runtimeUrl);
  const manifest = {contentId:`lab-${result.spec.id}`,displayName:result.spec.label,payload:{directions:result.compiled.directions,avatarRuntime:{publicUrl:runtimeUrl,columns:result.compiled.columns,rows:result.compiled.rows,directionKeys:result.compiled.directionKeys,frameCounts:result.compiled.frameCounts,rowMap:result.compiled.rowMap,frameMs:result.compiled.frameMs,renderHeight:150}}};
  runtimeApi.register(manifest);
  runtimeApi.select(manifest.contentId,{manifest,persistLocal:false});
  paintDirections(result);
  paintCases();
}

function drawRuntime(now) {
  if (selected) {
    const canvas = after.querySelector('canvas');
    const source = selected.compiled.canvas;
    if (canvas && source) {
      if (now - lastFrame >= selected.compiled.frameMs) {
        frame++;
        lastFrame = now;
      }
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      const row = selected.compiled.rowMap[direction] ?? 0;
      const count = selected.compiled.frameCounts[row] || selected.compiled.columns;
      const column = frame % count;
      const sw = source.width / selected.compiled.columns;
      const sh = source.height / selected.compiled.rows;
      const scale = Math.min(270 / sw, 270 / sh);
      const width = sw * scale;
      const height = sh * scale;
      context.drawImage(source, column * sw, row * sh, sw, sh, (canvas.width - width) / 2, canvas.height * .86 - height, width, height);
      const gameCanvas = byId('game-canvas');
      const gameContext = gameCanvas.getContext('2d');
      gameContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
      const vector = {n:[0,-10],ne:[7,-7],e:[10,0],se:[7,7],s:[0,10],sw:[-7,7],w:[-10,0],nw:[-7,-7]}[direction] || [0,10];
      runtimeDraw?.({x:gameCanvas.width/2,y:gameCanvas.height*.78,vx:vector[0],vy:vector[1],radius:20},true,()=>false);
    }
  }
  requestAnimationFrame(drawRuntime);
}

function paintCases(tier = filters.dataset.tier || 'ALL') {
  filters.dataset.tier = tier;
  casesNode.replaceChildren();
  for (const result of results.filter(result => tier === 'ALL' || result.spec.tier === tier)) {
    const button = document.createElement('button');
    const pass = result.statusMatches && result.validation.counts.missedFrames === 0 && result.validation.counts.falseFrames === 0;
    button.className = `case ${pass ? 'good' : result.validation.reviewRequired ? 'review' : 'bad'}`;
    button.innerHTML = `<div class="line"><span>${result.spec.label}</span><strong>${pass ? 'PASS' : result.validation.status}</strong></div><small>${result.spec.tier} · ${result.validation.counts.detectedFrames}/${result.validation.counts.expectedFrames} frames · health ${pct(result.validation.scores.finalHealth)}</small>`;
    button.onclick = () => selectResult(result);
    casesNode.append(button);
  }
  for (const button of filters.querySelectorAll('button')) button.classList.toggle('on', button.dataset.tier === tier);
}

function setupFilters() {
  for (const tier of ['ALL', 'GOOD', 'IRREGULAR', 'EXTREME']) {
    const button = document.createElement('button');
    button.dataset.tier = tier;
    button.textContent = tier;
    button.onclick = () => paintCases(tier);
    filters.append(button);
  }
}

async function compileCase(spec, index, total) {
  stage.textContent = `TEST ${index + 1}/${total} · ${spec.label}`;
  const analysis = await analyzeUniversalAvatarAsset(spec.file, {root, rigHint: spec.expectedDirections});
  const compiled = await compileUniversalAvatarRuntime(spec.file, {...analysis, rigHint: spec.expectedDirections}, {root, oracle: spec.oracle});
  const statusMatches = compiled.validation.status === spec.expectedStatus;
  return Object.freeze({spec, analysis, compiled, validation: compiled.validation, statusMatches});
}

async function run() {
  setupFilters();
  try {
    corpus = await buildAdversarialSpriteCorpus(root, {sourceUrl: './assets/hero.PNG'});
    paintSummary();
    for (let index = 0; index < corpus.cases.length; index++) {
      const result = await compileCase(corpus.cases[index], index, corpus.cases.length);
      results.push(result);
      if (!selected || !result.statusMatches) selectResult(result);
      paintSummary();
      paintCases();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const totals = aggregate();
    const reasonableExact = results.filter(result => result.spec.expectedStatus === 'VALIDATED').every(result => result.validation.counts.missedFrames === 0 && result.validation.counts.falseFrames === 0);
    const pass = totals.expected === totals.completed && reasonableExact;
    status.textContent = pass ? `PASS · ${totals.completed} CASES` : `REVIEW · ${totals.expected}/${totals.completed} GATES`;
    status.className = `status ${pass ? 'good' : 'bad'}`;
    stage.textContent = `Corpus completo · ${totals.recovered}/${totals.validTotal} casos razonables recuperados automáticamente`;
    if (!selected && results[0]) selectResult(results[0]);
    root.__KELO_SPRITE_INGESTION_LAB__ = Object.freeze({ready: true, pass, version: corpus.version, summary: totals, results: Object.freeze(results.map(result => Object.freeze({id: result.spec.id, tier: result.spec.tier, expectedStatus: result.spec.expectedStatus, status: result.validation.status, statusMatches: result.statusMatches, counts: result.validation.counts, scores: result.validation.scores, reviewReasons: result.validation.reviewReasons, strategy: result.compiled.strategy, directions: result.compiled.directions, frameCounts: result.compiled.frameCounts}))) });
  } catch (error) {
    status.textContent = 'LAB FAILED';
    status.className = 'status bad';
    stage.textContent = String(error?.stack || error);
    root.__KELO_SPRITE_INGESTION_LAB__ = Object.freeze({ready: true, pass: false, error: String(error?.stack || error)});
  }
}

requestAnimationFrame(drawRuntime);
void run();

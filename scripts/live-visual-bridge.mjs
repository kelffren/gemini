import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts', 'live-visual-bridge');
const HOST = '127.0.0.1';
const PORT = Number(process.env.KELO_BRIDGE_PORT || 4173);
const WAIT_AFTER_BOOT_MS = Number(process.env.KELO_BRIDGE_SETTLE_MS || 1800);
const MOVE_MS = Number(process.env.KELO_BRIDGE_MOVE_MS || 650);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.wasm', 'application/wasm'],
]);

function safeFileForRequest(rawUrl = '/') {
  const parsed = new URL(rawUrl, `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/gemini' || pathname === '/gemini/') pathname = '/';
  else if (pathname.startsWith('/gemini/')) pathname = pathname.slice('/gemini'.length);
  if (pathname === '/') pathname = '/index.html';

  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  const full = path.resolve(ROOT, normalized);
  if (full !== ROOT && !full.startsWith(`${ROOT}${path.sep}`)) return null;
  try {
    if (fs.statSync(full).isDirectory()) return path.join(full, 'index.html');
  } catch {}
  return full;
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const file = safeFileForRequest(req.url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'content-type': MIME.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
      'cache-control': 'no-store, max-age=0',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}

async function countFrames(page, durationMs = 900) {
  return page.evaluate((duration) => new Promise((resolve) => {
    const started = performance.now();
    let frames = 0;
    const tick = () => {
      frames += 1;
      if (performance.now() - started >= duration) resolve(frames);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), durationMs);
}

async function readState(page) {
  return page.evaluate(() => ({
    title: document.title,
    readyState: document.readyState,
    bootReady: Boolean(window.__keloBootReady),
    canvas: (() => {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })(),
    player: typeof localPlayer === 'undefined' ? null : {
      x: Number(localPlayer.x),
      y: Number(localPlayer.y),
      vx: Number(localPlayer.vx || 0),
      vy: Number(localPlayer.vy || 0),
    },
    camera: typeof camera === 'undefined' ? null : {
      x: Number(camera.x),
      y: Number(camera.y),
      targetX: Number(camera.targetX),
      targetY: Number(camera.targetY),
    },
  }));
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const result = {
  version: 1,
  startedAt: new Date().toISOString(),
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local',
  commit: process.env.GITHUB_SHA || null,
  url: null,
  before: null,
  after: null,
  movement: null,
  frameCount: 0,
  consoleErrors: [],
  httpErrors: [],
  requestFailures: [],
  checks: {},
  pass: false,
};

let server;
let browser;
let exitCode = 1;

try {
  server = await startStaticServer();
  const url = `http://${HOST}:${PORT}/?aiGuest=1&keloBridge=1&ts=${Date.now()}`;
  result.url = url;

  const executablePath = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      result.consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    result.consoleErrors.push({ text: `PAGEERROR: ${error.stack || error.message}`, location: null });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const request = response.request();
    result.httpErrors.push({
      status: response.status(),
      statusText: response.statusText(),
      url: response.url(),
      resourceType: request.resourceType(),
      method: request.method(),
    });
  });
  page.on('requestfailed', (request) => {
    result.requestFailures.push({
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      failure: request.failure()?.errorText || 'unknown',
    });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => (
    Boolean(window.__keloBootReady) &&
    typeof localPlayer !== 'undefined' &&
    typeof camera !== 'undefined' &&
    Boolean(document.getElementById('game-canvas'))
  ), null, { timeout: 45000 });
  await page.waitForTimeout(WAIT_AFTER_BOOT_MS);

  result.before = await readState(page);
  await page.screenshot({ path: path.join(OUT, 'before.png') });

  result.frameCount = await countFrames(page);

  await page.keyboard.down('w');
  await page.waitForTimeout(MOVE_MS);
  await page.keyboard.up('w');
  await page.waitForTimeout(450);

  result.after = await readState(page);
  await page.screenshot({ path: path.join(OUT, 'after.png') });

  const dx = (result.after?.player?.x ?? 0) - (result.before?.player?.x ?? 0);
  const dy = (result.after?.player?.y ?? 0) - (result.before?.player?.y ?? 0);
  result.movement = { dx, dy, distance: Math.hypot(dx, dy) };

  const hardConsole = [...result.consoleErrors];
  const hardHttp = [...result.httpErrors];
  const hardRequests = [...result.requestFailures];

  result.checks = {
    bootReady: result.after?.bootReady === true,
    canvasVisible: Boolean(result.after?.canvas && result.after.canvas.width > 0 && result.after.canvas.height > 0),
    playerPresent: Boolean(result.before?.player && result.after?.player),
    cameraPresent: Boolean(result.after?.camera),
    renderLoopAlive: result.frameCount >= 5,
    playerMoved: result.movement.distance >= 8,
    noPageOrConsoleErrors: hardConsole.length === 0,
    noHttpErrors: hardHttp.length === 0,
    noRequestFailures: hardRequests.length === 0,
  };

  result.pass = Object.values(result.checks).every(Boolean);
  result.finishedAt = new Date().toISOString();
  result.hardErrors = { console: hardConsole, http: hardHttp, requests: hardRequests };

  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(OUT, 'summary.txt'), [
    `PASS=${result.pass}`,
    `branch=${result.branch}`,
    `commit=${result.commit || 'local'}`,
    `movement=${result.movement.distance.toFixed(2)}px`,
    `frames=${result.frameCount}`,
    ...Object.entries(result.checks).map(([key, value]) => `${key}=${value ? 'PASS' : 'FAIL'}`),
  ].join('\n') + '\n');

  console.log(`KELO_LIVE_BRIDGE_RESULT=${JSON.stringify(result)}`);
  exitCode = result.pass ? 0 : 1;
} catch (error) {
  result.finishedAt = new Date().toISOString();
  result.fatalError = error?.stack || String(error);
  result.pass = false;
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.error(error);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
}

process.exitCode = exitCode;

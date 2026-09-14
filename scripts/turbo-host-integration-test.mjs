import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = process.cwd();
const port = 18777;
const env = { ...process.env, PORT: String(port), RENDER_GIT_COMMIT: '0123456789abcdef0123456789abcdef01234567' };
const child = spawn(process.execPath, ['scripts/turbo-host-server.mjs'], { cwd: root, env, stdio: ['ignore','pipe','pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d.toString(); });
child.stderr.on('data', (d) => { log += d.toString(); });

function request(pathname, acceptEncoding) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname:'127.0.0.1', port, path:pathname, method:'GET', headers: acceptEncoding ? {'Accept-Encoding':acceptEncoding} : {} }, (res) => {
      const chunks=[]; res.on('data',(c)=>chunks.push(c)); res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.on('error', reject); req.end();
  });
}
async function waitReady() {
  for (let i=0;i<50;i++) { try { const r=await request('/__turbo_host_evidence.json'); if(r.status===200)return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw new Error('host did not become ready: '+log);
}
function assert(cond,msg){ if(!cond) throw new Error('TURBO HOST INTEGRATION FAIL: '+msg); }

try {
  await waitReady();
  const index = await request('/index.html','br,gzip');
  assert(index.status===200,'index not served');
  assert(index.headers['cache-control']==='no-cache, max-age=0, must-revalidate','index revalidation header wrong');
  assert(index.headers['content-encoding']==='br','index did not negotiate Brotli');

  const version = await request('/version.json','gzip');
  assert(version.status===200,'version not served');
  assert(version.headers['cache-control']==='no-cache, max-age=0, must-revalidate','version revalidation header wrong');
  assert(version.headers['content-encoding']==='gzip','version did not negotiate gzip');

  const dist = path.join(root,'dist','turbo');
  const hashed = fs.existsSync(dist) ? fs.readdirSync(dist).find((n)=>/-[A-Z0-9]{6,}\.js$/i.test(n)) : null;
  assert(hashed,'no hashed production JS asset found; run npm run build first');
  const asset = await request('/dist/turbo/'+hashed,'br,gzip');
  assert(asset.status===200,'hashed asset not served');
  assert(asset.headers['cache-control']==='public, max-age=31536000, immutable','hashed asset is not immutable');
  assert(asset.headers['content-encoding']==='br','hashed asset did not negotiate Brotli');

  const denied = await request('/scripts/turbo-host-server.mjs');
  assert(denied.status===404,'server source is publicly exposed');

  console.log(`TURBO HOST INTEGRATION PASS — revalidation, immutable hashed assets, Brotli, gzip and source denylist proven; asset=${hashed}`);
} finally {
  child.kill('SIGTERM');
}

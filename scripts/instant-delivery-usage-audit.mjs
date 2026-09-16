/* KELO-INDEX
 * area: BUILD / ASSET DELIVERY QA
 * owner: Kelo Creator Asset Bridge
 * keys: INSTANT DELIVERY COVERAGE CONSUMER AUDIT FRAME IDS SPARSE ATLAS
 * purpose: prove that declared sparse-atlas coverage includes every frame referenced by its audited runtime consumer block
 * public-api: CLI --config
 * state-owned: none
 * online: N/A
 */
import fs from 'node:fs';
import path from 'node:path';

const args=process.argv.slice(2),arg=(name,fallback)=>{const p=`--${name}=`;const t=args.find(v=>v.startsWith(p));return t?t.slice(p.length):fallback;};
const config=JSON.parse(fs.readFileSync(path.resolve(arg('config','config/instant-delivery-plaza.json')),'utf8'));
let checked=0;
for(const item of config.assets||[]){
  if(item.mode!=='sparse-png'||!item.consumerAudit)continue;
  const audit=item.consumerAudit,file=path.resolve(audit.file),text=fs.readFileSync(file,'utf8'),start=text.indexOf(audit.blockStart),end=text.indexOf(audit.blockEnd,start+Math.max(1,String(audit.blockStart).length));
  if(start<0||end<0||end<=start)throw new Error(`INSTANT_DELIVERY_CONSUMER_BLOCK_NOT_FOUND:${item.id}`);
  const block=text.slice(start,end),re=new RegExp(audit.frameRegex||"frame:'([^']+)'",'g'),used=new Set();let match;
  while((match=re.exec(block)))used.add(String(match[1]));
  const allowed=new Set((item.allowedFrameIds||[]).map(String)),missing=[...used].filter(id=>!allowed.has(id)),undeclared=[...allowed].filter(id=>!used.has(id));
  if(!used.size)throw new Error(`INSTANT_DELIVERY_CONSUMER_FRAMES_EMPTY:${item.id}`);
  if(missing.length)throw new Error(`INSTANT_DELIVERY_COVERAGE_MISSING:${item.id}:${missing.join(',')}`);
  const rectIds=new Set((item.keepRects||[]).map(rect=>String(rect.id||''))),rectMissing=[...used].filter(id=>!rectIds.has(id));
  if(rectMissing.length)throw new Error(`INSTANT_DELIVERY_RECT_MISSING:${item.id}:${rectMissing.join(',')}`);
  console.log(`INSTANT_DELIVERY_COVERAGE_PASS id=${item.id} used=${[...used].sort().join(',')} extraDeclared=${undeclared.sort().join(',')||'none'}`);checked++;
}
if(!checked)throw new Error('INSTANT_DELIVERY_NO_CONSUMER_AUDITS');
console.log(`INSTANT_DELIVERY_USAGE_AUDIT_PASS checked=${checked}`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const migrationsDir=path.join(root,'supabase','migrations');
const files=fs.readdirSync(migrationsDir).filter(name=>name.endsWith('.sql')).sort();
const versions=new Map();
for(const file of files){
  const match=file.match(/^(\d{8,14})_(.+)\.sql$/);
  assert.ok(match,`invalid migration filename: ${file}`);
  assert.ok(!versions.has(match[1]),`duplicate migration version ${match[1]}: ${versions.get(match[1])}, ${file}`);
  versions.set(match[1],file);
}

const required=[
  '20260910015138_kelo_identity_and_authorization_foundation.sql',
  '20260910015350_kelo_creator_assets_and_storage_foundation.sql',
  '20260910015442_kelo_maps_and_versioning_foundation.sql',
  '20260910015537_kelo_economy_persistence_and_audit_foundation.sql',
  '20260910015637_kelo_foundation_hardening.sql'
];
required.forEach(file=>assert.ok(files.includes(file),`missing ${file}`));

const sql=files.map(file=>fs.readFileSync(path.join(migrationsDir,file),'utf8')).join('\n');
for(const table of ['profiles','characters','asset_families','asset_revisions','maps','map_versions','character_wallets','wallet_ledger','item_instances','server_outbox','server_audit_events']){
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,'i'),`RLS missing for ${table}`);
}
for(const bucket of ['creator-private','creator-global','avatars','map-previews']){
  assert.ok(sql.includes(`'${bucket}'`),`bucket contract missing: ${bucket}`);
}
assert.match(sql,/unique\(family_id, revision\)/i,'asset revisions must be immutable/versioned');
assert.match(sql,/unique\(map_id, version\)/i,'map versions must be immutable/versioned');
assert.match(sql,/unique\(character_id,currency_key,correlation_id\)/i,'wallet ledger must be idempotent');
assert.match(sql,/server_outbox/i,'transactional outbox missing');
assert.doesNotMatch(sql,/sb_secret_[A-Za-z0-9_-]{12,}/,'a Supabase secret key must never be committed');

const require=createRequire(import.meta.url);
const {createOnlineIdentityStore}=require(path.join(root,'server','online-identity-store.js'));
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async (url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).includes('/auth/v1/user'))return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid',is_anonymous:false}),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).includes('/rest/v1/characters'))return new Response(JSON.stringify([{id:'22222222-2222-4222-8222-222222222222',account_id:'11111111-1111-4111-8111-111111111111',name:'Kelo Test',legacy_player_key:null,status:'active'}]),{status:200,headers:{'content-type':'application/json'}});
  return new Response('not found',{status:404});
};
try{
  const secret=['sb','secret','fixture'].join('_');
  const store=createOnlineIdentityStore({supabaseUrl:'https://example.supabase.co',supabaseServerKey:secret,requireAuth:true});
  const identity=await store.resolve({accessToken:'user.jwt.fixture',characterId:'22222222-2222-4222-8222-222222222222'});
  assert.equal(identity.authenticated,true);
  assert.equal(identity.playerKey,'22222222-2222-4222-8222-222222222222');
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.apikey,secret);
  assert.equal(calls[0].options.headers.Authorization,'Bearer user.jwt.fixture');
  assert.equal(calls[1].options.headers.apikey,secret);
  assert.equal(calls[1].options.headers.Authorization,undefined,'new sb_secret keys must not be sent as bearer JWTs');
  await assert.rejects(()=>store.resolve({}),/AUTH_TOKEN_REQUIRED/);
}finally{
  globalThis.fetch=originalFetch;
}

console.log(`online-foundation-audit: ok · ${files.length} migrations · ${versions.size} unique versions`);

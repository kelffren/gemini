/* KELO-INDEX
 * area: QA / GUARDIAN COMMUNITY LIVE
 * keys: GUARDIAN COMMUNITY LIVE SUPABASE TWO ACCOUNT CROSS DEVICE QUORUM
 * purpose: prueba el contrato Community Builder contra un proyecto Supabase real usando dos cuentas de test autenticadas
 * do-not: NO service role; NO usuarios reales; NO imprimir secretos; NO crear autoridad alternativa
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const REQUIRED=[
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'KELO_GUARDIAN_TEST_ADMIN_EMAIL',
  'KELO_GUARDIAN_TEST_ADMIN_PASSWORD',
  'KELO_GUARDIAN_TEST_DONOR_EMAIL',
  'KELO_GUARDIAN_TEST_DONOR_PASSWORD'
];
for(const key of REQUIRED)assert.ok(process.env[key],`MISSING_REQUIRED_SECRET:${key}`);

const SUPABASE_URL=String(process.env.SUPABASE_URL).replace(/\/+$/,'');
const PUBLISHABLE_KEY=String(process.env.SUPABASE_PUBLISHABLE_KEY);
const RUN_ID=String(process.env.GITHUB_RUN_ID||Date.now());
const ADMIN_NODE=`guardian_live_admin_${RUN_ID}`.slice(0,96);
const DONOR_NODE=`guardian_live_donor_${RUN_ID}`.slice(0,96);
const ASSET_HASH=crypto.createHash('sha256').update(`kelo-community-live:${RUN_ID}:${Date.now()}:${crypto.randomUUID()}`).digest('hex');
const JOB_ID=`community:${ASSET_HASH}`;
const PRESET='material-noise-v1';

async function jsonRequest(url,{method='GET',headers={},body}={}){
  const response=await fetch(url,{method,headers:{Accept:'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();
  let payload=null;
  try{payload=text?JSON.parse(text):null;}catch{payload={raw:text.slice(0,300)};}
  if(!response.ok){
    const message=payload?.message||payload?.error_description||payload?.error||`HTTP_${response.status}`;
    const error=new Error(String(message));
    error.status=response.status;
    error.code=payload?.code||null;
    throw error;
  }
  return payload;
}

async function signIn(email,password){
  const payload=await jsonRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:{email,password}
  });
  assert.ok(payload?.access_token,'AUTH_ACCESS_TOKEN_MISSING');
  assert.ok(payload?.user?.id,'AUTH_USER_ID_MISSING');
  return Object.freeze({accessToken:String(payload.access_token),userId:String(payload.user.id)});
}

async function rpc(session,name,args={}){
  return jsonRequest(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',
    headers:{
      apikey:PUBLISHABLE_KEY,
      Authorization:`Bearer ${session.accessToken}`,
      'Content-Type':'application/json',
      Prefer:'return=representation'
    },
    body:args
  });
}

function gpuCapabilities(){
  return {platform:'ci-live-test',deviceClass:'test-worker',visibility:'visible',webrtc:true,cores:8,memoryGb:8,webgpu:true,gpuTier:'medium',gpuCapacityUnits:50,gpuProbeReady:true};
}
function gpuPreferences(){return {allowAssets:true,allowRelay:false,allowCompute:false,allowGpuAssets:true,gpuSharePct:25,maxUploadMbps:5};}
function profileCount(result){return Number(result?.profile?.consensusBuilds)||0;}
function masterEpoch(result){return Number(result?.master?.epoch||result?.network?.masterEpoch||0);}

let admin=null,donor=null,masterStarted=false;
try{
  admin=await signIn(process.env.KELO_GUARDIAN_TEST_ADMIN_EMAIL,process.env.KELO_GUARDIAN_TEST_ADMIN_PASSWORD);
  donor=await signIn(process.env.KELO_GUARDIAN_TEST_DONOR_EMAIL,process.env.KELO_GUARDIAN_TEST_DONOR_PASSWORD);
  assert.notEqual(admin.userId,donor.userId,'TEST_ACCOUNTS_MUST_BE_DISTINCT');

  const adminBefore=await rpc(admin,'guardian_community_profile');
  const donorBefore=await rpc(donor,'guardian_community_profile');
  const adminBaseline=profileCount(adminBefore),donorBaseline=profileCount(donorBefore);

  await rpc(admin,'guardian_enable',{p_node_id:ADMIN_NODE,p_capabilities:gpuCapabilities(),p_preferences:gpuPreferences()});
  await rpc(donor,'guardian_enable',{p_node_id:DONOR_NODE,p_capabilities:gpuCapabilities(),p_preferences:gpuPreferences()});

  const master=await rpc(admin,'guardian_master_start',{p_node_id:ADMIN_NODE});
  masterStarted=true;
  const epoch=masterEpoch(master);
  assert.ok(epoch>=1,'MASTER_EPOCH_MISSING');

  // Extend the short Master lease immediately before quorum work.
  await rpc(admin,'guardian_heartbeat',{p_node_id:ADMIN_NODE,p_capabilities:gpuCapabilities(),p_preferences:gpuPreferences()});

  const first=await rpc(admin,'guardian_community_attest',{
    p_node_id:ADMIN_NODE,p_job_id:JOB_ID,p_asset_hash:ASSET_HASH,p_preset:PRESET,p_master_epoch:epoch
  });
  assert.equal(first?.verified,false,'FIRST_ACCOUNT_MUST_NOT_VERIFY');
  assert.equal(Number(first?.matchingAccounts)||0,1,'FIRST_ACCOUNT_QUORUM_COUNT');

  const second=await rpc(donor,'guardian_community_attest',{
    p_node_id:DONOR_NODE,p_job_id:JOB_ID,p_asset_hash:ASSET_HASH,p_preset:PRESET,p_master_epoch:epoch
  });
  assert.equal(second?.verified,true,'SECOND_DISTINCT_ACCOUNT_MUST_VERIFY');
  assert.ok((Number(second?.matchingAccounts)||0)>=2,'QUORUM_REQUIRES_TWO_ACCOUNTS');

  const assetStatus=await rpc(admin,'guardian_community_asset_status',{p_asset_hash:ASSET_HASH});
  assert.equal(assetStatus?.verified,true,'ASSET_STATUS_MUST_BE_VERIFIED');
  assert.equal(String(assetStatus?.asset?.assetHash||''),ASSET_HASH,'ASSET_STATUS_HASH_MISMATCH');

  const adminAfter=await rpc(admin,'guardian_community_profile');
  const donorAfter=await rpc(donor,'guardian_community_profile');
  assert.equal(profileCount(adminAfter),adminBaseline+1,'ADMIN_PROFILE_MUST_GAIN_ONE');
  assert.equal(profileCount(donorAfter),donorBaseline+1,'DONOR_PROFILE_MUST_GAIN_ONE');

  // Replay must be idempotent.
  await rpc(admin,'guardian_community_attest',{
    p_node_id:ADMIN_NODE,p_job_id:JOB_ID,p_asset_hash:ASSET_HASH,p_preset:PRESET,p_master_epoch:epoch
  });
  const adminReplay=await rpc(admin,'guardian_community_profile');
  assert.equal(profileCount(adminReplay),adminBaseline+1,'REPLAY_MUST_NOT_DOUBLE_CREDIT');

  // New auth session emulates the same account opening Kelo World on another device.
  const adminSecondDevice=await signIn(process.env.KELO_GUARDIAN_TEST_ADMIN_EMAIL,process.env.KELO_GUARDIAN_TEST_ADMIN_PASSWORD);
  const recovered=await rpc(adminSecondDevice,'guardian_community_profile');
  assert.equal(profileCount(recovered),adminBaseline+1,'CROSS_DEVICE_PROFILE_RECOVERY_FAILED');

  console.log('GUARDIAN_COMMUNITY_LIVE_SMOKE_OK',{
    project:new URL(SUPABASE_URL).host,
    distinctAccounts:true,
    quorumVerified:true,
    crossDeviceRecovery:true,
    replayIdempotent:true,
    serverAuthoritative:true,
    serviceRoleUsed:false
  });
}finally{
  // Best-effort cleanup of ephemeral Guardian nodes/lease. Persistent receipts stay only on dedicated test accounts.
  if(admin&&masterStarted)try{await rpc(admin,'guardian_master_stop',{p_node_id:ADMIN_NODE});}catch{}
  if(admin)try{await rpc(admin,'guardian_disable',{p_node_id:ADMIN_NODE});}catch{}
  if(donor)try{await rpc(donor,'guardian_disable',{p_node_id:DONOR_NODE});}catch{}
}

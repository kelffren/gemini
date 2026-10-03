const EXPECTED_SERVER_KEY_SHA256 = '7ba74b9a4fb3577299eba97c7dd7925e3bec0f346d97a39bae53678142789fd5';
const MAX_BODY_BYTES = 600_000;
const MAX_STATE_BYTES = 450_000;
const MAX_WORLD_PATCH_BYTES = 120_000;
const CELL_RE = /^[A-Za-z0-9_-]{1,48}:-?[0-9]{1,8}:-?[0-9]{1,8}$/;
const EVENT_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const EVENT_TYPE_RE = /^[a-z][a-z0-9_.:-]{0,95}$/;
const WORLD_ERRORS = ['WORLD_CELL_ID_INVALID','WORLD_EVENT_ID_INVALID','WORLD_EVENT_TYPE_INVALID','WORLD_EXPECTED_REVISION_INVALID','WORLD_PATCH_INVALID','WORLD_PATCH_TOO_LARGE','WORLD_STATE_TOO_LARGE','WORLD_AGGREGATE_INVALID','WORLD_REVISION_CONFLICT','WORLD_EVENT_ID_REUSED'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function envKey(mapName: string, legacyName: string) {
  const raw = Deno.env.get(mapName);
  if (raw) { try { const parsed = JSON.parse(raw); if (parsed && typeof parsed.default === 'string' && parsed.default) return parsed.default; } catch (_) {} }
  return Deno.env.get(legacyName) || '';
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function bearer(req: Request) { const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || ''); return match ? match[1].trim() : ''; }
async function apiRequest(base: string, path: string, apiKey: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {}); headers.set('apikey', apiKey); headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`); else if (apiKey && !apiKey.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${apiKey}`);
  const res = await fetch(base + path, { ...init, headers }); const text = await res.text(); let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) throw new Error(`SUPABASE_${res.status}:${typeof data === 'string' ? data.slice(0,360) : JSON.stringify(data).slice(0,360)}`);
  return data;
}
function safeId(value: unknown) { const id=String(value||'').toLowerCase(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)?id:''; }
function safeName(value: unknown){const name=String(value||'Kelo').trim().replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,24);return name.length>=3?name:'Kelo';}
function safeCell(value: unknown){const out=String(value||'').trim();return CELL_RE.test(out)?out:'';}
function safeEvent(value: unknown){const out=String(value||'').trim();return EVENT_RE.test(out)?out:'';}
function safeEventType(value: unknown){const out=String(value||'').trim();return EVENT_TYPE_RE.test(out)?out:'';}
function byteLength(value: unknown){return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
function safeState(raw: any) {
  const state = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null; if (!state) throw new Error('INVALID_STATE');
  const out: Record<string, unknown> = {}; for (const key of ['economy','titles','serverMeta']) if (Object.prototype.hasOwnProperty.call(state,key)) out[key]=state[key];
  if (byteLength(out) > MAX_STATE_BYTES) throw new Error('STATE_TOO_LARGE'); return out;
}
function safePatch(raw: any){const patch=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null;if(!patch)throw new Error('WORLD_PATCH_INVALID');if(byteLength(patch)>MAX_WORLD_PATCH_BYTES)throw new Error('WORLD_PATCH_TOO_LARGE');return patch;}
function worldError(message:string){for(const code of WORLD_ERRORS)if(message.includes(code))return code;return null;}
async function adminCharacter(base:string,secretKey:string,characterId:string){
  const q=new URLSearchParams({id:`eq.${characterId}`,status:'eq.active',select:'id,account_id,name',limit:'1'});
  const rows=await apiRequest(base,`/rest/v1/characters?${q.toString()}`,secretKey,null,{method:'GET'}); return Array.isArray(rows)&&rows[0]?rows[0]:null;
}
async function verifyCharacterToken(req:Request,base:string,publishable:string,character:any){
  const token=bearer(req);if(!token)return;
  const user=await apiRequest(base,'/auth/v1/user',publishable,token,{method:'GET'});
  if(String(user?.id||'').toLowerCase()!==String(character?.account_id||'').toLowerCase())throw new Error('CHARACTER_NOT_OWNED');
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
    const supplied=req.headers.get('x-kelo-server-key')||''; if(!supplied||(await sha256Hex(supplied))!==EXPECTED_SERVER_KEY_SHA256)return json({ok:false,code:'SERVER_AUTH_REQUIRED'},401);
    const len=Number(req.headers.get('content-length')||0); if(len>MAX_BODY_BYTES)return json({ok:false,code:'BODY_TOO_LARGE'},413);
    const raw=await req.text(); if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES)return json({ok:false,code:'BODY_TOO_LARGE'},413);
    let body:any;try{body=raw?JSON.parse(raw):{}}catch(_){return json({ok:false,code:'INVALID_JSON'},400)}
    const base=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,''); const publishable=envKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'); const secret=envKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
    if(!base||!publishable||!secret)return json({ok:false,code:'SUPABASE_RUNTIME_KEYS_MISSING'},503);
    const op=String(body?.op||'');

    if(op==='world:load'){
      const cellId=safeCell(body?.cellId);if(!cellId)return json({ok:false,code:'WORLD_CELL_ID_INVALID'},400);
      const snapshot=await apiRequest(base,'/rest/v1/rpc/world_get_snapshot',secret,null,{method:'POST',body:JSON.stringify({p_cell_id:cellId})});
      return json({ok:true,cellId,snapshot:snapshot||null});
    }
    if(op==='world:replay'){
      const cellId=safeCell(body?.cellId);if(!cellId)return json({ok:false,code:'WORLD_CELL_ID_INVALID'},400);
      const afterRevision=Math.max(0,Math.floor(Number(body?.afterRevision)||0)),limit=Math.max(1,Math.min(1000,Math.floor(Number(body?.limit)||500)));
      const events=await apiRequest(base,'/rest/v1/rpc/world_replay_events',secret,null,{method:'POST',body:JSON.stringify({p_cell_id:cellId,p_after_revision:afterRevision,p_limit:limit})});
      return json({ok:true,cellId,afterRevision,events:Array.isArray(events)?events:[]});
    }
    if(op==='world:mutate'){
      const cellId=safeCell(body?.cellId),eventId=safeEvent(body?.eventId),eventType=safeEventType(body?.eventType),expectedRevision=Math.floor(Number(body?.expectedRevision));
      if(!cellId)return json({ok:false,code:'WORLD_CELL_ID_INVALID'},400);if(!eventId)return json({ok:false,code:'WORLD_EVENT_ID_INVALID'},400);if(!eventType)return json({ok:false,code:'WORLD_EVENT_TYPE_INVALID'},400);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return json({ok:false,code:'WORLD_EXPECTED_REVISION_INVALID'},400);
      const patch=safePatch(body?.patch),aggregateId=String(body?.aggregateId||'world').trim().slice(0,128);if(!aggregateId)return json({ok:false,code:'WORLD_AGGREGATE_INVALID'},400);
      const requestId=String(body?.requestId||'').trim().slice(0,160)||null,characterId=body?.characterId==null?'':safeId(body.characterId);let character:any=null;
      if(body?.characterId!=null&&!characterId)return json({ok:false,code:'INVALID_CHARACTER_ID'},400);
      if(characterId){character=await adminCharacter(base,secret,characterId);if(!character)return json({ok:false,code:'CHARACTER_NOT_FOUND'},404);await verifyCharacterToken(req,base,publishable,character);}
      else if(bearer(req))return json({ok:false,code:'CHARACTER_REQUIRED'},400);
      const result=await apiRequest(base,'/rest/v1/rpc/world_apply_mutation',secret,null,{method:'POST',body:JSON.stringify({p_cell_id:cellId,p_event_id:eventId,p_expected_revision:expectedRevision,p_event_type:eventType,p_patch:patch,p_aggregate_id:aggregateId,p_actor_user_id:character?.account_id||null,p_character_id:characterId||null,p_request_id:requestId})});
      return json({ok:true,result});
    }

    const characterId=safeId(body?.characterId); if(!characterId)return json({ok:false,code:'INVALID_CHARACTER_ID'},400);
    const character=await adminCharacter(base,secret,characterId); if(!character)return json({ok:false,code:'CHARACTER_NOT_FOUND'},404);
    await verifyCharacterToken(req,base,publishable,character);
    const stateQuery=new URLSearchParams({character_id:`eq.${characterId}`,select:'character_id,revision,schema_version,zone_key,payload,updated_at',limit:'1'});
    if(op==='load'){
      const rows=await apiRequest(base,`/rest/v1/character_state_snapshots?${stateQuery.toString()}`,secret,null,{method:'GET'}); return json({ok:true,characterId,snapshot:Array.isArray(rows)&&rows[0]?rows[0]:null});
    }
    if(op==='save'){
      const patch=safeState(body?.state); const current=await apiRequest(base,`/rest/v1/character_state_snapshots?${stateQuery.toString()}`,secret,null,{method:'GET'}); const previous=Array.isArray(current)&&current[0]?current[0]:null;
      const revision=Math.max(0,Number(previous?.revision||0))+1; const payload={...(previous?.payload&&typeof previous.payload==='object'?previous.payload:{}),...patch,version:'kelo-persisted-state-v1'};
      if(byteLength(payload)>MAX_STATE_BYTES)throw new Error('STATE_TOO_LARGE');
      const row={character_id:characterId,revision,schema_version:1,zone_key:'server-authoritative',payload,updated_at:new Date().toISOString()};
      const saved=await apiRequest(base,'/rest/v1/character_state_snapshots?on_conflict=character_id',secret,null,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
      return json({ok:true,characterId,revision,snapshot:Array.isArray(saved)&&saved[0]?saved[0]:row});
    }
    if(op==='nobility:ensure'){
      const q=new URLSearchParams({player_id:`eq.${characterId}`,select:'*',limit:'1'}); let rows=await apiRequest(base,`/rest/v1/nobility_players?${q.toString()}`,secret,null,{method:'GET'});
      if(Array.isArray(rows)&&rows[0]){const name=safeName(body?.name);if(rows[0].name!==name)await apiRequest(base,`/rest/v1/nobility_players?player_id=eq.${encodeURIComponent(characterId)}`,secret,null,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({name})});return json({ok:true,row:{...rows[0],name}});}
      rows=await apiRequest(base,'/rest/v1/nobility_players',secret,null,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:characterId,name:safeName(body?.name)})}); return json({ok:true,row:rows[0]});
    }
    if(op==='nobility:get'){
      const rows=await apiRequest(base,`/rest/v1/nobility_players?player_id=eq.${encodeURIComponent(characterId)}&select=*`,secret,null,{method:'GET'}); return json({ok:true,row:Array.isArray(rows)&&rows[0]?rows[0]:null});
    }
    if(op==='nobility:top'){
      const limit=Math.max(1,Math.min(100,Math.floor(Number(body?.limit)||60))); const rows=await apiRequest(base,`/rest/v1/nobility_players?select=player_id,name,donation&order=donation.desc,name.asc&limit=${limit}`,secret,null,{method:'GET'}); return json({ok:true,rows});
    }
    if(op==='nobility:donate'){
      const currency=body?.currency==='kc'?'kc':body?.currency==='gold'?'gold':''; const amount=Math.floor(Number(body?.amount)); if(!currency||!Number.isSafeInteger(amount)||amount<=0)return json({ok:false,code:'INVALID_DONATION'},400);
      const rows=await apiRequest(base,'/rest/v1/rpc/nobility_donate',secret,null,{method:'POST',body:JSON.stringify({p_player_id:characterId,p_currency:currency,p_amount:amount})}); return json({ok:true,row:Array.isArray(rows)&&rows[0]?rows[0]:null});
    }
    return json({ok:false,code:'UNKNOWN_OPERATION'},400);
  } catch (error) {
    const message=String(error?.message||error||'EDGE_ERROR'),worldCode=worldError(message);console.error('kelo-server-state',message.slice(0,300));
    if(worldCode)return json({ok:false,code:worldCode},worldCode==='WORLD_REVISION_CONFLICT'?409:400);
    if(message.includes('CHARACTER_NOT_OWNED'))return json({ok:false,code:'CHARACTER_NOT_OWNED'},403);
    if(message.includes('STATE_TOO_LARGE'))return json({ok:false,code:'STATE_TOO_LARGE'},413);
    return json({ok:false,code:'EDGE_ERROR'},500);
  }
});

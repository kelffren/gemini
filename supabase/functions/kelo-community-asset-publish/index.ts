/* KELO-INDEX
 * area: SUPABASE / EDGE FUNCTIONS / COMMUNITY ASSETS
 * owner: Kelo Community Asset Pipeline
 * purpose: authenticated raster quarantine -> server validation -> creator-global publication
 * security: user JWT required; service key stays server-side; client metadata is never trusted for hash/dimensions/Guardian proof
 */

const VERSION='kelo-community-asset-publish-v2-guardian-proof';
const MAX_BYTES=5*1024*1024;
const MAX_DIMENSION=2048;
const MAX_PIXELS=4_194_304;
const HOURLY_LIMIT=30;
const ALLOWED_MIME=new Set(['image/png','image/webp','image/jpeg']);
const ALLOWED_ORIGINS=new Set(['https://kelffren.github.io','http://localhost:3000','http://127.0.0.1:3000','http://localhost:8000','http://127.0.0.1:8000']);

function env(...names:string[]){for(const name of names){const value=Deno.env.get(name);if(value?.trim())return value.trim();}return '';}
function base(){return env('SUPABASE_URL').replace(/\/$/,'');}
function publishableKey(){const mapped=env('SUPABASE_PUBLISHABLE_KEYS');if(mapped){try{const value=JSON.parse(mapped)?.default;if(typeof value==='string'&&value)return value;}catch{}}return env('SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY');}
function serviceKey(){return env('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY');}
function bearer(req:Request){const m=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')||'');return m?m[1].trim():'';}
function normalizeOrigin(value:string|null){return String(value||'').trim().replace(/\/$/,'');}
function corsOrigin(req:Request){const origin=normalizeOrigin(req.headers.get('origin'));return origin&&ALLOWED_ORIGINS.has(origin)?origin:'';}
function headers(origin=''){const h:Record<string,string>={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};if(origin){h['access-control-allow-origin']=origin;h['access-control-allow-headers']='authorization, apikey, content-type';h['access-control-allow-methods']='POST, OPTIONS';h.vary='Origin';}return h;}
function json(data:unknown,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:headers(origin)});}
function fail(code:string,status=400,detail=''){return Object.assign(new Error(code),{code,status,detail});}
function safeName(value:unknown,max=80){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);}
function safeSlug(value:unknown){const s=String(value??'asset').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42);return s.length>=2?s:'asset';}
function encodePath(path:string){return path.split('/').map(encodeURIComponent).join('/');}
function extFor(mime:string){return mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';}
function userHeaders(token:string){return{apikey:publishableKey(),authorization:`Bearer ${token}`,'content-type':'application/json'};}
function adminHeaders(contentType='application/json'){const key=serviceKey();return{apikey:key,authorization:`Bearer ${key}`,'content-type':contentType};}

async function responseJson(res:Response){const text=await res.text();let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}if(!res.ok)throw fail('SUPABASE_REQUEST_FAILED',res.status,typeof body==='string'?body:JSON.stringify(body));return body;}
async function requireUser(req:Request){const token=bearer(req);if(!token)throw fail('AUTH_TOKEN_REQUIRED',401);const url=base(),key=publishableKey();if(!url||!key)throw fail('SUPABASE_RUNTIME_KEYS_MISSING',503);const res=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,authorization:`Bearer ${token}`}});const user=await responseJson(res);if(!user?.id||user?.is_anonymous===true)throw fail('AUTH_USER_REQUIRED',403);return{token,user};}
async function sha256Hex(bytes:ArrayBuffer){const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function be16(v:Uint8Array,o:number){return (v[o]<<8)|v[o+1];}
function be32(v:Uint8Array,o:number){return ((v[o]<<24)>>>0)|(v[o+1]<<16)|(v[o+2]<<8)|v[o+3];}
function ascii(v:Uint8Array,o:number,n:number){return String.fromCharCode(...v.slice(o,o+n));}
function imageDimensions(bytes:ArrayBuffer,mime:string){
  const v=new Uint8Array(bytes);
  if(mime==='image/png'){
    if(v.length<24||v[0]!==0x89||ascii(v,1,3)!=='PNG'||ascii(v,12,4)!=='IHDR')throw fail('INVALID_PNG',400);
    return{width:be32(v,16),height:be32(v,20)};
  }
  if(mime==='image/jpeg'){
    if(v.length<4||v[0]!==0xff||v[1]!==0xd8)throw fail('INVALID_JPEG',400);
    const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    let i=2;
    while(i+9<v.length){while(i<v.length&&v[i]!==0xff)i++;while(i<v.length&&v[i]===0xff)i++;if(i>=v.length)break;const marker=v[i++];if(marker===0xd8||marker===0xd9)continue;if(i+1>=v.length)break;const len=be16(v,i);if(len<2||i+len>v.length)break;if(sof.has(marker)){const height=be16(v,i+3),width=be16(v,i+5);return{width,height};}i+=len;}
    throw fail('JPEG_DIMENSIONS_UNREADABLE',400);
  }
  if(mime==='image/webp'){
    if(v.length<30||ascii(v,0,4)!=='RIFF'||ascii(v,8,4)!=='WEBP')throw fail('INVALID_WEBP',400);
    const chunk=ascii(v,12,4);
    if(chunk==='VP8X')return{width:1+v[24]+(v[25]<<8)+(v[26]<<16),height:1+v[27]+(v[28]<<8)+(v[29]<<16)};
    if(chunk==='VP8L'&&v[20]===0x2f)return{width:1+v[21]+((v[22]&0x3f)<<8),height:1+(v[22]>>6)+(v[23]<<2)+((v[24]&0x0f)<<10)};
    if(chunk==='VP8 '&&v[23]===0x9d&&v[24]===0x01&&v[25]===0x2a)return{width:(v[26]|(v[27]<<8))&0x3fff,height:(v[28]|(v[29]<<8))&0x3fff};
    throw fail('WEBP_DIMENSIONS_UNREADABLE',400);
  }
  throw fail('UNSUPPORTED_MIME',415);
}
function validateDimensions(d:{width:number,height:number}){if(!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.width>MAX_DIMENSION||d.height>MAX_DIMENSION||d.width*d.height>MAX_PIXELS)throw fail('IMAGE_DIMENSIONS_REJECTED',413);}
async function rpc(path:string,body:unknown,headersInit:HeadersInit){return responseJson(await fetch(`${base()}/rest/v1/rpc/${path}`,{method:'POST',headers:headersInit,body:JSON.stringify(body)}));}
async function rateLimit(userId:string){const since=new Date(Date.now()-60*60*1000).toISOString();const q=new URLSearchParams({owner_user_id:`eq.${userId}`,created_at:`gte.${since}`,select:'id',limit:String(HOURLY_LIMIT+1)});const rows=await responseJson(await fetch(`${base()}/rest/v1/asset_revisions?${q}`,{headers:adminHeaders()}));if(Array.isArray(rows)&&rows.length>=HOURLY_LIMIT)throw fail('COMMUNITY_ASSET_RATE_LIMIT',429);}
async function upload(bucket:string,path:string,blob:Blob,authorizationHeaders:Record<string,string>,upsert=false){const h={...authorizationHeaders,'content-type':blob.type,'x-upsert':upsert?'true':'false'};const res=await fetch(`${base()}/storage/v1/object/${bucket}/${encodePath(path)}`,{method:'POST',headers:h,body:blob});if(res.ok)return responseJson(res);const text=await res.text();if(!upsert&&res.status===400&&/already exists|duplicate/i.test(text))return{duplicate:true};throw fail('STORAGE_UPLOAD_FAILED',res.status,text.slice(0,400));}
async function findFamily(userId:string,slug:string,token:string){const q=new URLSearchParams({owner_user_id:`eq.${userId}`,slug:`eq.${slug}`,select:'id,stable_key',limit:'1'});const rows=await responseJson(await fetch(`${base()}/rest/v1/asset_families?${q}`,{headers:userHeaders(token)}));return Array.isArray(rows)?rows[0]||null:null;}
async function createOrFindFamily(userId:string,token:string,slug:string,name:string,kind:string,tags:string[]){try{return await rpc('create_asset_family',{p_slug:slug,p_name:name,p_kind:kind,p_category:'community',p_semantic_family:'community',p_tags:tags,p_districts:[],p_metadata:{source:'community-auto-publish',policyVersion:3}},userHeaders(token));}catch(error){const found=await findFamily(userId,slug,token);if(found)return found;throw error;}}
async function guardianProof(revisionId:string,assetHash:string){
  try{
    const proof=await rpc('record_asset_guardian_provenance',{p_revision_id:revisionId,p_asset_hash:assetHash},adminHeaders());
    if(proof?.verified===true&&proof?.assetHash===assetHash){
      return{verified:true,provenance:{source:'guardian-community-supabase-v1',assetHash,communityBuilt:true,preset:String(proof.preset||''),contributorCount:Math.max(2,Number(proof.contributorCount)||2),verifiedAt:Number(proof.verifiedAt)||null}};
    }
  }catch(error){console.warn('[community asset publish] Guardian proof unavailable; publishing without Guardian badge',String((error as any)?.message||error));}
  return{verified:false,provenance:null};
}

Deno.serve(async(req:Request)=>{
  const origin=corsOrigin(req);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin);
  try{
    const {token,user}=await requireUser(req);
    await rateLimit(user.id);
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))throw fail('FILE_REQUIRED',400);
    if(!ALLOWED_MIME.has(file.type))throw fail('UNSUPPORTED_MIME',415);
    if(file.size<1||file.size>MAX_BYTES)throw fail('FILE_SIZE_REJECTED',413);
    const bytes=await file.arrayBuffer();
    if(bytes.byteLength!==file.size)throw fail('FILE_SIZE_MISMATCH',400);
    const dimensions=imageDimensions(bytes,file.type);validateDimensions(dimensions);
    const hash=await sha256Hex(bytes);
    const requestedHash=String(form.get('sha256')||'').toLowerCase();if(requestedHash&&requestedHash!==hash)throw fail('SHA256_MISMATCH',400);
    const name=safeName(form.get('name')||file.name||'Community asset')||'Community asset';
    const rawKind=String(form.get('kind')||'item').toLowerCase();const kind=['prop','tile','character','mount','item','vfx','ui','other'].includes(rawKind)?rawKind:'item';
    const tags=String(form.get('tags')||'').split(',').map(x=>safeName(x,24).toLowerCase()).filter(Boolean).slice(0,8);
    const slug=`${safeSlug(name)}-${hash.slice(0,12)}`.slice(0,63);
    const ext=extFor(file.type),privatePath=`${user.id}/${hash}.${ext}`,publicPath=`${user.id}/${hash}.${ext}`;
    const userStorageHeaders={apikey:publishableKey(),authorization:`Bearer ${token}`};
    await upload('creator-private',privatePath,new Blob([bytes],{type:file.type}),userStorageHeaders,false);
    const family=await createOrFindFamily(user.id,token,slug,name,kind,tags);
    const revision=await rpc('register_asset_revision',{
      p_family_id:family.id,p_storage_path:privatePath,p_content_hash:hash,p_mime_type:file.type,p_byte_size:file.size,
      p_pixel_width:dimensions.width,p_pixel_height:dimensions.height,p_world_width:null,p_world_height:null,p_collision_mode:'none',
      p_render_phase:'aboveActor',p_metadata:{source:'community-auto-publish',policyVersion:3,serverStructuralVerified:true,guardianAuthority:'public.asset_guardian_provenance'}
    },userHeaders(token));
    await upload('creator-global',publicPath,new Blob([bytes],{type:file.type}),{apikey:serviceKey(),authorization:`Bearer ${serviceKey()}`},true);
    const publication=await rpc('publish_asset_revision',{p_revision_id:revision.id,p_public_storage_path:publicPath,p_visibility:'global',p_published_by:user.id},adminHeaders());
    const guardian=await guardianProof(revision.id,hash);
    const publicUrl=`${base()}/storage/v1/object/public/creator-global/${encodePath(publicPath)}`;
    return json({ok:true,status:'published',version:VERSION,assetId:revision.asset_id,revisionId:revision.id,publicationId:publication.id,url:publicUrl,sha256:hash,mime:file.type,bytes:file.size,width:dimensions.width,height:dimensions.height,creatorId:user.id,moderation:'automatic-structural',serverStructuralVerified:true,guardianVerified:guardian.verified,guardianProvenance:guardian.provenance},200,origin);
  }catch(error){const e:any=error;console.error('[community asset publish]',e?.code||e?.message||e,e?.detail||'');return json({ok:false,error:e?.code||'COMMUNITY_ASSET_PUBLISH_FAILED',detail:e?.detail||''},Number(e?.status)||500,origin);}
});

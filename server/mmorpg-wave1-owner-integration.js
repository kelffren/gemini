/* KELO-INDEX
 * area: SERVER / MMORPG WAVE 1 OWNER INTEGRATION
 * owner: Kelo server authority
 * purpose: bind Wave 1 authority/creator contracts to existing Online Foundation without creating a second gameplay server
 * consumes: online identity owner, Guardian coordinator descriptor, existing server AOI contract
 * do-not: NO trust client authority claims, NO make Guardian authoritative, NO duplicate economy/world persistence owners
 */
'use strict';

const ROLE_CAPABILITIES=Object.freeze({
  creator:Object.freeze(['creator.build','creator.test']),
  moderator:Object.freeze(['creator.review','creator.moderate']),
  official:Object.freeze(['creator.review']),
  admin:Object.freeze(['creator.build','creator.test','creator.review','creator.publish','creator.moderate','creator.permissions','creator.revenue']),
  owner:Object.freeze(['creator.build','creator.test','creator.review','creator.publish','creator.moderate','creator.permissions','creator.revenue']),
  developer:Object.freeze(['creator.build','creator.test','creator.review']),
  superadmin:Object.freeze(['creator.build','creator.test','creator.review','creator.publish','creator.moderate','creator.permissions','creator.revenue'])
});
const DIRECT_PERMISSION_MAP=Object.freeze({
  'world.build':'creator.build','world.test':'creator.test','world.review':'creator.review','world.publish':'creator.publish',
  'creator.build':'creator.build','creator.test':'creator.test','creator.review':'creator.review','creator.publish':'creator.publish',
  'creator.moderate':'creator.moderate','creator.permissions':'creator.permissions','creator.revenue':'creator.revenue',
  'admin.issue':'creator.moderate'
});
const FORBIDDEN_CLIENT_TYPES=new Set([
  'entity:commit','entity:authority-transfer','world:commit','world:mutation','world:event:append','world:ledger:append',
  'world:partition:claim','world:partition:transfer','world:partition:release','liveops:flag:set','liveops:flag:disable',
  'liveops:incident:open','liveops:incident:close','creator:permission:grant','creator:permission:revoke','creator:role:assign'
]);

function clean(value,max=128){return String(value==null?'':value).trim().slice(0,max);}
function unique(values){return [...new Set(values.map(v=>clean(v,128)).filter(Boolean))].sort();}
function capabilitiesFor(resolved){
  const caps=[];
  for(const role of resolved?.roles||[])caps.push(...(ROLE_CAPABILITIES[String(role).toLowerCase()]||[]));
  for(const permission of resolved?.permissions||[]){const mapped=DIRECT_PERMISSION_MAP[String(permission).toLowerCase()];if(mapped)caps.push(mapped);}
  return unique(caps);
}
function principalFromResolved(resolved){
  if(!resolved?.authenticated||resolved.source!=='supabase-auth-rls'||!resolved.accountId||!resolved.characterId)return null;
  return Object.freeze({
    creatorId:`creator:${String(resolved.accountId).toLowerCase()}`,
    accountId:String(resolved.accountId).toLowerCase(),
    characterId:String(resolved.characterId).toLowerCase(),
    roles:Object.freeze(unique(resolved.roles||[])),
    permissions:Object.freeze(unique(resolved.permissions||[])),
    capabilities:Object.freeze(capabilitiesFor(resolved)),
    source:'supabase-auth-rls',
    serverVerified:true
  });
}
function publicPrincipal(principal){if(!principal)return null;return Object.freeze({creatorId:principal.creatorId,characterId:principal.characterId,capabilities:principal.capabilities,serverVerified:true});}

function createMmorpgWave1OwnerIntegration({identity,guardian,aoi={}}={}){
  if(typeof identity?.resolve!=='function')throw new Error('MMORPG_WAVE1_IDENTITY_OWNER_REQUIRED');
  const aoiContract=Object.freeze({
    owner:'server/index.js',
    mode:'server-spatial-grid-hysteresis-v1',
    cell:Math.max(1,Number(aoi.cell)||512),
    radius:Math.max(1,Number(aoi.radius)||1350),
    hysteresis:Math.max(0,Number(aoi.hysteresis)||180),
    serverFiltered:true,
    boundedSubscriptions:true
  });
  let deniedAuthorityClaims=0,creatorResolutions=0;
  function guardClientMessage(message){
    const msg=message&&typeof message==='object'?message:{},type=clean(msg.t,96);
    const source=clean(msg.source,96).toLowerCase();
    if(FORBIDDEN_CLIENT_TYPES.has(type)){
      deniedAuthorityClaims++;
      const error=new Error(`CLIENT_AUTHORITY_WRITE_FORBIDDEN:${type}`);error.code='CLIENT_AUTHORITY_WRITE_FORBIDDEN';throw error;
    }
    if(msg.authoritative===true||source==='server-authoritative'||source.startsWith('server-authoritative-')){
      deniedAuthorityClaims++;
      const error=new Error('CLIENT_AUTHORITY_CLAIM_FORBIDDEN');error.code='CLIENT_AUTHORITY_CLAIM_FORBIDDEN';throw error;
    }
    return msg;
  }
  function guardGuardianEnvelope(envelope){
    const input=envelope&&typeof envelope==='object'?envelope:{};
    if(input.authoritative===true)throw new Error('GUARDIAN_AUTHORITY_FORBIDDEN');
    return Object.freeze({...input,authoritative:false,transport:clean(input.transport,64)||'guardian-non-authoritative'});
  }
  async function resolveCreator(input){
    const resolved=await identity.resolve(input||{}),principal=principalFromResolved(resolved);if(principal)creatorResolutions++;
    return Object.freeze({resolved,principal});
  }
  function bindResolvedIdentity(connection,resolved){
    const principal=principalFromResolved(resolved);if(principal)creatorResolutions++;
    if(connection&&typeof connection==='object')connection.creatorPrincipal=principal;
    return principal;
  }
  function can(principal,capability){return !!principal?.serverVerified&&principal.capabilities?.includes(String(capability));}
  function requireCapability(principal,capability){if(!can(principal,capability))throw new Error(`CREATOR_CAPABILITY_DENIED:${capability}`);return true;}
  function audit(){return Object.freeze({
    version:'kelo-mmorpg-wave1-server-owner-integration-v1',
    identityOwner:'server/online-identity-store.js',identityServerVerified:true,
    creatorIdentityBound:true,creatorPermissionBound:true,
    aoi:aoiContract,
    replicationOwner:'server/index.js + server/pvp-authority.js',protectedStateServerOwned:true,
    guardianTransportOnly:true,guardianCoordinatorVersion:String(guardian?.version||guardian?.audit?.()?.version||'unknown'),
    clientAuthorityClaimsDenied:true,deniedAuthorityClaims,creatorResolutions
  });}
  return Object.freeze({version:'kelo-mmorpg-wave1-server-owner-integration-v1',aoi:aoiContract,guardClientMessage,guardGuardianEnvelope,principalFromResolved,publicPrincipal,resolveCreator,bindResolvedIdentity,can,requireCapability,audit});
}
module.exports={createMmorpgWave1OwnerIntegration,principalFromResolved,capabilitiesFor,FORBIDDEN_CLIENT_TYPES};

'use strict';
const assert=require('assert');
const {createAvatarSyncStore}=require('./avatar-sync-store');

const CHARACTER='11111111-1111-4111-8111-111111111111';
const REVISION='22222222-2222-4222-8222-222222222222';
const ASSET_REVISION='33333333-3333-4333-8333-333333333333';
const store=createAvatarSyncStore({supabaseUrl:'https://example.supabase.co',supabaseApiKey:'publishable-test',fetchImpl:async()=>{throw new Error('NETWORK_SHOULD_NOT_RUN');}});

function raw(overrides={}){
  const row={
    slotKey:'weaponMain',bindingKind:'equipment',revisionId:REVISION,contentId:'creator.weapon.test',stableKey:'creator.weapon.test',revision:3,contentHash:'abc123',contentType:'equipment',displayName:'Test Sword',tags:['weapon'],
    payload:{slotId:'weaponMain',targetType:'character',rarity:'rare',characterVisual:{mode:'socket',socket:'weapon',width:58,height:58,anchor:{x:.5,y:.88},layer:'front'}},
    asset:{role:'primary',ordinal:0,assetRevisionId:ASSET_REVISION,assetId:'creator.asset.test',contentHash:'asset123',mimeType:'image/png',byteSize:1000,pixelWidth:64,pixelHeight:64,publicStorageBucket:'creator-global',publicStoragePath:'approved/test.png',assetVisibility:'global'}
  };
  if(overrides.row)Object.assign(row,overrides.row);
  if(overrides.payload)Object.assign(row.payload,overrides.payload);
  if(overrides.asset)Object.assign(row.asset,overrides.asset);
  return{characterId:CHARACTER,source:'server-authoritative-published',loadout:[row]};
}

const weapon=store.sanitizeAppearance(raw());
assert(weapon,'valid published modular appearance should sanitize');
assert.strictEqual(weapon.loadout.length,1);
assert.strictEqual(weapon.loadout[0].slotKey,'weaponMain');
assert.strictEqual(Object.prototype.hasOwnProperty.call(weapon.loadout[0].payload,'transforms'),false,'absent transforms must stay absent so shared weapon defaults survive');
assert.strictEqual(weapon.loadout[0].assets[0].runtimeUrl,'https://example.supabase.co/storage/v1/object/public/creator-global/approved/test.png');

const declared=store.sanitizeAppearance(raw({payload:{transforms:{default:{x:3,y:-2,rotation:15,scaleX:1.2,scaleY:.8}}}}));
assert(declared?.loadout[0]?.payload?.transforms?.default,'declared transforms should survive sanitization');
assert.strictEqual(declared.loadout[0].payload.transforms.default.x,3);
assert.strictEqual(declared.loadout[0].payload.transforms.default.rotation,15);

assert.strictEqual(store.sanitizeAppearance(raw({asset:{publicStorageBucket:'creator-private'}})),null,'private bucket must never replicate');
assert.strictEqual(store.sanitizeAppearance(raw({asset:{assetVisibility:'private'}})),null,'unapproved visibility must never replicate');
assert.strictEqual(store.sanitizeAppearance(raw({row:{slotKey:'weaponSecondary'},payload:{slotId:'weaponMain'}})),null,'forged slot mismatch must be rejected');

console.log('PASS  Creator modular presentation sanitizer smoke test');

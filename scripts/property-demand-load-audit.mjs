/* KELO-INDEX
 * area: PROPERTY / BOOT QA
 * owner: Kelo Property System
 * keys: PROPERTY ASSET DEMAND LOAD ATLAS BOOT EAGER REQUEST AUDIT
 * purpose: prove catalog registration performs zero image acquisition and rendering demand performs one deduped Atlas Contract acquisition
 * public-api: CLI audit
 * state-owned: none
 * online: N/A; deterministic VM test
 */
import fs from 'node:fs';
import vm from 'node:vm';
import {setImmediate as tick} from 'node:timers/promises';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const source=fs.readFileSync('src/property/property-system.js','utf8');
const template=Object.freeze({id:'imperial:test',width:96,height:96,snap:32,collision:null,parts:Object.freeze([Object.freeze({assetKey:'imperialBench',source:Object.freeze({x:0,y:0,w:32,h:32}),offset:Object.freeze({x:0,y:0}),size:Object.freeze({w:96,h:96}),phase:'props_back',opacity:1})])});
let acquireCount=0,resolveAcquire=null,drawCount=0;
const catalog={tileSize:32,get:id=>id===template.id?template:null,list:()=>[template],onRegister:()=>()=>{}};
const layers={register:()=>true};
const atlas={acquire:key=>{acquireCount++;assert(key==='imperialBench','unexpected asset key');return new Promise(resolve=>{resolveAcquire=resolve;});}};
const collision={replaceOwner:()=>0};
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
const window={KELO_PROPERTY_CATALOG:catalog,KELO_ENVIRONMENT_LAYERS:layers,KELO_ATLAS_CONTRACT:atlas,KELO_COLLISION:collision,dispatchEvent:()=>true,CustomEvent};
const context={window,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},CustomEvent,console,JSON,Math,Number,String,Array,Object,Date,Set,Map,Promise};
vm.createContext(context);vm.runInContext(source,context,{filename:'property-system.js'});
assert(acquireCount===0,'PROPERTY_BOOT_EAGER_ACQUIRE_DETECTED');
const g={globalAlpha:1,imageSmoothingEnabled:true,save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){drawCount++;}};
const row={placementId:'p1',parcelId:'parcel:test',ownerId:'tester',assetId:template.id,x:0,y:0,rotation:0,scale:1};
const api=window.KELO_PROPERTY_SYSTEM;assert(api?.drawPlacements,'PROPERTY_SYSTEM_API_MISSING');
assert(api.drawPlacements(g,[row],'props_back')===0,'FIRST_DRAW_MUST_WAIT_FOR_ASSET');
assert(acquireCount===1,'FIRST_DRAW_MUST_REQUEST_EXACTLY_ONE_ASSET');
api.drawPlacements(g,[row],'props_back');
assert(acquireCount===1,'INFLIGHT_DRAW_MUST_NOT_DUPLICATE_ACQUIRE');
resolveAcquire({tag:'image'});await tick();
assert(api.drawPlacements(g,[row],'props_back')===1,'READY_ASSET_MUST_DRAW');
assert(acquireCount===1,'READY_DRAW_MUST_NOT_REACQUIRE');
assert(drawCount===1,'READY_DRAW_MUST_DRAW_ONCE');
console.log('PROPERTY_DEMAND_LOAD_AUDIT_PASS bootAcquires=0 demandAcquires=1 duplicateAcquires=0');

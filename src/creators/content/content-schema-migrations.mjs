/* KELO-INDEX
 * area: CREATORS / CONTENT COMPATIBILITY
 * owner: Universal Content Studio schema compatibility extension
 * keys: CONTENT SCHEMA VERSION MIGRATION BACKWARD COMPATIBILITY IMMUTABLE ID
 * purpose: provide deterministic forward migrations for semantic content payloads while preserving stable identity and immutable revision history
 * public-api: CURRENT_CONTENT_SCHEMA_VERSION, createContentSchemaMigrationRegistry, CONTENT_SCHEMA_MIGRATIONS, migrateContentRecord
 * consumes: semantic content records only; no runtime owners or Supabase transport
 * state-owned: registered migration functions in memory only
 * online: server/browser can share the same deterministic migration chain before owner-specific activation
 * do-not: NO database writes, NO runtime registration, NO asset mutation, NO downgrade migrations
 */

export const CURRENT_CONTENT_SCHEMA_VERSION=1;
const IDENTITY_KEYS=Object.freeze(['contentId','stableKey']);
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));

function asVersion(value){
  const n=Number(value);
  if(!Number.isInteger(n)||n<1)throw new Error(`INVALID_CONTENT_SCHEMA_VERSION:${value}`);
  return n;
}

export function createContentSchemaMigrationRegistry({currentVersion=CURRENT_CONTENT_SCHEMA_VERSION}={}){
  currentVersion=asVersion(currentVersion);
  const steps=new Map();

  function register({from,to=Number(from)+1,migrate,validate=null,description=''}={}){
    from=asVersion(from);to=asVersion(to);
    if(to!==from+1)throw new Error(`CONTENT_MIGRATION_MUST_BE_CONTIGUOUS:${from}->${to}`);
    if(from>=currentVersion)throw new Error(`CONTENT_MIGRATION_OUTSIDE_TARGET:${from}->${to}`);
    if(typeof migrate!=='function')throw new TypeError('CONTENT_MIGRATION_FUNCTION_REQUIRED');
    if(validate!=null&&typeof validate!=='function')throw new TypeError('CONTENT_MIGRATION_VALIDATOR_INVALID');
    if(steps.has(from))throw new Error(`CONTENT_MIGRATION_DUPLICATE_FROM:${from}`);
    steps.set(from,Object.freeze({from,to,migrate,validate,description:String(description||'')}));
    return to;
  }

  function plan(from,to=currentVersion){
    from=asVersion(from);to=asVersion(to);
    if(to>currentVersion)throw new Error(`CONTENT_TARGET_AHEAD_OF_RUNTIME:${to}>${currentVersion}`);
    if(from>to)throw new Error(`CONTENT_DOWNGRADE_UNSUPPORTED:${from}->${to}`);
    const out=[];
    for(let v=from;v<to;v++){
      const step=steps.get(v);
      if(!step)throw new Error(`CONTENT_MIGRATION_GAP:${v}->${v+1}`);
      out.push(step);
    }
    return Object.freeze(out.slice());
  }

  function migrate(input,{toVersion=currentVersion,context=null}={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('CONTENT_RECORD_OBJECT_REQUIRED');
    const from=asVersion(input.schemaVersion??1);
    const identity=Object.fromEntries(IDENTITY_KEYS.map(key=>[key,input[key]]));
    let value=copy(input);
    for(const step of plan(from,toVersion)){
      const next=step.migrate(copy(value),Object.freeze({from:step.from,to:step.to,context}));
      if(!next||typeof next!=='object'||Array.isArray(next))throw new Error(`CONTENT_MIGRATION_INVALID_OUTPUT:${step.from}->${step.to}`);
      for(const key of IDENTITY_KEYS){
        if(identity[key]!=null&&next[key]!==identity[key])throw new Error(`CONTENT_MIGRATION_IDENTITY_CHANGED:${key}:${step.from}->${step.to}`);
      }
      next.schemaVersion=step.to;
      if(step.validate&&step.validate(next,Object.freeze({from:step.from,to:step.to,context}))===false)throw new Error(`CONTENT_MIGRATION_VALIDATION_FAILED:${step.from}->${step.to}`);
      value=next;
    }
    value.schemaVersion=asVersion(toVersion);
    return Object.freeze(value);
  }

  function canMigrate(from,to=currentVersion){try{plan(from,to);return true;}catch{return false;}}
  function describe(){return Object.freeze({currentVersion,registered:Object.freeze([...steps.values()].map(({from,to,description})=>Object.freeze({from,to,description})))});}
  return Object.freeze({currentVersion,register,plan,migrate,canMigrate,describe});
}

export const CONTENT_SCHEMA_MIGRATIONS=createContentSchemaMigrationRegistry({currentVersion:CURRENT_CONTENT_SCHEMA_VERSION});
export function migrateContentRecord(record,options){return CONTENT_SCHEMA_MIGRATIONS.migrate(record,options);}

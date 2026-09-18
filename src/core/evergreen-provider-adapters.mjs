/* KELO-INDEX
 * area: FOUNDATION / EVERGREEN / PROVIDER ADAPTERS
 * owner: Kelo Evergreen Provider Adapter Registry
 * keys: ADAPTER PROVIDER PORT ANTI-LOCK-IN FALLBACK STORAGE REALTIME AI ANALYTICS ASSET DELIVERY
 * purpose: define stable provider ports so external vendors can be replaced without changing game-domain callers
 * public-api: EVERGREEN_PROVIDER_PORTS, createProviderAdapterRegistry
 * state-owned: in-memory adapter registrations supplied by bootstrap/composition code
 * online: adapters may later connect online providers; this registry itself performs no network I/O
 * extension-points: register additional providers against an existing port contract; add a new port only with a versioned contract
 * do-not: NO vendor imports in this file, NO secrets, NO implicit global provider selection, NO gameplay authority
 */

const freeze=value=>Object.freeze(value);

export const EVERGREEN_PROVIDER_PORTS=freeze({
  realtime:freeze(['connect','disconnect','send','subscribe']),
  storage:freeze(['get','set','delete']),
  ai:freeze(['generate']),
  analytics:freeze(['track']),
  assetDelivery:freeze(['resolve'])
});

function normalizeId(value,label){
  const id=String(value??'').trim();
  if(!id)throw new Error(`${label}_REQUIRED`);
  return id;
}

function requiredMethodsFor(kind,customPorts){
  const ports=customPorts||EVERGREEN_PROVIDER_PORTS;
  const methods=ports[kind];
  if(!methods)throw new Error(`EVERGREEN_PROVIDER_PORT_UNKNOWN:${kind}`);
  return methods;
}

function validateAdapter(kind,adapter,customPorts){
  if(!adapter||typeof adapter!=='object')throw new TypeError(`EVERGREEN_PROVIDER_ADAPTER_OBJECT_REQUIRED:${kind}`);
  const missing=requiredMethodsFor(kind,customPorts).filter(method=>typeof adapter[method]!=='function');
  if(missing.length)throw new Error(`EVERGREEN_PROVIDER_ADAPTER_METHODS_MISSING:${kind}:${missing.join(',')}`);
  return adapter;
}

export function createProviderAdapterRegistry({ports=EVERGREEN_PROVIDER_PORTS}={}){
  const rows=new Map();

  function register(spec){
    if(!spec||typeof spec!=='object')throw new TypeError('EVERGREEN_PROVIDER_SPEC_REQUIRED');
    const id=normalizeId(spec.id,'EVERGREEN_PROVIDER_ID');
    const kind=normalizeId(spec.kind,'EVERGREEN_PROVIDER_KIND');
    requiredMethodsFor(kind,ports);
    const key=`${kind}:${id}`;
    if(rows.has(key))throw new Error(`EVERGREEN_PROVIDER_ALREADY_REGISTERED:${key}`);
    if(typeof spec.create!=='function')throw new TypeError(`EVERGREEN_PROVIDER_FACTORY_REQUIRED:${key}`);
    if(spec.isAvailable!=null&&typeof spec.isAvailable!=='function')throw new TypeError(`EVERGREEN_PROVIDER_AVAILABILITY_INVALID:${key}`);
    const row=freeze({
      id,
      kind,
      priority:Number.isFinite(Number(spec.priority))?Number(spec.priority):100,
      contractVersion:String(spec.contractVersion||'1.0.0'),
      create:spec.create,
      isAvailable:spec.isAvailable||(()=>true),
      notes:spec.notes?String(spec.notes):null
    });
    rows.set(key,row);
    return row;
  }

  function list(kind=null){
    const values=[...rows.values()];
    return freeze((kind?values.filter(row=>row.kind===String(kind)):values).slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id)));
  }

  function resolve(kind,context=null){
    const normalized=normalizeId(kind,'EVERGREEN_PROVIDER_KIND');
    requiredMethodsFor(normalized,ports);
    for(const row of list(normalized)){
      let available;
      try{available=Boolean(row.isAvailable(context));}catch{continue;}
      if(available)return row;
    }
    return null;
  }

  function create(kind,context=null){
    const row=resolve(kind,context);
    if(!row)throw new Error(`EVERGREEN_PROVIDER_UNAVAILABLE:${kind}`);
    return validateAdapter(row.kind,row.create(context),ports);
  }

  function snapshot(){
    return freeze(list().map(({id,kind,priority,contractVersion,notes})=>freeze({id,kind,priority,contractVersion,notes})));
  }

  return freeze({register,list,resolve,create,snapshot,get size(){return rows.size;}});
}

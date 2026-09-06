from pathlib import Path
import re

ROOT=Path('.')

def replace_once(text, pattern, repl, label, flags=0):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    return out

# Patch Property without duplicating its editor/economy.
p=ROOT/'src/property/property-system.js'
s=p.read_text()
s=replace_once(s,
    r"  function canEdit\(p,owner\)\{return !!p&&\(p.kind==='world_editor'\|\|p.ownerId===owner\);\}\n",
    "  function canEdit(p,owner){return !!p&&(p.kind==='world_editor'||p.ownerId===owner);}\n"
    "  function currentHouseInstance(){const i=window.KELO_INSTANCES?.current?.();return i&&i.type==='house'?i:null;}\n"
    "  function placementVisible(rec){const p=parcel(rec.parcelId),i=currentHouseInstance();return i?(p?.kind==='house'&&p.houseId===i.resourceId):(p?.kind!=='house');}\n"
    "  function isHouseMutation(op,data){if(!['place','move','rotate','remove'].includes(op))return false;let p=null;if(op==='place')p=parcel(data?.parcelId);else{const rec=state.placements.find(x=>x.placementId===data?.placementId);p=rec&&parcel(rec.parcelId);}return p?.kind==='house';}\n",
    'helpers')

legacy_re=r"    if\(op==='ensureLegacyParcel'\)\{.*?\n    \}\n    if\(op==='ensureWorldEditorParcel'\)"
legacy_new="""    if(op==='ensureLegacyParcel'){
      const hi=currentHouseInstance();
      if(hi){
        const pid=String(hi.parcelId||`parcel:house:${hi.resourceId}`),b=hi.config?.bounds||{x:0,y:0,w:768,h:544};
        if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:String(hi.ownerId||owner),kind:'house',houseId:String(hi.resourceId),bounds:{x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544},district:'instance',status:'active'};bump();}
        return clone(state.parcels[pid]);
      }
      const legacy=(typeof STATE!=='undefined'&&STATE?.plot)?STATE.plot:{x:2000,y:1500,w:400,h:300};
      const pid='parcel:legacy:104';
      if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:owner,kind:'player',bounds:{x:legacy.x,y:legacy.y,w:legacy.w,h:legacy.h},district:'central',status:'owned'};bump();}
      else if(state.parcels[pid].ownerId==='local_pioneer'&&owner!=='local_pioneer'){state.parcels[pid].ownerId=owner;bump();}
      return clone(state.parcels[pid]);
    }
    if(op==='ensureWorldEditorParcel')"""
s=replace_once(s,legacy_re,legacy_new,'legacy parcel',re.S)

s=replace_once(s,
    r"(    if\(op==='grantUnits'\)\{)",
    """    if(op==='ensureHouseParcel'){
      const houseId=String(data.houseId||''),b=data.bounds||{x:0,y:0,w:768,h:544};if(!houseId)throw new Error('HOUSE_ID_REQUIRED');const pid=`parcel:house:${houseId}`;
      if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:owner,kind:'house',houseId,bounds:{x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544},district:'instance',status:'active'};bump();}
      else{const row=state.parcels[pid];row.ownerId=owner;row.houseId=houseId;row.bounds={x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544};row.status='active';bump();}
      return clone(state.parcels[pid]);
    }
\1""",
    'ensure house')

s=replace_once(s,
    r"(    if\(op==='replaceLayout'\)\{)",
    """    if(op==='replaceHouseLayout'){
      const p=parcel(data.parcelId);if(!p||p.kind!=='house')throw new Error('HOUSE_PARCEL_ONLY');if(!data.authorityRestore&&p.ownerId!==owner)throw new Error('NOT_PARCEL_OWNER');const rows=Array.isArray(data.placements)?data.placements:[];
      const safe=[];for(const raw of rows){const t=C.get(raw.assetId);if(!t)continue;const q=((Math.floor(Number(raw.rotation)||0)%4)+4)%4,d=rotatedSize(t,q),x=snap(raw.x,t.snap||C.tileSize),y=snap(raw.y,t.snap||C.tileSize);if(!within(p.bounds,x,y,d.w,d.h))continue;safe.push({placementId:String(raw.placementId||id('placement')),parcelId:p.parcelId,ownerId:String(raw.ownerId||p.ownerId),assetId:t.id,x,y,rotation:q,layer:'property',createdAt:Number(raw.createdAt)||Date.now(),updatedAt:Number(raw.updatedAt)||Date.now()});}
      state.placements=state.placements.filter(x=>x.parcelId!==p.parcelId).concat(safe);bump();return{count:safe.length};
    }
\1""",
    'replace house')

s=replace_once(s,
    r"  async function request\(op,payload\)\{if\(remoteAdapter&&typeof remoteAdapter.request==='function'\)return remoteAdapter.request\(op,payload\|\|\{\}\);return localRequest\(op,payload\|\|\{\}\);\}",
    "  async function request(op,payload){const data=payload||{};if(isHouseMutation(op,data)&&window.KELO_HOUSE_AUTHORITY?.request)return window.KELO_HOUSE_AUTHORITY.request(op,data);if(remoteAdapter&&typeof remoteAdapter.request==='function')return remoteAdapter.request(op,data);return localRequest(op,data);}",
    'request route')

s=replace_once(s,
    r"    for\(const rec of state.placements\)\{const t=C.get\(rec.assetId\);if\(!t\?\.collision\)continue;",
    "    for(const rec of state.placements){if(!placementVisible(rec))continue;const t=C.get(rec.assetId);if(!t?.collision)continue;",
    'collider filter')
s=replace_once(s,
    r"  function drawPhase\(g,phase\)\{g.save\(\);g.imageSmoothingEnabled=false;for\(const rec of state.placements\)\{const t=C.get\(rec.assetId\);if\(t\)drawTemplate\(g,t,rec,phase\);\}g.restore\(\);\}",
    "  function drawPhase(g,phase){g.save();g.imageSmoothingEnabled=false;for(const rec of state.placements){if(!placementVisible(rec))continue;const t=C.get(rec.assetId);if(t)drawTemplate(g,t,rec,phase);}g.restore();}",
    'draw filter')
s=replace_once(s,
    r"  function bounds\(\)\{return state.placements.map\(p=>\(\{id:p.placementId,\.\.\.placementBounds\(p\)\}\)\).filter\(x=>x.w>0&&x.h>0\);\}",
    "  function bounds(){return state.placements.filter(placementVisible).map(p=>({id:p.placementId,...placementBounds(p)})).filter(x=>x.w>0&&x.h>0);}",
    'bounds filter')

s=replace_once(s,
    r"version:'property-system-v1\.0\.0',storageMode:'local-fallback-replaceable',request,installRemoteAdapter,ingestAuthoritySnapshot,snapshot,playerId,parcel,",
    "version:'property-system-v1.1.0',storageMode:'local-fallback-replaceable',request,authorityLocalRequest:localRequest,installRemoteAdapter,ingestAuthoritySnapshot,snapshot,playerId,parcel,",
    'public local authority')
s=replace_once(s,
    r"exportLayout,suppressLegacyFurniture,onChange\(fn\)",
    "exportLayout,suppressLegacyFurniture,refreshSceneColliders:syncColliders,onChange(fn)",
    'refresh colliders')
s=s.replace("window.KELO_PROPERTY_AUDIT={version:'property-system-v1.0.0'","window.KELO_PROPERTY_AUDIT={version:'property-system-v1.1.0'")
p.write_text(s)

# Integrate load order without touching the rest of boot.
idx=ROOT/'index.html'
h=idx.read_text()
old='''<script src="src/property/property-asset-catalog.js?v=1"></script>\n<script src="src/property/property-system.js?v=1"></script>\n<script src="src/ui/property-editor-enhancements.js?v=1"></script>\n<script src="src/ui/property-editor.js?v=1"></script>'''
new='''<script src="src/property/property-asset-catalog.js?v=1"></script>\n<script src="src/property/property-system.js?v=2"></script>\n<script src="src/instances/instance-system.js?v=1"></script>\n<script src="src/instances/instance-runtime-bridge.js?v=1"></script>\n<script src="src/instances/house-instance.js?v=1"></script>\n<script src="src/instances/property-house-bridge.js?v=1"></script>\n<script src="src/ui/property-editor-enhancements.js?v=1"></script>\n<script src="src/ui/property-editor.js?v=1"></script>\n<script src="src/ui/house-instance-ui.js?v=1"></script>'''
if old not in h:
    raise SystemExit('index load-order anchor missing')
h=h.replace(old,new,1)
idx.write_text(h)

memory=ROOT/'docs/INSTANCE_SYSTEM_MEMORY.md'
memory.write_text('''# Kelo World — Instance System Memory V1\n\n## Estado\nHouse Instance V1 es offline-first y online-ready. Una casa no es una coordenada del world: es un runtime lógico con `instanceId`, lifecycle, participantes, permisos y snapshot persistente.\n\n## Contratos estables\n- `KELO_INSTANCES`: manager genérico (`create/getOrCreate/join/leave/destroy/current`).\n- `KELO_SCENE_CONTEXT`: `world` o `instance` + tipo/resourceId.\n- `KELO_HOUSE_AUTHORITY.request(op,payload)`: autoridad reemplazable.\n- Persistencia House: adapter `load/save`; local usa `kelo_house_snapshots_v1`.\n- Property sigue siendo owner único de templates, owned units y placements. House NO crea otro sistema de muebles.\n\n## House snapshot\nSchema 1: `houseId`, `ownerId`, `revision`, `layoutRevision`, `instanceConfig`, `placements`, `permissions`, `updatedAt`. Al crear/recrear una instancia se rehidrata el parcel House desde ese snapshot.\n\n## Lifecycle\n`CREATING -> LOADING -> ACTIVE -> IDLE -> SHUTTING_DOWN -> DESTROYED`. Destruir runtime no borra snapshot. Reentrar crea runtime nuevo y restaura placements.\n\n## Permisos\nRoles: owner/editor/visitor/blocked. Owner edita; visitor entra pero no puede mutar placements.\n\n## Online futuro\nCambiar `LocalHouseAuthority`/persistencia local por adapters de servidor/DB. UI y Property continúan llamando los mismos contratos. El servidor validará ownership, unidades, bounds, permisos, revisiones y capacidad.\n\n## No hacer\n- No guardar economía nueva dentro de House.\n- No crear un segundo editor de muebles.\n- No hacer que UI escriba localStorage directamente.\n- No convertir casas en coordenadas permanentes del mapa principal.\n''')

for file,block in [
    (ROOT/'docs/CODE_INDEX.md','\n## INSTANCE SYSTEM V1\n- `src/instances/instance-system.js`: manager/lifecycle/contexto genérico.\n- `src/instances/instance-runtime-bridge.js`: transición world/house y bounds visuales.\n- `src/instances/house-instance.js`: autoridad, persistencia, snapshot y permisos House.\n- `src/instances/property-house-bridge.js`: contrato Property ↔ House.\n- `src/ui/house-instance-ui.js`: entrada/salida y acceso al mismo Property Editor.\n'),
    (ROOT/'ENGINE_MAP.md','\n## House Instance V1 (offline-first)\n`KELO_INSTANCES` separa conceptualmente world e instancias. House usa autoridad/persistencia reemplazables y reutiliza Property placements. En online, World y House workers podrán separarse sin cambiar UI/contratos.\n')]:
    txt=file.read_text()
    marker=block.splitlines()[1]
    if marker not in txt:
        file.write_text(txt.rstrip()+"\n"+block)

print('House Instance text integration installed')

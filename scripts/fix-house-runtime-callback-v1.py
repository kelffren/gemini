from pathlib import Path
p=Path('src/instances/house-instance.js')
s=p.read_text()
old="instance.onEnter=async()=>window.KELO_INSTANCE_RUNTIME?.enter?.(instance);instance.onExit=async()=>window.KELO_INSTANCE_RUNTIME?.leave?.();instance.onDestroy=async()=>{await persistRuntime(instance,false,false);};"
new="instance.onEnter=async(_participant,runtime)=>window.KELO_INSTANCE_RUNTIME?.enter?.(runtime);instance.onExit=async()=>window.KELO_INSTANCE_RUNTIME?.leave?.();instance.onDestroy=async(runtime,opts)=>{await window.KELO_INSTANCE_RUNTIME?.leave?.();if(opts?.reason!=='crash')await persistRuntime(runtime,false,false);};"
if old not in s:
    raise SystemExit('house callback anchor missing')
p.write_text(s.replace(old,new,1))
print('House runtime callbacks fixed')

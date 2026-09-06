from pathlib import Path
p=Path('src/property/property-system.js')
s=p.read_text()
needle='\x01'
if s.count(needle)!=2:
    raise SystemExit(f'expected 2 control anchors, got {s.count(needle)}')
s=s.replace(needle,"    if(op==='grantUnits'){",1)
s=s.replace(needle,"    if(op==='replaceLayout'){",1)
p.write_text(s)
print('Property installer control anchors repaired')

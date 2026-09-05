from pathlib import Path
p=Path('src/environment/tile-registry.js')
s=p.read_text()
s=s.replace("worldWidth:144, worldHeight:384, family:'commerce-architecture'","worldWidth:80, worldHeight:216, family:'commerce-architecture'")
s=s.replace("x:1920, y:1584, worldWidth:144, worldHeight:384, baseYOffset:384","x:1936, y:1736, worldWidth:80, worldHeight:216, baseYOffset:216")
s=s.replace("collision:Object.freeze({x:1932,y:1934,w:120,h:28})","collision:Object.freeze({x:1944,y:1932,w:64,h:20})")
s=s.replace("x:2624, y:1584, worldWidth:144, worldHeight:384, baseYOffset:384","x:2692, y:1736, worldWidth:80, worldHeight:216, baseYOffset:216")
s=s.replace("collision:Object.freeze({x:2636,y:1934,w:120,h:28})","collision:Object.freeze({x:2700,y:1932,w:64,h:20})")
s=s.replace("version:'1.12.0'","version:'1.12.1'",1)
assert s.count("worldWidth:80, worldHeight:216, family:'commerce-architecture'")==2
assert "id:'commerce-arcade-west-south', asset:'commerceArcadeWest', x:1936, y:1736, worldWidth:80, worldHeight:216" in s
assert "id:'commerce-arcade-east-south', asset:'commerceArcadeEast', x:2692, y:1736, worldWidth:80, worldHeight:216" in s
p.write_text(s)
print('Commerce arcades tuned to 80x216 at south edges; Registry 1.12.1')

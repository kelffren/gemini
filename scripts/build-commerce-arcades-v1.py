import json, pathlib, re
import cairosvg
from PIL import Image

root=pathlib.Path(__file__).resolve().parents[1]
svg=root/'assets/commerce-arcade-v1.svg'
west=root/'assets/commerce-arcade-west-v1.png'
east=root/'assets/commerce-arcade-east-v1.png'
cairosvg.svg2png(url=str(svg),write_to=str(west),output_width=160,output_height=432)
with Image.open(west) as im:
    im.convert('RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(east,optimize=True)
for p in (west,east):
    with Image.open(p) as im:
        assert im.size==(160,432) and im.mode=='RGBA'

reg_path=root/'src/environment/tile-registry.js'
reg=reg_path.read_text()
if "commerceArcadeWest:Object.freeze" not in reg:
    marker="    arenaWarWall:Object.freeze({\n"
    insert="""    commerceArcadeWest:Object.freeze({
      id:'commerce-arcade-west', src:'assets/commerce-arcade-west-v1.png?art=306', width:160, height:432,
      worldWidth:144, worldHeight:384, family:'commerce-architecture'
    }),
    commerceArcadeEast:Object.freeze({
      id:'commerce-arcade-east', src:'assets/commerce-arcade-east-v1.png?art=306', width:160, height:432,
      worldWidth:144, worldHeight:384, family:'commerce-architecture'
    }),
"""
    assert marker in reg
    reg=reg.replace(marker,insert+marker,1)
if "id:'commerce-arcade-west-south'" not in reg:
    marker="    arenaWarWall:Object.freeze({\n"
    start=reg.index("  const architecturePrefabs = Object.freeze({")
    pos=reg.index(marker,start)
    insert="""    commerceArcadeWest:Object.freeze({
      id:'commerce-arcade-west-south', asset:'commerceArcadeWest', x:1920, y:1584, worldWidth:144, worldHeight:384, baseYOffset:384,
      collision:Object.freeze({x:1932,y:1934,w:120,h:28}),
      occlusion:Object.freeze({sideInset:8,topInset:36,bottomPadding:4,clip:Object.freeze({xPadding:6,topPadding:18,bottomPadding:6})}),
      districts:Object.freeze(['commerce']), priority:24, ownership:'commerce-authored-arcade-v1', legacyVisualReplacement:true
    }),
    commerceArcadeEast:Object.freeze({
      id:'commerce-arcade-east-south', asset:'commerceArcadeEast', x:2624, y:1584, worldWidth:144, worldHeight:384, baseYOffset:384,
      collision:Object.freeze({x:2636,y:1934,w:120,h:28}),
      occlusion:Object.freeze({sideInset:8,topInset:36,bottomPadding:4,clip:Object.freeze({xPadding:6,topPadding:18,bottomPadding:6})}),
      districts:Object.freeze(['commerce']), priority:24, ownership:'commerce-authored-arcade-v1', legacyVisualReplacement:true
    }),
"""
    reg=reg[:pos]+insert+reg[pos:]
reg=re.sub(r"version:'1\.11\.1'", "version:'1.12.0'", reg, count=1)
reg_path.write_text(reg)

manifest_path=root/'src/environment/art-asset-manifest.json'
manifest=json.loads(manifest_path.read_text())
known={a['id'] for a in manifest['assets']}
base={'family':'commerce-architecture','version':'1.0.0','kind':'architecture-prefab','width':160,'height':432,'requireAlpha':True,'sampling':'nearest','padding':0,'spacing':0,'frames':{'mode':'single','count':1},'anchor':{'mode':'registry-instance'},'visualBounds':{'mode':'asset'},'footprint':{'mode':'registry-instance'},'collider':{'mode':'registry-instance'},'ownership':'tile-registry','layers':['props_back','props_front'],'priority':24,'occlusion':{'mode':'registry-instance'},'districtCompatibility':['commerce'],'cache':{'strategy':'query','key':'art','value':'306'},'fallback':{'mode':'none'}}
for aid,path in [('commerce-arcade-west-v1','assets/commerce-arcade-west-v1.png'),('commerce-arcade-east-v1','assets/commerce-arcade-east-v1.png')]:
    if aid not in known:
        manifest['assets'].append({'id':aid,'path':path,**base})
manifest_path.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
terrain=(root/'src/environment/terrain-contract.js').read_text()
assert "architectureFamilies:['commerceArchitecture']" in terrain
print('BUILT Commerce arcade west/east PNG family')

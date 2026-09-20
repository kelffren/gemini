import assert from 'node:assert/strict';
import {detectSceneFormat,normalizeSceneDocument} from '../src/creators/importers/scene-importer.mjs';

const asset={id:'scene-1',externalId:'village',name:'Village'};
{
  const raw={prefabDefinition:{label:'Plaza',bounds:{w:200,h:100},children:[{prefabId:'tree',dx:10,dy:20,bounds:{w:32,h:48}}]}};
  assert.equal(detectSceneFormat(raw),'kelo');
  const out=normalizeSceneDocument(raw,asset);
  assert.equal(out.prefabDefinition.children.length,1);
  assert.equal(out.prefabDefinition.category,'Scenes');
}
{
  const raw={type:'map',name:'Tiled Village',width:2,height:1,tilewidth:32,tileheight:32,
    tilesets:[{firstgid:1,tiles:[{id:0,properties:[{name:'keloPrefabId',value:'grass'}]},{id:1,properties:[{name:'keloPrefabId',value:'road'}]}]}],
    layers:[{type:'tilelayer',name:'Ground',width:2,data:[1,2]},{type:'objectgroup',name:'Props',objects:[{id:7,x:48,y:8,width:32,height:32,properties:[{name:'prefabId',value:'tree'}]}]}]};
  assert.equal(detectSceneFormat(raw),'tiled');
  const out=normalizeSceneDocument(raw,asset);
  assert.equal(out.prefabDefinition.children.length,3);
  assert.equal(out.importReport.format,'tiled-json');
  assert.equal(out.importReport.warnings.length,0);
}
{
  const raw={defs:{},levels:[{identifier:'LDtk Town',pxWid:256,pxHei:256,layerInstances:[{__identifier:'Objects',entityInstances:[{__identifier:'house',iid:'a',px:[64,96],width:64,height:64,fieldInstances:[]}]}]}]};
  assert.equal(detectSceneFormat(raw),'ldtk');
  const out=normalizeSceneDocument(raw,asset);
  assert.equal(out.prefabDefinition.children[0].prefabId,'house');
}
console.log('scene-importer tests: ok');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioSelectAllController } from '../src/studio/input/studio-select-all-controller.mjs';

const source=fs.readFileSync(new URL('../src/studio/input/studio-select-all-controller.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/kernel\.execute\(/,'select-all must not bypass CommandBus');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'select-all must remain authority isolated');

function harness({entities=[{id:'a'},{id:'b'}],shell=true}={}){
  const listeners=new Map();
  const selection=[];
  const document={
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
    getElementById(id){return shell&&id==='kelo-studio-live'?{}:null;}
  };
  const kernel={document:{entities},selection:{set(ids){selection.splice(0,selection.length,...ids);}}};
  const root={document};
  const controller=createStudioSelectAllController({root,kernel});
  const dispatch=(overrides={})=>{
    let prevented=false;
    const event={key:'a',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,target:{closest:()=>null},preventDefault(){prevented=true;},...overrides};
    listeners.get('keydown')?.(event);
    return {prevented,selection:[...selection]};
  };
  return {controller,dispatch,listeners,selection};
}

{
  const h=harness({entities:[{id:'a'},{id:'b'},{id:'a'},{id:null},{id:''}]});
  const result=h.dispatch();
  assert.deepEqual(result.selection,['a','b'],'Ctrl+A selects unique valid entity ids in document order');
  assert.equal(result.prevented,true,'handled shortcut prevents browser select-all');
}
{
  const h=harness();
  assert.deepEqual(h.dispatch({ctrlKey:false,metaKey:true}).selection,['a','b'],'Cmd+A selects all on macOS');
}
{
  const h=harness();
  assert.deepEqual(h.dispatch({target:{closest:()=>({tagName:'INPUT'})}}).selection,[],'editable targets keep native select-all');
  assert.deepEqual(h.dispatch({repeat:true}).selection,[],'autorepeat is ignored');
  assert.deepEqual(h.dispatch({shiftKey:true}).selection,[],'modified shortcut is ignored');
}
{
  const h=harness({entities:[]});
  const result=h.dispatch();
  assert.deepEqual(result.selection,[],'empty worlds remain unchanged');
  assert.equal(result.prevented,false,'empty worlds keep browser behavior');
}
{
  const h=harness({shell:false});
  assert.deepEqual(h.dispatch().selection,[],'shortcut stays scoped to mounted Studio shell');
}
{
  const h=harness();
  h.controller.destroy();
  assert.equal(h.listeners.has('keydown'),false,'destroy removes keyboard listener');
  assert.deepEqual(h.dispatch().selection,[],'destroyed controller is inert');
}

console.log(JSON.stringify({ok:true,shortcut:'Ctrl/Cmd+A',selectionOnly:true,authorityIsolated:true},null,2));

import assert from 'node:assert/strict';import {createPvePresenter} from '../src/pve/pve-presentation.mjs';
const ops=[];const ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){ops.push('fill')},arc(){},stroke(){ops.push('stroke')},fillRect(){ops.push('bar')},drawImage(){ops.push('sprite')},set globalAlpha(v){},set lineWidth(v){},set imageSmoothingEnabled(v){}};
const spriteBank={beast:{image:{naturalWidth:256,naturalHeight:32},frameSize:32,frames:8,asset:{id:'wolf'}},bandit:{image:{naturalWidth:16,naturalHeight:16},frameSize:16,frames:1,asset:{id:'bandit'}}};
const p=createPvePresenter({ctx,camera:{x:0,y:0},spriteBank,now:()=>220});assert.equal(p.draw({family:'beast',x:10,y:20,hp:50,maxHp:100,state:'chase'}),true);assert.ok(ops.includes('sprite'));assert.ok(ops.filter(x=>x==='bar').length>=2);
p.draw({family:'bandit',x:20,y:20,hp:100,maxHp:100,state:'telegraph'});assert.ok(ops.includes('stroke'));console.log('pve-presentation-audit: ok');

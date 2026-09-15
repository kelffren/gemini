/* KELO-INDEX area: QA / CHAT; owner: chat bridge regression; keys: MUTATION LOOP LOCK CLOSE; online: N/A */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const queued=[],claims=new Set();let callback,domOpen=false,apiOpen=false,sequence=0;
const mutate=value=>{domOpen=value;queued.push(callback);};
const drawer={classList:{contains:()=>domOpen}};
const context={console,document:{readyState:'complete',getElementById:()=>drawer},addEventListener(){},
 MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}},
 KeloInputLocks:{acquire(){const id=++sequence;claims.add(id);return id;},release(id){claims.delete(id);}},
 KELO_LUXE:{closeChat(){mutate(false);}},
 KeloChatUI:{isOpen:()=>apiOpen,open(){apiOpen=true;mutate(true);},close(){apiOpen=false;mutate(false);}}
};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('src/ui/kelo-chat-integration-bridge.js','utf8'),context);
function flush(){for(let i=0;queued.length&&i<20;i++){const next=queued.shift();next?.();}assert.equal(queued.length,0,'chat close must settle instead of starving the game with MutationObserver callbacks');}
flush();
mutate(true);flush();assert.equal(apiOpen,true);assert.equal(claims.size,1);
mutate(false);flush();assert.equal(apiOpen,false);assert.equal(claims.size,0);
mutate(false);flush();assert.equal(claims.size,0);
console.log('PASS: chat open/close settles and releases its input lock without a mutation loop');

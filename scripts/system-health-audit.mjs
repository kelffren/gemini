#!/usr/bin/env node
import { promises as fs } from 'node:fs';
const db=JSON.parse(await fs.readFile('docs/context/SYSTEM_HEALTH.json','utf8'));
let bad=0;
for(const [id,s] of Object.entries(db.systems||{})){
 if(!['unknown','healthy','degraded','broken'].includes(s.status)){console.error(id,'invalid status',s.status);bad++}
 if(s.lastKnownGood && (!/^[0-9a-f]{7,40}$/i.test(s.lastKnownGood.sha||'') || !s.lastKnownGood.evidence)){
   console.error(id,'lastKnownGood requires SHA + evidence');bad++;
 }
 for(const x of s.knownBad||[]) if(typeof x==='object' && (!x.sha || !x.evidence)){console.error(id,'knownBad object requires SHA + evidence');bad++}
}
if(bad)process.exit(1);
console.log('System health registry OK:',Object.keys(db.systems||{}).length,'systems.');

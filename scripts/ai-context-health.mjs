#!/usr/bin/env node
/**
 * Query explicit system-health memory. This file never guesses a known-good SHA.
 * Health evidence must be written after real QA/bisect confirmation.
 */
import { promises as fs } from 'node:fs';
const q=process.argv.slice(2).join(' ').trim().toLowerCase();
if(!q){console.error('Usage: npm run context:health -- "editor"');process.exit(1)}
const db=JSON.parse(await fs.readFile('docs/context/SYSTEM_HEALTH.json','utf8'));
const scored=Object.entries(db.systems).map(([id,s])=>{
 const hay=[id,...(s.aliases||[]),...(s.ownerHints||[])].join(' ').toLowerCase();
 const terms=q.split(/[^a-z0-9_-]+/).filter(Boolean);
 return {id,s,score:terms.reduce((n,t)=>n+(hay.includes(t)?1:0),0)};
}).filter(x=>x.score).sort((a,b)=>b.score-a.score);
if(!scored.length){console.log('No explicit health record. Treat state as unknown.');process.exit(0)}
for(const {id,s} of scored.slice(0,4)){
 console.log('\nSYSTEM:',id);
 console.log('status:',s.status||'unknown');
 console.log('last-known-good:',s.lastKnownGood?.sha||'UNCONFIRMED');
 if(s.lastKnownGood?.evidence) console.log('evidence:',s.lastKnownGood.evidence);
 if(s.knownBad?.length) console.log('known-bad:',s.knownBad.map(x=>x.sha||x).join(', '));
 if(s.openRegressions?.length) console.log('open-regressions:',s.openRegressions.join(', '));
 if(s.qa?.length) console.log('required-QA:',s.qa.join(', '));
 if(s.notes) console.log('notes:',s.notes);
}

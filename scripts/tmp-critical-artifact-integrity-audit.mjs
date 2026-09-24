import fs from 'node:fs';
const checks=[
  ['src/creators/ui/creator-hub.mjs', text=>text.length>15000 && /export async function openCreatorHub/.test(text) && /worldEditorReady/.test(text)],
  ['asset-vault.html', text=>text.length>10000 && /Biblioteca Universal/.test(text) && /provider-filters/.test(text)]
];
let failed=0;
for(const [file,ok] of checks){
  const text=fs.readFileSync(file,'utf8');
  const pass=ok(text)&&!/^(SEE_LOCAL|PLACEHOLDER)\s*$/.test(text.trim());
  console.log(pass?'PASS':'FAIL',file,'bytes='+text.length);
  if(!pass)failed++;
}
if(failed)process.exit(1);

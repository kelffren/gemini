import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPixeloramaHandoff,normalizePixeloramaUrl} from '../src/creators/ui/pixelorama-pro-bridge.mjs';

test('Pixelorama bridge filters unsafe URLs and adds safe handoff metadata',()=>{
  assert.equal(normalizePixeloramaUrl('javascript:alert(1)'),null);
  const url=buildPixeloramaHandoff('https://pixelorama.example/editor',{assetName:'gold helm',templateId:'helmet',returnUrl:'https://game.example/creators'});
  assert.ok(url);
  const parsed=new URL(url);
  assert.equal(parsed.searchParams.get('keloAsset'),'gold helm');
  assert.equal(parsed.searchParams.get('keloTemplate'),'helmet');
  assert.equal(parsed.searchParams.get('keloReturn'),'https://game.example/creators');
});

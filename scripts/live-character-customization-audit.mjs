import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const outDir = path.resolve('artifacts/character-customization-live');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message || e)));

async function waitPreviewItem(id) {
  await page.waitForFunction(itemId => !!document.querySelector(`[data-kc-preview-item="${itemId}"]`), id, { timeout: 10000 });
}

try {
  await page.goto(url + '?character-customizer-audit=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.KeloCharacterCustomization && !!window.KeloCharacterCustomizer &&
    window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT?.ready === true &&
    window.KELO_CHARACTER_DEMO_KIT_AUDIT?.ready === true &&
    window.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT?.ready === true,
  null, { timeout: 30000 });

  const baseline = await page.evaluate(async () => {
    const A = window.KeloCharacterCustomization;
    const kit = window.KELO_CHARACTER_DEMO_KIT_AUDIT;
    const before = A.getState();
    if (A.slots.length !== 21) throw new Error('EXPECTED_21_SLOTS_' + A.slots.length);
    if (before.mode !== 'modular') throw new Error('MODULAR_NOT_DEFAULT');
    if (!kit || kit.pieceIds.length !== 7) throw new Error('EXPECTED_7_DEMO_PIECES');

    const assetResults = [];
    for (const src of kit.assets) {
      const response = await fetch(src + '&audit=' + Date.now(), { cache:'no-store' });
      assetResults.push({ src, status:response.status, ok:response.ok });
      if (!response.ok) throw new Error('DEMO_ASSET_HTTP_' + response.status + '_' + src);
    }

    A.reset();
    const bodyBefore = A.getState().slots.body;
    const outfit = A.applyOutfit('outfit_kelo_vanguard');
    const helmet = A.select('head', 'head_vanguard_crown');
    const sword = A.select('weaponMain', 'weapon_solar_saber');
    const equipped = A.getState();
    if (!outfit.ok || !helmet.ok || !sword.ok) throw new Error('DEMO_EQUIP_FAILED');
    if (equipped.slots.body !== bodyBefore) throw new Error('BODY_CHANGED_WHEN_EQUIPPING_DEMO_KIT');
    if (equipped.slots.torso !== 'torso_kelo_vanguard' || equipped.slots.legs !== 'legs_kelo_vanguard' || equipped.slots.feet !== 'feet_kelo_vanguard') throw new Error('OUTFIT_NOT_MODULAR');
    if (equipped.slots.head !== 'head_vanguard_crown' || equipped.slots.weaponMain !== 'weapon_solar_saber') throw new Error('FIRST_LOADOUT_FAILED');
    const net = A.networkSnapshot();
    if (net.schema !== 'kelo-character-visual-v1') throw new Error('NETWORK_SCHEMA_MISSING');
    if (net.slots.head !== 'head_vanguard_crown' || net.slots.weaponMain !== 'weapon_solar_saber') throw new Error('NETWORK_VISUAL_IDS_MISSING');

    const actor = { id:'__character_kit_melee_audit', x:120, y:120, radius:20, _face:'down' };
    const clipId = window.KELO_MELEE_VISUAL_MANIFEST?.attackClips?.down;
    if (!clipId || !window.KeloAnimation) throw new Error('MELEE_ANIMATION_UNAVAILABLE');
    const animationId = window.KeloAnimation.play(actor, clipId, { force:true });
    window.KeloAnimation.update(0.15);
    const transform = window.KeloAnimation.sampleTransform(actor);
    if (!animationId || !transform || transform.clipId !== clipId) throw new Error('MELEE_SHARED_TRANSFORM_FAILED');

    return {
      slots:A.slots.slice(),
      bodyBefore,
      networkSchema:net.schema,
      assetResults,
      firstLoadout:{ outfit:equipped.outfitId, head:equipped.slots.head, weaponMain:equipped.slots.weaponMain },
      meleeTransform:{ clipId:transform.clipId, rotation:transform.rotation, offsetX:transform.offsetX, offsetY:transform.offsetY },
      audit:window.KELO_CHARACTER_CUSTOMIZATION_AUDIT,
      kitAudit:kit
    };
  });

  await page.evaluate(() => window.KeloCharacterCustomizer.open());
  const modal = page.locator('#kelo-character-customizer');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  const tabs = modal.locator('[data-kc-tab]');
  if (await tabs.count() !== 4) throw new Error('EXPECTED_4_TABS');
  for (const tab of ['appearance','outfits','equipment','cosmetics']) {
    await modal.locator(`[data-kc-tab="${tab}"]`).click();
    await page.waitForTimeout(80);
  }

  await waitPreviewItem('torso_kelo_vanguard');
  await waitPreviewItem('legs_kelo_vanguard');
  await waitPreviewItem('feet_kelo_vanguard');
  await waitPreviewItem('head_vanguard_crown');
  await waitPreviewItem('weapon_solar_saber');
  const firstLayerCount = await modal.locator('.kc-kit-layer').count();
  if (firstLayerCount !== 5) throw new Error('EXPECTED_5_PREVIEW_LAYERS_FIRST_' + firstLayerCount);
  await page.screenshot({ path:path.join(outDir, 'character-customizer-vanguard-crown-solar.png'), fullPage:true });

  const swap = await page.evaluate(() => {
    const A = window.KeloCharacterCustomization;
    const bodyBefore = A.getState().slots.body;
    const h = A.select('head', 'head_night_visor');
    const w = A.select('weaponMain', 'weapon_onyx_katana');
    const after = A.getState();
    if (!h.ok || !w.ok) throw new Error('SECOND_LOADOUT_FAILED');
    if (after.slots.body !== bodyBefore) throw new Error('BODY_CHANGED_ON_SWAP');
    return { bodyBefore, bodyAfter:after.slots.body, head:after.slots.head, weaponMain:after.slots.weaponMain, revision:after.revision };
  });
  await waitPreviewItem('head_night_visor');
  await waitPreviewItem('weapon_onyx_katana');
  const secondLayerCount = await modal.locator('.kc-kit-layer').count();
  if (secondLayerCount !== 5) throw new Error('EXPECTED_5_PREVIEW_LAYERS_SECOND_' + secondLayerCount);
  await page.screenshot({ path:path.join(outDir, 'character-customizer-vanguard-night-onyx.png'), fullPage:true });

  await modal.locator('[data-kc-tab="equipment"]').click();
  await page.waitForTimeout(100);
  const labels = await modal.locator('.kc-slot strong').allTextContents();
  if (!labels.some(x => x.includes('Gorro') || x.includes('casco'))) throw new Error('HEAD_SLOT_NOT_VISIBLE');
  if (!labels.some(x => x.includes('Arma principal'))) throw new Error('WEAPON_SLOT_NOT_VISIBLE');
  if (pageErrors.length) throw new Error('PAGE_ERRORS_' + pageErrors.join(' | '));

  const report = {
    ok:true,
    url,
    viewport:{ width:390, height:844 },
    baseline,
    swap,
    previewLayers:{ first:firstLayerCount, second:secondLayerCount },
    tabs:['appearance','outfits','equipment','cosmetics'],
    equipmentLabels:labels,
    pageErrors
  };
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('CHARACTER_CUSTOMIZATION_LIVE_OK', JSON.stringify({ pieces:7, previewLayers:secondLayerCount, assets:baseline.assetResults.length, errors:pageErrors.length }));
} catch (error) {
  await page.screenshot({ path:path.join(outDir, 'character-customizer-failure.png'), fullPage:true }).catch(() => {});
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ ok:false, url, error:String(error?.stack || error), pageErrors }, null, 2));
  throw error;
} finally {
  await browser.close();
}

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

try {
  await page.goto(url + '?character-customizer-audit=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.KeloCharacterCustomization && !!window.KeloCharacterCustomizer && window.KELO_CHARACTER_CUSTOMIZER_UI_AUDIT?.ready === true, null, { timeout: 30000 });

  const baseline = await page.evaluate(() => {
    const A = window.KeloCharacterCustomization;
    const before = A.getState();
    if (A.slots.length !== 21) throw new Error('EXPECTED_21_SLOTS_' + A.slots.length);
    if (before.mode !== 'modular') throw new Error('MODULAR_NOT_DEFAULT');
    A.registerItem({ id: '__audit_helmet', slot: 'head', name: 'Audit Helmet' });
    A.registerItem({ id: '__audit_sword', slot: 'weaponMain', name: 'Audit Sword' });
    const bodyBefore = A.getState().slots.body;
    const h = A.select('head', '__audit_helmet');
    const s = A.select('weaponMain', '__audit_sword');
    const after = A.getState();
    if (!h.ok || !s.ok) throw new Error('AUDIT_EQUIP_FAILED');
    if (after.slots.body !== bodyBefore) throw new Error('BODY_CHANGED_WHEN_EQUIPPING');
    if (after.slots.head !== '__audit_helmet' || after.slots.weaponMain !== '__audit_sword') throw new Error('INDEPENDENT_SLOTS_FAILED');
    const net = A.networkSnapshot();
    if (net.schema !== 'kelo-character-visual-v1') throw new Error('NETWORK_SCHEMA_MISSING');
    A.reset();
    return { slots:A.slots.slice(), bodyBefore, networkSchema:net.schema, audit:window.KELO_CHARACTER_CUSTOMIZATION_AUDIT };
  });

  await page.evaluate(() => window.KeloCharacterCustomizer.open());
  const modal = page.locator('#kelo-character-customizer');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  const tabs = modal.locator('[data-kc-tab]');
  if (await tabs.count() !== 4) throw new Error('EXPECTED_4_TABS');
  for (const tab of ['appearance','outfits','equipment','cosmetics']) {
    await modal.locator(`[data-kc-tab="${tab}"]`).click();
    await page.waitForTimeout(100);
  }
  await modal.locator('[data-kc-tab="equipment"]').click();
  await page.waitForTimeout(150);
  const labels = await modal.locator('.kc-slot strong').allTextContents();
  if (!labels.some(x => x.includes('Gorro') || x.includes('casco'))) throw new Error('HEAD_SLOT_NOT_VISIBLE');
  if (!labels.some(x => x.includes('Arma principal'))) throw new Error('WEAPON_SLOT_NOT_VISIBLE');

  await page.screenshot({ path: path.join(outDir, 'character-customizer-mobile.png'), fullPage: true });
  const report = {
    ok: true,
    url,
    viewport: { width:390, height:844 },
    baseline,
    tabs: ['appearance','outfits','equipment','cosmetics'],
    equipmentLabels: labels,
    pageErrors
  };
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('CHARACTER_CUSTOMIZATION_LIVE_OK', JSON.stringify({ slots:baseline.slots.length, tabs:4, errors:pageErrors.length }));
} catch (error) {
  await page.screenshot({ path: path.join(outDir, 'character-customizer-failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ ok:false, url, error:String(error?.stack || error), pageErrors }, null, 2));
  throw error;
} finally {
  await browser.close();
}

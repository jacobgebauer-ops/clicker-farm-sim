// The "definition of done" flows: mini games with touch, season change, prestige, save codes.
import { test, expect, type Page } from '@playwright/test';
import { startFresh, debug, dismissDialogs } from './helpers';

type Farm = { store: { state: Record<string, unknown> & { buildings: Record<string, { stage: number }>; farmYear: number; heirloomSeeds: number; coins: number }; act: (fn: (s: unknown, n: number) => unknown) => unknown }; G: Record<string, (...a: unknown[]) => unknown> };
const farm = (page: Page) => page.evaluate(() => (window as unknown as { __farm: Farm }).__farm.store.state);

test('all three mini games launch, take touch input, and pay out', async ({ page }) => {
  test.setTimeout(240_000);
  await startFresh(page);
  await page.getByTestId('tutorial-skip').click();
  await debug(page, 'dbg-restore');
  await dismissDialogs(page);
  for (const [building, game] of [['coop', 'egg_catch'], ['barn', 'milk_rhythm'], ['greenhouse', 'weed_pull']]) {
    await page.evaluate((b) => (window as unknown as { __farm: { nav: { openSheet: (s: unknown) => void } } }).__farm.nav.openSheet({ kind: 'building', id: b }), building);
    await page.getByTestId(`play-${game}`).click();
    await page.waitForTimeout(3200); // countdown
    const canvas = page.locator('#game canvas');
    const box = (await canvas.boundingBox())!;
    for (let i = 0; i < 25; i++) {
      await page.touchscreen.tap(box.x + box.width * (0.2 + (i % 3) * 0.3), box.y + box.height * (0.3 + (i % 5) * 0.1));
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate(() => (window as unknown as { __farm: { store: { inMinigame: boolean } } }).__farm.store.inMinigame)).toBe(true);
    // rounds last 40 seconds
    await page.waitForTimeout(39_000);
    await expect(page.getByTestId('minigame-result')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('minigame-ok').click();
  }
  const s = await farm(page);
  expect((s.stats as Record<string, number>).minigame).toBe(3);
});

test('season changes with debug time travel', async ({ page }) => {
  await startFresh(page);
  await page.getByTestId('tutorial-skip').click();
  const first = (await page.locator('.season-name').innerText()).trim();
  let next = first;
  // before launch (October 5, 2026) the first rollover is still Fall, so allow two jumps
  for (let i = 0; i < 2 && next === first; i++) {
    await debug(page, 'dbg-monday');
    await page.getByTestId('away-ok').click();
    await page.getByTestId('rollover-ok').click();
    await dismissDialogs(page);
    next = (await page.locator('.season-name').innerText()).trim();
  }
  expect(next).not.toBe(first);
});

test('prestige works end to end in debug', async ({ page }) => {
  await startFresh(page);
  await page.getByTestId('tutorial-skip').click();
  await debug(page, 'dbg-prestige-coins');
  await page.getByTestId('tab-menu').click();
  await page.getByTestId('menu-heirloom').click();
  await page.getByTestId('start-heirloom').click();
  await page.getByTestId('prestige-no').click(); // "Not yet" is always there
  await page.getByTestId('start-heirloom').click();
  await page.getByTestId('prestige-yes').click();
  const s = await farm(page);
  expect(s.farmYear).toBe(2);
  expect(s.heirloomSeeds).toBeGreaterThan(0);
});

test('save code export and import round trip', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await startFresh(page);
  await page.getByTestId('tutorial-skip').click();
  await debug(page, 'dbg-coins');
  const coins = (await farm(page)).coins;
  await page.getByTestId('tab-menu').click();
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('export-save').click();
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith('SH1.')).toBe(true);
  await debug(page, 'dbg-coins');
  expect((await farm(page)).coins).toBe(coins + 1000);
  await page.getByTestId('import-code').fill(code);
  await page.getByTestId('import-save').click();
  expect((await farm(page)).coins).toBe(coins);
});

test('boots offline after the first load (service worker precache)', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // give workbox a moment to finish precaching
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.includes('precache')), null, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#game canvas')).toBeVisible();
  await context.setOffline(false);
});

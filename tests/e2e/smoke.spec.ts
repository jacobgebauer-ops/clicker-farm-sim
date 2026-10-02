// Mobile smoke test at 412x915: new game, skip tutorial, plant, harvest, sell, save, reload, persist.
import { test, expect } from '@playwright/test';
import { startFresh, coins, debug, dismissDialogs } from './helpers';

test('first loop on a phone-sized screen persists across reload', async ({ page }) => {
  await startFresh(page);
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('tutorial')).toHaveCount(0);

  // clear a free garden plot and plant it
  await page.getByTestId('open-fields').click();
  await page.getByTestId('plot-row-0').click();
  await page.getByTestId('clear-plot').click();
  await page.getByTestId('open-fields').click();
  await page.getByTestId('plot-row-0').click();
  await page.locator('[data-testid^="seed-"]:not([disabled])').first().click();
  await expect(page.getByTestId('plot-sheet')).toHaveCount(0);

  // let it grow (debug time skip), then harvest everything
  await debug(page, 'dbg-finish');
  await dismissDialogs(page);
  await page.getByTestId('collect-all').click();

  // sell the harvest at the farm stand
  const before = await coins(page);
  await page.getByTestId('tab-shops').click();
  await page.getByTestId('subtab-stand').click();
  await page.locator('[data-testid^="stand-sellall-"]').first().click();
  await expect.poll(() => coins(page)).not.toBe(before);
  const after = await coins(page);

  // save and reload: everything is still there
  await page.waitForTimeout(1800);
  await page.reload();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 20_000 });
  await dismissDialogs(page);
  await expect.poll(() => coins(page)).toBe(after);
  const plots = await page.evaluate(() => (window as unknown as { __farm: { store: { state: { plots: { cleared: boolean }[]; stats: Record<string, number> } } } }).__farm.store.state);
  expect(plots.plots.filter((p) => p.cleared).length).toBeGreaterThanOrEqual(1);
  expect(plots.stats.harvest).toBeGreaterThanOrEqual(1);
});

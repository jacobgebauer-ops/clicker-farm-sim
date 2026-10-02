import { expect, type Page } from '@playwright/test';

export async function startFresh(page: Page) {
  await page.goto('/?debug=1');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('keyval-store');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('dedication-ok').click();
}

export async function dismissDialogs(page: Page) {
  for (const id of ['dedication-ok', 'away-ok', 'rollover-ok', 'minigame-ok']) {
    const b = page.getByTestId(id);
    if (await b.count()) await b.click();
  }
}

export async function coins(page: Page): Promise<string> {
  return (await page.getByTestId('coins').innerText()).trim();
}

export async function debug(page: Page, id: string) {
  await page.getByTestId('debug-open').click();
  await page.getByTestId(id).click();
  await page.locator('.debug .close').click();
}

import { test } from '@playwright/test';

test('screenshot with side panel open', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2500);
  // Click center of map to open a polygon's side panel
  await page.locator('canvas').click({ position: { x: 700, y: 400 } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/sidepanel.png' });
});

import { test } from '@playwright/test';

test('screenshot loaded app', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/app-loaded.png' });
});

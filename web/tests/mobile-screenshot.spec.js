import { test, expect } from '@playwright/test';

test('mobile: panel collapsed by default, toggle visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/mobile-collapsed.png' });

  // Toggle button should be visible on mobile
  await expect(page.locator('.panel-toggle')).toBeVisible();
  // Legend should be hidden by default on mobile
  await expect(page.locator('.legend')).not.toBeVisible();

  // Expand and screenshot
  await page.locator('.panel-toggle').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/mobile-expanded.png' });
  await expect(page.locator('.legend')).toBeVisible();
});

test('desktop: toggle hidden, legend always visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  await expect(page.locator('.panel-toggle')).not.toBeVisible();
  await expect(page.locator('.legend')).toBeVisible();
});

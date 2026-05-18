import { test, expect } from '@playwright/test';

test('logo image loads (not broken)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const img = page.locator('.logo-img');
  await expect(img).toBeVisible();

  const naturalWidth = await img.evaluate((el) => el.naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);
});

test('logo is to the left of the controls panel', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const logoBox = await page.locator('.logo-float').boundingBox();
  const controlsBox = await page.locator('.controls').boundingBox();

  expect(logoBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();

  // Logo left edge should align with controls left edge (within a few px)
  expect(logoBox.x).toBeLessThan(controlsBox.x + 20);
});

test('logo bottom is at or above controls top', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const logoBox = await page.locator('.logo-float').boundingBox();
  const controlsBox = await page.locator('.controls').boundingBox();

  expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(controlsBox.y + 2);
});

test('logo stays above controls on narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 700 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const logoBox = await page.locator('.logo-float').boundingBox();
  const controlsBox = await page.locator('.controls').boundingBox();

  expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(controlsBox.y + 2);
});

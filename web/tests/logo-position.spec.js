import { test, expect } from '@playwright/test';

test('logo image loads (not broken)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const img = page.locator('.logo-img');
  await expect(img).toBeVisible();

  const naturalWidth = await img.evaluate((el) => el.naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);
});

test('logo is inside the top-left brand panel', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const brandBox = await page.locator('.app-brand').boundingBox();
  const logoBox  = await page.locator('.logo-img').boundingBox();

  expect(brandBox).not.toBeNull();
  expect(logoBox).not.toBeNull();

  // Logo should be within the brand panel
  expect(logoBox.x).toBeGreaterThanOrEqual(brandBox.x - 1);
  expect(logoBox.y).toBeGreaterThanOrEqual(brandBox.y - 1);
});

test('top panel is in the top-left corner', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const panelBox = await page.locator('.top-panel').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox.x).toBeLessThan(50);
  expect(panelBox.y).toBeLessThan(50);
});

test('slider bar spans full width at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });

  const sliderBox = await page.locator('.slider-bar').boundingBox();
  expect(sliderBox).not.toBeNull();

  // Full-width: starts at left edge, ends at right edge
  expect(sliderBox.x).toBeLessThanOrEqual(2);
  expect(sliderBox.x + sliderBox.width).toBeGreaterThanOrEqual(1278);

  // Anchored to bottom
  const viewportHeight = 800;
  expect(sliderBox.y + sliderBox.height).toBeGreaterThanOrEqual(viewportHeight - 2);
});

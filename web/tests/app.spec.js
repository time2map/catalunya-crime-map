import { test, expect } from '@playwright/test';

test('page loads and map renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Catalunya/i);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
});

test('crime type selector is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pill-selector').first()).toBeVisible({ timeout: 10000 });
});

test('year slider is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="range"]')).toBeVisible({ timeout: 10000 });
});

test('legend is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.legend').first()).toBeVisible({ timeout: 10000 });
});

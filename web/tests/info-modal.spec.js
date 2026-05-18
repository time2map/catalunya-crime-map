import { test, expect } from '@playwright/test';

test('info button is visible in legend for safety index metric', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(800);

  await expect(page.locator('.legend .info-btn').first()).toBeVisible();
});

test('clicking info button opens centered modal with weights', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(800);

  await page.locator('.legend .info-btn').first().click();

  await expect(page.locator('.info-modal-backdrop')).toBeVisible();
  await expect(page.locator('.info-modal')).toContainText('Homicide');
  await expect(page.locator('.info-modal')).toContainText('×5');
  await page.screenshot({ path: '/tmp/info-modal.png' });
});

test('modal closes on backdrop click', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(800);

  await page.locator('.legend .info-btn').first().click();
  await expect(page.locator('.info-modal-backdrop')).toBeVisible();

  await page.locator('.info-modal-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.info-modal-backdrop')).not.toBeVisible();
});

test('modal closes on Escape key', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(800);

  await page.locator('.legend .info-btn').first().click();
  await expect(page.locator('.info-modal-backdrop')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.info-modal-backdrop')).not.toBeVisible();
});

test('info button is gray not red', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(800);

  const color = await page.locator('.legend .info-btn').first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).not.toContain('240, 105, 101');
});

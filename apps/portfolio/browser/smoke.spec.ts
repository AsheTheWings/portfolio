import { test, expect } from '@playwright/test';

/**
 * Smoke flows — keep this layer thin (see docs/testing.md). These assert the
 * app boots and core navigation works; detailed logic is covered by lower
 * layers. Add new specs only for genuinely browser-level concerns.
 */

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('body')).toBeVisible();
});

test('timeline app route is reachable', async ({ page }) => {
  const response = await page.goto('/apps/timeline');
  expect(response?.status()).toBeLessThan(400);
});

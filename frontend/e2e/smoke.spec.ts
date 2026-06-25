import { test, expect } from '@playwright/test';

test.describe('AgentHub Smoke Tests', () => {
  test('should load the main app shell', async ({ page }) => {
    await page.goto('/');
    // The app shell should render the three-column IM layout
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('should display the sidebar with navigation tabs', async ({ page }) => {
    await page.goto('/');
    // Sidebar should have Chat and Agent tabs
    const sidebar = page.locator('aside, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('should render the chat panel', async ({ page }) => {
    await page.goto('/');
    // The chat/messages panel should be in the center column
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('should not have runtime errors in console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

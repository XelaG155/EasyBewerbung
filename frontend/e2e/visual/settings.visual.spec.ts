import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

/**
 * Visual Regression Tests for Settings Page
 */
test.describe('Settings Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
    await page.evaluate(() => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
      }));
    });

    await mockAPIResponse(page, '**/users/me', {
      id: 1,
      email: 'test@example.com',
      full_name: 'Test User',
      preferred_language: 'en',
      mother_tongue: 'de',
      documentation_language: 'en',
      credits: 10,
    });

    await page.goto('/settings');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);
  });

  test('desktop view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('settings-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('settings-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('settings-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('form section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const form = page.locator('form').first();
    if (await form.count() > 0) {
      await expect(form).toHaveScreenshot('settings-form.png', {
        animations: 'disabled',
      });
    }
  });
});

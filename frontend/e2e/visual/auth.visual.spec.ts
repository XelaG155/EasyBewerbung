import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../utils/helpers';

/**
 * Visual Regression Tests for Authentication Pages
 */
test.describe('Login Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);
  });

  test('desktop view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('login-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('form focus state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.focus();

    await expect(page).toHaveScreenshot('login-focused.png', {
      animations: 'disabled',
    });
  });

  test('form with error', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Trigger validation error
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('invalid');
    await emailInput.blur();

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-error.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Register Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);
  });

  test('desktop view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('register-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('register-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('form partially filled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');

    const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Test User');
    }

    await expect(page).toHaveScreenshot('register-filled.png', {
      animations: 'disabled',
    });
  });
});

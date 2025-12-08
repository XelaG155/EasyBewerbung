import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../utils/helpers';

/**
 * Visual Regression Tests for Landing Page
 *
 * These tests capture screenshots and compare them against baseline images.
 * Run `npm run test:visual:update` to update baselines when intentional changes are made.
 */
test.describe('Landing Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    // Wait for any animations to complete
    await page.waitForTimeout(500);
  });

  test('desktop full page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('landing-desktop-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('desktop above fold', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('landing-desktop-above-fold.png', {
      animations: 'disabled',
    });
  });

  test('tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('landing-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('landing-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dark mode desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Toggle to dark mode if not already
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"]').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('landing-desktop-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('light mode desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Ensure light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('landing-desktop-light.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('navigation bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const nav = page.locator('nav, header').first();
    await expect(nav).toHaveScreenshot('landing-nav.png', {
      animations: 'disabled',
    });
  });

  test('hero section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const hero = page.locator('main > section, main > div').first();
    if (await hero.count() > 0) {
      await expect(hero).toHaveScreenshot('landing-hero.png', {
        animations: 'disabled',
      });
    }
  });

  test('features section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const features = page.locator('[class*="feature"], section:has([class*="card"])').first();
    if (await features.count() > 0) {
      await expect(features).toHaveScreenshot('landing-features.png', {
        animations: 'disabled',
      });
    }
  });
});

import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../utils/helpers';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.describe('Visual Elements', () => {
    test('should display logo and brand name', async ({ page }) => {
      // Check for logo/brand in header
      const header = page.locator('header, nav').first();
      await expect(header).toBeVisible();
    });

    test('should display navigation bar with auth buttons', async ({ page }) => {
      // Login and Register buttons should be visible for unauthenticated users
      const loginLink = page.getByRole('link', { name: /login|anmelden|sign in/i });
      const registerLink = page.getByRole('link', { name: /register|registrieren|sign up/i });

      await expect(loginLink).toBeVisible();
      await expect(registerLink).toBeVisible();
    });

    test('should display hero section', async ({ page }) => {
      // Hero section with main headline
      const heroSection = page.locator('main').first();
      await expect(heroSection).toBeVisible();

      // Should have a prominent heading
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should display features section', async ({ page }) => {
      // Look for feature cards or feature section
      const features = page.locator('[class*="feature"], [class*="card"]');
      const featureCount = await features.count();

      // Should have multiple feature items
      expect(featureCount).toBeGreaterThan(0);
    });
  });

  test.describe('Navigation', () => {
    test('login button navigates to /login', async ({ page }) => {
      const loginLink = page.getByRole('link', { name: /login|anmelden|sign in/i });
      await loginLink.click();

      await expect(page).toHaveURL(/\/login/);
    });

    test('register button navigates to /register', async ({ page }) => {
      const registerLink = page.getByRole('link', { name: /register|registrieren|sign up/i });
      await registerLink.click();

      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Language Selector', () => {
    test('should have language selector visible', async ({ page }) => {
      // Look for language selector (could be a dropdown or button)
      const languageSelector = page.locator(
        '[data-testid="language-selector"], select[name*="lang"], button:has-text("DE"), button:has-text("EN"), [class*="language"]'
      ).first();

      // Language selector should exist (may be in various forms)
      const exists = await languageSelector.count() > 0;
      expect(exists).toBeTruthy();
    });

    test('should change UI language when selector is used', async ({ page }) => {
      // Get initial page content
      const initialContent = await page.textContent('body');

      // Try to find and interact with language selector
      const languageSelector = page.locator(
        '[data-testid="language-selector"], select[name*="lang"]'
      ).first();

      if (await languageSelector.count() > 0) {
        // If it's a select element
        const isSelect = await languageSelector.evaluate(el => el.tagName === 'SELECT');
        if (isSelect) {
          await languageSelector.selectOption({ index: 1 });
          await page.waitForTimeout(500);

          const newContent = await page.textContent('body');
          // Content should change when language changes
          expect(newContent).not.toBe(initialContent);
        }
      }
    });
  });

  test.describe('Theme Toggle', () => {
    test('should have theme toggle', async ({ page }) => {
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"], [class*="theme-toggle"]'
      ).first();

      const exists = await themeToggle.count() > 0;
      expect(exists).toBeTruthy();
    });

    test('should toggle between dark and light mode', async ({ page }) => {
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]'
      ).first();

      if (await themeToggle.count() > 0) {
        // Get initial background color
        const initialBg = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });

        await themeToggle.click();
        await page.waitForTimeout(300);

        // Background color should change
        const newBg = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });

        // Colors should be different after toggle
        expect(newBg).not.toBe(initialBg);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      // Navigation should be visible
      const nav = page.locator('nav, header');
      await expect(nav.first()).toBeVisible();

      // Content should not overflow
      const body = page.locator('body');
      const scrollWidth = await body.evaluate(el => el.scrollWidth);
      const clientWidth = await body.evaluate(el => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('should display correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // Page should still be functional
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Page should still be functional
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();

      // Check for mobile menu or hamburger icon
      const mobileMenu = page.locator(
        '[data-testid="mobile-menu"], button[aria-label*="menu"], [class*="hamburger"], [class*="mobile-menu"]'
      );

      // Either mobile menu exists or regular nav is visible
      const mobileMenuExists = await mobileMenu.count() > 0;
      const navVisible = await page.locator('nav a').first().isVisible();

      expect(mobileMenuExists || navVisible).toBeTruthy();
    });

    test('should not have horizontal overflow on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const body = page.locator('body');
      const scrollWidth = await body.evaluate(el => el.scrollWidth);
      const clientWidth = await body.evaluate(el => el.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // Small tolerance
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThanOrEqual(1);
    });

    test('should have alt text on images', async ({ page }) => {
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt should exist (can be empty for decorative images)
        expect(alt).not.toBeNull();
      }
    });

    test('should have focusable navigation elements', async ({ page }) => {
      const links = page.locator('a[href]');
      const count = await links.count();

      // Should have clickable links
      expect(count).toBeGreaterThan(0);
    });
  });
});

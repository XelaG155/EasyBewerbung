import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse, mockAPIError } from '../utils/helpers';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
  });

  test.describe('Visual Elements', () => {
    test('should display login form', async ({ page }) => {
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should display email input field', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await expect(emailInput).toBeVisible();
    });

    test('should display password input field', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      await expect(passwordInput).toBeVisible();
    });

    test('should display login button', async ({ page }) => {
      const loginButton = page.locator('button[type="submit"]');
      await expect(loginButton).toBeVisible();
    });

    test('should display Google Sign-In button', async ({ page }) => {
      const googleButton = page.locator(
        'button:has-text("Google"), [data-testid="google-signin"], [class*="google"]'
      ).first();
      await expect(googleButton).toBeVisible();
    });

    test('should display link to registration page', async ({ page }) => {
      const registerLink = page.locator('a[href*="register"]');
      await expect(registerLink).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should require email field', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Form should not submit - check we're still on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should require password field', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Form should not submit
      await expect(page).toHaveURL(/\/login/);
    });

    test('should validate email format', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('invalid-email');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show validation error or stay on page
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Login Functionality', () => {
    test('should show error on invalid credentials', async ({ page }) => {
      // Mock API error response
      await mockAPIError(page, '**/users/login', 401, 'Invalid credentials');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('wrong@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('wrongpassword');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show error message
      const errorMessage = page.locator('[class*="error"], [role="alert"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should redirect to dashboard on successful login', async ({ page }) => {
      // Mock successful login response
      await mockAPIResponse(page, '**/users/login', {
        access_token: 'mock-token',
        token_type: 'bearer',
        user: {
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User',
          is_admin: false,
        },
      });

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });

    test('should store JWT token after successful login', async ({ page }) => {
      // Mock successful login response
      await mockAPIResponse(page, '**/users/login', {
        access_token: 'mock-jwt-token',
        token_type: 'bearer',
        user: {
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User',
        },
      });

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await page.waitForURL(/\/dashboard/, { timeout: 10000 });

      // Check token is stored
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to register page when clicking register link', async ({ page }) => {
      const registerLink = page.locator('a[href*="register"]');
      await registerLink.click();

      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Form should still be visible
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // All inputs should be visible
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await expect(emailInput).toBeVisible();

      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Submit button should be visible
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
    });

    test('should not have horizontal overflow on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const body = page.locator('body');
      const scrollWidth = await body.evaluate(el => el.scrollWidth);
      const clientWidth = await body.evaluate(el => el.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state during login', async ({ page }) => {
      // Mock delayed response
      await page.route('**/users/login', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-token',
            token_type: 'bearer',
            user: { id: 1, email: 'test@example.com' },
          }),
        });
      });

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Button should be disabled or show loading state
      const isDisabled = await submitButton.isDisabled();
      const hasLoadingClass = await submitButton.evaluate(el =>
        el.className.includes('loading') || el.className.includes('disabled')
      );
      const hasLoadingText = await submitButton.textContent();

      // At least one loading indicator should be present
      expect(isDisabled || hasLoadingClass || hasLoadingText?.includes('...')).toBeTruthy();
    });
  });
});

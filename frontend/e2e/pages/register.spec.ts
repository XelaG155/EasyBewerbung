import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse, mockAPIError, generateTestEmail } from '../utils/helpers';

test.describe('Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);
  });

  test.describe('Visual Elements', () => {
    test('should display registration form', async ({ page }) => {
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

    test('should display full name input field', async ({ page }) => {
      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await expect(nameInput).toBeVisible();
    });

    test('should display language selectors', async ({ page }) => {
      // Mother tongue selector
      const motherTongueSelector = page.locator(
        'select[name*="mother"], select[name*="tongue"], [data-testid="mother-tongue"]'
      ).first();
      await expect(motherTongueSelector).toBeVisible();

      // Documentation language selector
      const docLangSelector = page.locator(
        'select[name*="documentation"], select[name*="doc"], [data-testid="documentation-language"]'
      ).first();
      await expect(docLangSelector).toBeVisible();
    });

    test('should display privacy policy checkbox', async ({ page }) => {
      const privacyCheckbox = page.locator(
        'input[type="checkbox"][name*="privacy"], input[type="checkbox"][name*="policy"], input[type="checkbox"][name*="terms"]'
      ).first();
      await expect(privacyCheckbox).toBeVisible();
    });

    test('should display register button', async ({ page }) => {
      const registerButton = page.locator('button[type="submit"]');
      await expect(registerButton).toBeVisible();
    });

    test('should display Google Sign-In button', async ({ page }) => {
      const googleButton = page.locator(
        'button:has-text("Google"), [data-testid="google-signin"], [class*="google"]'
      ).first();
      await expect(googleButton).toBeVisible();
    });

    test('should display link to login page', async ({ page }) => {
      const loginLink = page.locator('a[href*="login"]');
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should require email field', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('Test User');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should require password field', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('Test User');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should validate email format', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('invalid-email');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should require minimum password length', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('short'); // Less than 8 characters

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('Test User');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show validation error or stay on page
      await expect(page).toHaveURL(/\/register/);
    });

    test('should require privacy policy acceptance', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('Test User');

      // Don't check privacy policy checkbox

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show error or stay on page
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Registration Functionality', () => {
    test('should show error when email already exists', async ({ page }) => {
      await mockAPIError(page, '**/users/register', 400, 'Email already registered');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('existing@example.com');

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('Test User');

      const privacyCheckbox = page.locator('input[type="checkbox"]').first();
      await privacyCheckbox.check();

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      const errorMessage = page.locator('[class*="error"], [role="alert"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should redirect to dashboard on successful registration', async ({ page }) => {
      await mockAPIResponse(page, '**/users/register', {
        access_token: 'mock-token',
        token_type: 'bearer',
        user: {
          id: 1,
          email: 'newuser@example.com',
          full_name: 'New User',
          is_admin: false,
        },
      });

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill(generateTestEmail());

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('New User');

      const privacyCheckbox = page.locator('input[type="checkbox"]').first();
      await privacyCheckbox.check();

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });

    test('should store JWT token after successful registration', async ({ page }) => {
      await mockAPIResponse(page, '**/users/register', {
        access_token: 'mock-jwt-token-new',
        token_type: 'bearer',
        user: {
          id: 1,
          email: 'newuser@example.com',
          full_name: 'New User',
        },
      });

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill(generateTestEmail());

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testpassword123');

      const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]');
      await nameInput.fill('New User');

      const privacyCheckbox = page.locator('input[type="checkbox"]').first();
      await privacyCheckbox.check();

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await page.waitForURL(/\/dashboard/, { timeout: 10000 });

      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });
  });

  test.describe('Language Selection', () => {
    test('should allow selecting mother tongue', async ({ page }) => {
      const motherTongueSelector = page.locator(
        'select[name*="mother"], select[name*="tongue"]'
      ).first();

      if (await motherTongueSelector.count() > 0) {
        const options = await motherTongueSelector.locator('option').count();
        expect(options).toBeGreaterThan(1);

        await motherTongueSelector.selectOption({ index: 1 });
        const selectedValue = await motherTongueSelector.inputValue();
        expect(selectedValue).toBeTruthy();
      }
    });

    test('should allow selecting documentation language', async ({ page }) => {
      const docLangSelector = page.locator(
        'select[name*="documentation"], select[name*="doc"]'
      ).first();

      if (await docLangSelector.count() > 0) {
        const options = await docLangSelector.locator('option').count();
        expect(options).toBeGreaterThan(1);

        await docLangSelector.selectOption({ index: 1 });
        const selectedValue = await docLangSelector.inputValue();
        expect(selectedValue).toBeTruthy();
      }
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to login page when clicking login link', async ({ page }) => {
      const loginLink = page.locator('a[href*="login"]');
      await loginLink.click();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const form = page.locator('form');
      await expect(form).toBeVisible();

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await expect(emailInput).toBeVisible();

      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

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

  test.describe('Privacy Policy', () => {
    test('should have clickable privacy policy link', async ({ page }) => {
      const privacyLink = page.locator('a[href*="privacy"], a:has-text("Privacy"), a:has-text("Datenschutz")');

      if (await privacyLink.count() > 0) {
        await expect(privacyLink.first()).toBeVisible();
      }
    });
  });
});

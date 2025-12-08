import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse, generateTestEmail } from '../utils/helpers';

/**
 * End-to-End User Flow: Complete Registration Process
 *
 * Tests the entire registration journey from landing page to dashboard
 */
test.describe('Registration Flow', () => {
  test('complete registration journey', async ({ page }) => {
    const testEmail = generateTestEmail();

    // 1. Start on landing page
    await page.goto('/');
    await waitForPageLoad(page);

    // 2. Click register button
    const registerLink = page.getByRole('link', { name: /register|registrieren|sign up/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    // 3. Verify we're on registration page
    await expect(page).toHaveURL(/\/register/);

    // 4. Mock successful registration
    await mockAPIResponse(page, '**/users/register', {
      access_token: 'mock-new-user-token',
      token_type: 'bearer',
      user: {
        id: 100,
        email: testEmail,
        full_name: 'New Test User',
        is_admin: false,
        credits: 5,
      },
    });

    // 5. Fill registration form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('securepassword123');

    const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('New Test User');
    }

    // 6. Accept privacy policy
    const privacyCheckbox = page.locator('input[type="checkbox"]').first();
    if (await privacyCheckbox.count() > 0) {
      await privacyCheckbox.check();
    }

    // 7. Submit registration
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 8. Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 9. Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // 10. Verify user info is stored
    const userInfo = await page.evaluate(() => {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    });
    expect(userInfo).toBeTruthy();
    expect(userInfo.email).toBe(testEmail);
  });

  test('registration with Google OAuth', async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);

    // Find Google sign-in button
    const googleButton = page.locator(
      'button:has-text("Google"), [data-testid="google-signin"], [class*="google"]'
    ).first();

    await expect(googleButton).toBeVisible();

    // Click should trigger OAuth flow (we can only verify the button exists)
    // In a real scenario, this would open Google OAuth popup
  });

  test('registration validation errors', async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should stay on registration page
    await expect(page).toHaveURL(/\/register/);

    // Fill with invalid email
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('invalid-email');

    await submitButton.click();
    await expect(page).toHaveURL(/\/register/);

    // Fill with short password
    await emailInput.clear();
    await emailInput.fill('test@example.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('short');

    await submitButton.click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('navigation between login and register', async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);

    // Navigate to login
    const loginLink = page.locator('a[href*="login"]');
    await loginLink.click();

    await expect(page).toHaveURL(/\/login/);

    // Navigate back to register
    const registerLink = page.locator('a[href*="register"]');
    await registerLink.click();

    await expect(page).toHaveURL(/\/register/);
  });
});

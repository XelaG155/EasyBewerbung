import { test as base, Page } from '@playwright/test';

/**
 * Test user credentials for E2E testing
 */
export const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  fullName: 'Test User',
  motherTongue: 'de',
  documentationLanguage: 'de',
};

export const adminUser = {
  email: 'admin@example.com',
  password: 'adminpassword123',
  fullName: 'Admin User',
  isAdmin: true,
};

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
}>({
  /**
   * Provides a page that is already authenticated as a regular user
   */
  authenticatedPage: async ({ page }, use) => {
    // Mock authentication by setting token in localStorage
    await page.goto('/');
    await page.evaluate((user) => {
      // Mock JWT token for testing
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxOTk5OTk5OTk5fQ.mock';
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        email: user.email,
        full_name: user.fullName,
        is_admin: false,
      }));
    }, testUser);

    await use(page);
  },

  /**
   * Provides a page that is already authenticated as an admin user
   */
  adminPage: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate((user) => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImV4cCI6MTk5OTk5OTk5OX0.mock';
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify({
        id: 2,
        email: user.email,
        full_name: user.fullName,
        is_admin: true,
      }));
    }, adminUser);

    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to login via the UI
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

/**
 * Helper to register via the UI
 */
export async function registerViaUI(
  page: Page,
  email: string,
  password: string,
  fullName: string
) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="fullName"]', fullName);
  // Accept privacy policy
  await page.click('input[type="checkbox"]');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

/**
 * Helper to logout
 */
export async function logout(page: Page) {
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/');
}

/**
 * Helper to clear authentication state
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
}

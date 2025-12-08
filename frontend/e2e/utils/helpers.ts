import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Check if element is visible and has correct text
 */
export async function expectTextVisible(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible();
}

/**
 * Check if all elements in a list are visible
 */
export async function expectAllVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    await expect(page.locator(selector)).toBeVisible();
  }
}

/**
 * Fill form fields from an object
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string>
) {
  for (const [name, value] of Object.entries(fields)) {
    await page.fill(`[name="${name}"]`, value);
  }
}

/**
 * Select option from dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
) {
  await page.selectOption(selector, value);
}

/**
 * Wait for toast/notification message
 */
export async function waitForToast(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 10000 });
}

/**
 * Check responsive breakpoints
 */
export async function testResponsive(
  page: Page,
  callback: () => Promise<void>
) {
  // Desktop
  await page.setViewportSize({ width: 1280, height: 720 });
  await callback();

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await callback();

  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await callback();
}

/**
 * Take screenshot with consistent naming
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
) {
  await page.screenshot({
    path: `screenshots/${name}.png`,
    fullPage: options?.fullPage ?? false,
  });
}

/**
 * Mock API response
 */
export async function mockAPIResponse(
  page: Page,
  url: string | RegExp,
  response: object,
  status = 200
) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock API error
 */
export async function mockAPIError(
  page: Page,
  url: string | RegExp,
  status: number,
  message: string
) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: message }),
    });
  });
}

/**
 * Wait for navigation and check URL
 */
export async function expectNavigation(page: Page, url: string | RegExp) {
  await page.waitForURL(url);
  await expect(page).toHaveURL(url);
}

/**
 * Check form validation error
 */
export async function expectValidationError(page: Page, fieldName: string, errorText: string) {
  const field = page.locator(`[name="${fieldName}"]`);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(errorText)).toBeVisible();
}

/**
 * Check no console errors
 */
export function setupConsoleErrorCheck(page: Page) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return {
    getErrors: () => errors,
    expectNoErrors: () => {
      expect(errors).toHaveLength(0);
    },
  };
}

/**
 * Generate unique test data
 */
export function generateTestEmail() {
  return `test-${Date.now()}@example.com`;
}

export function generateTestData() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    fullName: `Test User ${timestamp}`,
    company: `Test Company ${timestamp}`,
    jobTitle: `Test Position ${timestamp}`,
  };
}

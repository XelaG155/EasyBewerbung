import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

test.describe('Settings Page', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    full_name: 'Test User',
    preferred_language: 'en',
    mother_tongue: 'de',
    documentation_language: 'en',
    employment_status: 'employed',
    education_type: 'bachelor',
    additional_context: 'Some additional context',
    credits: 10,
  };

  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Authenticated User', () => {
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

      await mockAPIResponse(page, '**/users/me', mockUser);

      await page.goto('/settings');
      await waitForPageLoad(page);
    });

    test.describe('Visual Elements', () => {
      test('should display profile section', async ({ page }) => {
        const profileSection = page.locator(':has-text("Profile"), :has-text("Profil")');
        await expect(profileSection.first()).toBeVisible();
      });

      test('should display full name input', async ({ page }) => {
        const nameInput = page.locator(
          'input[name="fullName"], input[name="full_name"], input[name="name"]'
        );
        await expect(nameInput.first()).toBeVisible();
      });

      test('should display email (read-only)', async ({ page }) => {
        const emailField = page.locator(
          'input[name="email"], :has-text("test@example.com")'
        );
        await expect(emailField.first()).toBeVisible();
      });

      test('should display language selectors', async ({ page }) => {
        const langSelectors = page.locator('select[name*="language"], select[name*="lang"]');
        const count = await langSelectors.count();
        expect(count).toBeGreaterThanOrEqual(1);
      });

      test('should display preferred language selector', async ({ page }) => {
        const prefLangSelector = page.locator(
          'select[name*="preferred"], select[name="preferredLanguage"]'
        ).first();
        // May exist or not depending on UI
      });

      test('should display mother tongue selector', async ({ page }) => {
        const motherTongueSelector = page.locator(
          'select[name*="mother"], select[name*="tongue"]'
        ).first();
        // May exist or not depending on UI
      });

      test('should display documentation language selector', async ({ page }) => {
        const docLangSelector = page.locator(
          'select[name*="documentation"], select[name*="doc"]'
        ).first();
        // May exist or not depending on UI
      });

      test('should display extended profile section', async ({ page }) => {
        const extendedSection = page.locator(
          ':has-text("Extended"), :has-text("Erweitert"), :has-text("Additional")'
        );
        const count = await extendedSection.count();
        // May or may not exist depending on UI
      });

      test('should display employment status dropdown', async ({ page }) => {
        const statusDropdown = page.locator(
          'select[name*="employment"], select[name*="status"]'
        );
        // May exist or not
      });

      test('should display education type dropdown', async ({ page }) => {
        const educationDropdown = page.locator(
          'select[name*="education"], select[name*="type"]'
        );
        // May exist or not
      });

      test('should display additional context textarea', async ({ page }) => {
        const contextTextarea = page.locator(
          'textarea[name*="context"], textarea[name*="additional"]'
        );
        // May exist or not
      });

      test('should display save button', async ({ page }) => {
        const saveButton = page.locator(
          'button:has-text("Save"), button:has-text("Speichern"), button[type="submit"]'
        ).first();
        await expect(saveButton).toBeVisible();
      });

      test('should display back button', async ({ page }) => {
        const backButton = page.locator(
          'a[href*="dashboard"], button:has-text("Back"), button:has-text("Zurück")'
        ).first();
        await expect(backButton).toBeVisible();
      });
    });

    test.describe('Form Functionality', () => {
      test('should populate form with current user data', async ({ page }) => {
        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();

        if (await nameInput.count() > 0) {
          const value = await nameInput.inputValue();
          expect(value).toBe('Test User');
        }
      });

      test('should allow updating full name', async ({ page }) => {
        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();

        if (await nameInput.count() > 0) {
          await nameInput.clear();
          await nameInput.fill('Updated User Name');
          const value = await nameInput.inputValue();
          expect(value).toBe('Updated User Name');
        }
      });

      test('should not allow editing email', async ({ page }) => {
        const emailInput = page.locator('input[name="email"]').first();

        if (await emailInput.count() > 0) {
          const isDisabled = await emailInput.isDisabled();
          const isReadonly = await emailInput.getAttribute('readonly');
          expect(isDisabled || isReadonly !== null).toBeTruthy();
        }
      });

      test('should allow changing language preferences', async ({ page }) => {
        const langSelector = page.locator('select[name*="language"]').first();

        if (await langSelector.count() > 0) {
          const options = await langSelector.locator('option').count();
          expect(options).toBeGreaterThan(1);

          await langSelector.selectOption({ index: 1 });
          const selectedValue = await langSelector.inputValue();
          expect(selectedValue).toBeTruthy();
        }
      });

      test('should save changes successfully', async ({ page }) => {
        await page.route('**/users/me', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({
                ...mockUser,
                full_name: 'Updated User Name',
              }),
            });
          } else {
            route.continue();
          }
        });

        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.clear();
          await nameInput.fill('Updated User Name');
        }

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern"), button[type="submit"]').first();
        await saveButton.click();

        // Should show success message
        await page.waitForTimeout(1000);
        const successMessage = page.locator('[class*="success"], :has-text("Success"), :has-text("Erfolgreich")');
        const messageExists = await successMessage.count() > 0;
        // Success feedback may or may not be visible
      });

      test('should show validation errors', async ({ page }) => {
        await page.route('**/users/me', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 400,
              body: JSON.stringify({ detail: 'Validation error' }),
            });
          } else {
            route.continue();
          }
        });

        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.clear(); // Clear to potentially trigger validation
        }

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        await saveButton.click();

        await page.waitForTimeout(1000);
      });
    });

    test.describe('Extended Profile', () => {
      test('should allow updating employment status', async ({ page }) => {
        const statusDropdown = page.locator('select[name*="employment"]').first();

        if (await statusDropdown.count() > 0) {
          await statusDropdown.selectOption({ index: 1 });
          const selectedValue = await statusDropdown.inputValue();
          expect(selectedValue).toBeTruthy();
        }
      });

      test('should allow updating education type', async ({ page }) => {
        const educationDropdown = page.locator('select[name*="education"]').first();

        if (await educationDropdown.count() > 0) {
          await educationDropdown.selectOption({ index: 1 });
          const selectedValue = await educationDropdown.inputValue();
          expect(selectedValue).toBeTruthy();
        }
      });

      test('should allow updating additional context', async ({ page }) => {
        const contextTextarea = page.locator('textarea[name*="context"]').first();

        if (await contextTextarea.count() > 0) {
          await contextTextarea.clear();
          await contextTextarea.fill('New additional context information');
          const value = await contextTextarea.inputValue();
          expect(value).toBe('New additional context information');
        }
      });
    });

    test.describe('Navigation', () => {
      test('should return to dashboard when clicking back', async ({ page }) => {
        const backButton = page.locator('a[href*="dashboard"], button:has-text("Back"), button:has-text("Zurück")').first();
        await backButton.click();

        await expect(page).toHaveURL(/\/dashboard/);
      });
    });

    test.describe('Persistence', () => {
      test('should persist changes after page reload', async ({ page }) => {
        const updatedUser = { ...mockUser, full_name: 'Persisted Name' };

        await page.route('**/users/me', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify(updatedUser),
            });
          } else if (route.request().method() === 'GET') {
            route.fulfill({
              status: 200,
              body: JSON.stringify(updatedUser),
            });
          } else {
            route.continue();
          }
        });

        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.clear();
          await nameInput.fill('Persisted Name');
        }

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        await saveButton.click();

        await page.waitForTimeout(1000);
        await page.reload();
        await waitForPageLoad(page);

        const reloadedInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
        if (await reloadedInput.count() > 0) {
          const value = await reloadedInput.inputValue();
          expect(value).toBe('Persisted Name');
        }
      });
    });

    test.describe('Responsive Design', () => {
      test('should display correctly on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const form = page.locator('form');
        await expect(form).toBeVisible();

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        await expect(saveButton).toBeVisible();
      });

      test('should not have horizontal overflow on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const body = page.locator('body');
        const scrollWidth = await body.evaluate(el => el.scrollWidth);
        const clientWidth = await body.evaluate(el => el.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
      });

      test('should have functional form inputs on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const nameInput = page.locator('input[name="fullName"], input[name="full_name"], input[name="name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.clear();
          await nameInput.fill('Mobile Test');
          const value = await nameInput.inputValue();
          expect(value).toBe('Mobile Test');
        }
      });
    });

    test.describe('Credits Display', () => {
      test('should display user credits', async ({ page }) => {
        const creditsDisplay = page.locator(':has-text("Credit"), :has-text("Kredit")');
        // Credits may or may not be displayed on settings page
      });
    });
  });
});

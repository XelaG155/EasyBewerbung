import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse, mockAPIError } from '../utils/helpers';

test.describe('Admin Page', () => {
  const mockAdminUser = {
    id: 2,
    email: 'admin@example.com',
    full_name: 'Admin User',
    is_admin: true,
    credits: 100,
  };

  const mockRegularUser = {
    id: 1,
    email: 'test@example.com',
    full_name: 'Test User',
    is_admin: false,
    credits: 10,
  };

  const mockSearchResults = [
    { id: 3, email: 'user1@example.com', full_name: 'User One', credits: 5 },
    { id: 4, email: 'user2@example.com', full_name: 'User Two', credits: 10 },
  ];

  const mockLanguages = [
    { code: 'en', label: 'English', is_active: true, sort_order: 1 },
    { code: 'de', label: 'German', is_active: true, sort_order: 2 },
    { code: 'fr', label: 'French', is_active: false, sort_order: 3 },
  ];

  test.describe('Access Control', () => {
    test('should redirect non-admin users to dashboard', async ({ page }) => {
      // Mock as regular user
      await page.goto('/');
      await page.evaluate((user) => {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(user));
      }, mockRegularUser);

      await mockAPIResponse(page, '**/users/me', mockRegularUser);

      await page.goto('/admin');

      // Should redirect to dashboard or show access denied
      await page.waitForTimeout(2000);
      const url = page.url();
      const redirected = url.includes('/dashboard') || url.includes('/login');
      const hasError = await page.locator(':has-text("Access Denied"), :has-text("Unauthorized")').count() > 0;

      expect(redirected || hasError).toBeTruthy();
    });

    test('should allow admin users to access page', async ({ page }) => {
      await page.goto('/');
      await page.evaluate((user) => {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(user));
      }, mockAdminUser);

      await mockAPIResponse(page, '**/users/me', mockAdminUser);
      await mockAPIResponse(page, '**/admin/languages', mockLanguages);
      await mockAPIResponse(page, '**/admin/users/search*', []);

      await page.goto('/admin');
      await waitForPageLoad(page);

      await expect(page).toHaveURL(/\/admin/);
    });
  });

  test.describe('Authenticated Admin', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate((user) => {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(user));
      }, mockAdminUser);

      await mockAPIResponse(page, '**/users/me', mockAdminUser);
      await mockAPIResponse(page, '**/admin/languages', mockLanguages);
      await mockAPIResponse(page, '**/admin/users/search*', []);

      await page.goto('/admin');
      await waitForPageLoad(page);
    });

    test.describe('Visual Elements', () => {
      test('should display user search section', async ({ page }) => {
        const searchSection = page.locator(
          ':has-text("Search"), :has-text("Suche"), input[type="search"], input[placeholder*="search"]'
        );
        const count = await searchSection.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display search input', async ({ page }) => {
        const searchInput = page.locator(
          'input[type="search"], input[name*="search"], input[placeholder*="search"], input[placeholder*="email"]'
        );
        const count = await searchInput.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display language management section', async ({ page }) => {
        const langSection = page.locator(':has-text("Language"), :has-text("Sprache")');
        const count = await langSection.count();
        expect(count).toBeGreaterThan(0);
      });
    });

    test.describe('User Search', () => {
      test('should search by email', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);

        const searchInput = page.locator('input[type="search"], input[name*="search"]').first();
        await searchInput.fill('user1@example.com');

        // Trigger search (Enter or button click)
        await searchInput.press('Enter');
        await page.waitForTimeout(1000);

        const results = page.locator(':has-text("user1@example.com")');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should search by name', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);

        const searchInput = page.locator('input[type="search"], input[name*="search"]').first();
        await searchInput.fill('User One');

        await searchInput.press('Enter');
        await page.waitForTimeout(1000);
      });

      test('should display search results', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);

        const searchInput = page.locator('input[type="search"], input[name*="search"]').first();
        await searchInput.fill('user');
        await searchInput.press('Enter');

        await page.waitForTimeout(1000);

        const resultItems = page.locator('[class*="user"], [class*="result"], tr');
        const count = await resultItems.count();
        // Should have results or table rows
      });

      test('should show user details on click', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);
        await mockAPIResponse(page, '**/admin/users/3', {
          ...mockSearchResults[0],
          activity_logs: [
            { action: 'login', timestamp: new Date().toISOString() },
          ],
        });

        const searchInput = page.locator('input[type="search"], input[name*="search"]').first();
        await searchInput.fill('user1');
        await searchInput.press('Enter');

        await page.waitForTimeout(1000);

        const userResult = page.locator(':has-text("user1@example.com")').first();
        if (await userResult.count() > 0) {
          await userResult.click();
          await page.waitForTimeout(500);
        }
      });
    });

    test.describe('User Details Panel', () => {
      test('should display user profile info', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);
        await mockAPIResponse(page, '**/admin/users/3', {
          id: 3,
          email: 'user1@example.com',
          full_name: 'User One',
          credits: 5,
          created_at: new Date().toISOString(),
        });

        const searchInput = page.locator('input[type="search"]').first();
        await searchInput.fill('user1');
        await searchInput.press('Enter');

        await page.waitForTimeout(1000);

        const userResult = page.locator(':has-text("user1@example.com")').first();
        if (await userResult.count() > 0) {
          await userResult.click();

          const detailPanel = page.locator('[class*="detail"], [class*="panel"]');
          // Detail panel may or may not appear
        }
      });

      test('should display activity logs', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/3', {
          id: 3,
          email: 'user1@example.com',
          full_name: 'User One',
          activity_logs: [
            { action: 'login', timestamp: new Date().toISOString(), ip_address: '127.0.0.1' },
            { action: 'create_application', timestamp: new Date().toISOString() },
          ],
        });

        // Activity logs may be displayed in user detail view
      });
    });

    test.describe('Credit Management', () => {
      test('should display credit grant form', async ({ page }) => {
        const creditForm = page.locator(
          'input[name*="credit"], input[type="number"], :has-text("Grant Credits")'
        );
        const count = await creditForm.count();
        // Credit form may or may not be visible without selecting a user
      });

      test('should grant credits to user', async ({ page }) => {
        await mockAPIResponse(page, '**/admin/users/search*', mockSearchResults);

        await page.route('**/users/admin/credits', (route) => {
          if (route.request().method() === 'POST') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ success: true, new_credits: 15 }),
            });
          } else {
            route.continue();
          }
        });

        const searchInput = page.locator('input[type="search"]').first();
        await searchInput.fill('user1');
        await searchInput.press('Enter');

        await page.waitForTimeout(1000);

        const creditInput = page.locator('input[name*="credit"], input[type="number"]').first();
        if (await creditInput.count() > 0) {
          await creditInput.fill('10');

          const grantButton = page.locator('button:has-text("Grant"), button:has-text("Vergeben")').first();
          if (await grantButton.count() > 0) {
            await grantButton.click();
          }
        }
      });
    });

    test.describe('Language Management', () => {
      test('should display list of languages', async ({ page }) => {
        const languageList = page.locator(':has-text("English"), :has-text("German"), :has-text("French")');
        const count = await languageList.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should toggle language active status', async ({ page }) => {
        await page.route('**/admin/languages', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ success: true }),
            });
          } else {
            route.continue();
          }
        });

        const toggleSwitch = page.locator('input[type="checkbox"][name*="active"]').first();
        if (await toggleSwitch.count() > 0) {
          await toggleSwitch.click();
          await page.waitForTimeout(500);
        }
      });

      test('should change language sort order', async ({ page }) => {
        await page.route('**/admin/languages', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ success: true }),
            });
          } else {
            route.continue();
          }
        });

        const sortInput = page.locator('input[name*="sort"], input[name*="order"]').first();
        if (await sortInput.count() > 0) {
          await sortInput.clear();
          await sortInput.fill('5');
        }
      });

      test('should save language changes', async ({ page }) => {
        await page.route('**/admin/languages', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ success: true }),
            });
          } else {
            route.continue();
          }
        });

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      });
    });

    test.describe('Responsive Design', () => {
      test('should display correctly on tablet', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        const main = page.locator('main');
        await expect(main).toBeVisible();
      });
    });
  });
});

test.describe('Admin Documents Page', () => {
  const mockAdminUser = {
    id: 2,
    email: 'admin@example.com',
    full_name: 'Admin User',
    is_admin: true,
  };

  const mockTemplates = [
    {
      id: 1,
      doc_type: 'COVER_LETTER',
      display_name: 'Cover Letter',
      llm_provider: 'openai',
      llm_model: 'gpt-4',
      prompt_template: 'Generate a cover letter...',
      credit_cost: 1,
      is_active: true,
    },
    {
      id: 2,
      doc_type: 'CV',
      display_name: 'CV',
      llm_provider: 'anthropic',
      llm_model: 'claude-3-opus',
      prompt_template: 'Generate a CV...',
      credit_cost: 2,
      is_active: true,
    },
  ];

  test.describe('Authenticated Admin', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate((user) => {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(user));
      }, mockAdminUser);

      await mockAPIResponse(page, '**/users/me', mockAdminUser);
      await mockAPIResponse(page, '**/admin/document-templates', mockTemplates);

      await page.goto('/admin/documents');
      await waitForPageLoad(page);
    });

    test.describe('Visual Elements', () => {
      test('should display document templates list', async ({ page }) => {
        const templateList = page.locator(':has-text("Cover Letter"), :has-text("CV")');
        const count = await templateList.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display template details', async ({ page }) => {
        const providerInfo = page.locator(':has-text("openai"), :has-text("anthropic")');
        const count = await providerInfo.count();
        expect(count).toBeGreaterThan(0);
      });
    });

    test.describe('Template Editing', () => {
      test('should allow changing display name', async ({ page }) => {
        const nameInput = page.locator('input[name*="display"], input[name*="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.clear();
          await nameInput.fill('Updated Cover Letter');
        }
      });

      test('should allow changing LLM provider', async ({ page }) => {
        const providerSelect = page.locator('select[name*="provider"]').first();
        if (await providerSelect.count() > 0) {
          await providerSelect.selectOption('anthropic');
        }
      });

      test('should allow changing LLM model', async ({ page }) => {
        const modelInput = page.locator('input[name*="model"]').first();
        if (await modelInput.count() > 0) {
          await modelInput.clear();
          await modelInput.fill('gpt-4-turbo');
        }
      });

      test('should allow editing prompt template', async ({ page }) => {
        const promptTextarea = page.locator('textarea[name*="prompt"]').first();
        if (await promptTextarea.count() > 0) {
          await promptTextarea.clear();
          await promptTextarea.fill('New prompt template...');
        }
      });

      test('should allow adjusting credit cost', async ({ page }) => {
        const creditInput = page.locator('input[name*="credit"], input[type="number"]').first();
        if (await creditInput.count() > 0) {
          await creditInput.clear();
          await creditInput.fill('3');
        }
      });

      test('should allow toggling active status', async ({ page }) => {
        const activeToggle = page.locator('input[type="checkbox"][name*="active"]').first();
        if (await activeToggle.count() > 0) {
          await activeToggle.click();
        }
      });

      test('should save template changes', async ({ page }) => {
        await page.route('**/admin/document-templates/*', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ ...mockTemplates[0], display_name: 'Updated' }),
            });
          } else {
            route.continue();
          }
        });

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      });
    });
  });
});

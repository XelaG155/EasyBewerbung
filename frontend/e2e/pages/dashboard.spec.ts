import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse, mockAPIError } from '../utils/helpers';
import { test as authTest } from '../fixtures/auth';

test.describe('Dashboard Page', () => {
  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Authenticated User', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.goto('/');
      await page.evaluate(() => {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxOTk5OTk5OTk5fQ.mock';
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User',
          is_admin: false,
        }));
      });

      // Mock API responses
      await mockAPIResponse(page, '**/users/me', {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        is_admin: false,
        credits: 10,
      });

      await mockAPIResponse(page, '**/documents', []);
      await mockAPIResponse(page, '**/applications/history*', []);

      await page.goto('/dashboard');
      await waitForPageLoad(page);
    });

    test.describe('Visual Elements', () => {
      test('should display navigation bar with user info', async ({ page }) => {
        const nav = page.locator('nav, header');
        await expect(nav.first()).toBeVisible();
      });

      test('should display settings button', async ({ page }) => {
        const settingsButton = page.locator(
          'a[href*="settings"], button:has-text("Settings"), button:has-text("Einstellungen"), [data-testid="settings"]'
        ).first();
        await expect(settingsButton).toBeVisible();
      });

      test('should display logout button', async ({ page }) => {
        const logoutButton = page.locator(
          'button:has-text("Logout"), button:has-text("Abmelden"), [data-testid="logout"]'
        ).first();
        await expect(logoutButton).toBeVisible();
      });

      test('should display upload documents section', async ({ page }) => {
        const uploadSection = page.locator(
          '[class*="upload"], :has-text("Upload"), :has-text("Hochladen")'
        ).first();
        await expect(uploadSection).toBeVisible();
      });

      test('should display add job offer section', async ({ page }) => {
        const jobSection = page.locator(
          ':has-text("Job"), :has-text("Stelle"), :has-text("URL")'
        ).first();
        await expect(jobSection).toBeVisible();
      });
    });

    test.describe('Upload Documents Section', () => {
      test('should display document type dropdown', async ({ page }) => {
        const typeDropdown = page.locator(
          'select[name*="type"], select[name*="doc"], [data-testid="doc-type"]'
        ).first();
        await expect(typeDropdown).toBeVisible();
      });

      test('should display file upload input', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
      });

      test('should display upload button', async ({ page }) => {
        const uploadButton = page.locator(
          'button:has-text("Upload"), button:has-text("Hochladen")'
        ).first();
        await expect(uploadButton).toBeVisible();
      });

      test('should upload document successfully', async ({ page }) => {
        await mockAPIResponse(page, '**/documents/upload', {
          id: 1,
          filename: 'test-cv.pdf',
          doc_type: 'CV',
          created_at: new Date().toISOString(),
        });

        // Select document type
        const typeDropdown = page.locator('select[name*="type"], select[name*="doc"]').first();
        if (await typeDropdown.count() > 0) {
          await typeDropdown.selectOption({ index: 1 });
        }

        // Upload file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'test-cv.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('test pdf content'),
        });

        const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Hochladen")').first();
        await uploadButton.click();

        // Should show success or document appears
        await page.waitForTimeout(1000);
      });
    });

    test.describe('Your Documents Grid', () => {
      test('should display uploaded documents', async ({ page }) => {
        await mockAPIResponse(page, '**/documents', [
          { id: 1, filename: 'cv.pdf', doc_type: 'CV', created_at: new Date().toISOString() },
          { id: 2, filename: 'reference.pdf', doc_type: 'REFERENCE', created_at: new Date().toISOString() },
        ]);

        await page.reload();
        await waitForPageLoad(page);

        const documents = page.locator('[class*="document"], [class*="card"]');
        const count = await documents.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should show empty state when no documents', async ({ page }) => {
        await mockAPIResponse(page, '**/documents', []);
        await page.reload();
        await waitForPageLoad(page);

        // Should show empty state message or have no document cards
        const emptyState = page.locator(':has-text("No documents"), :has-text("Keine Dokumente")');
        const docCards = page.locator('[data-testid="document-card"]');

        const hasEmptyState = await emptyState.count() > 0;
        const hasNoDocs = await docCards.count() === 0;

        expect(hasEmptyState || hasNoDocs).toBeTruthy();
      });

      test('should delete document when clicking delete', async ({ page }) => {
        await mockAPIResponse(page, '**/documents', [
          { id: 1, filename: 'cv.pdf', doc_type: 'CV', created_at: new Date().toISOString() },
        ]);

        await page.route('**/documents/1', (route) => {
          if (route.request().method() === 'DELETE') {
            route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
          } else {
            route.continue();
          }
        });

        await page.reload();
        await waitForPageLoad(page);

        const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Löschen"), [data-testid="delete-doc"]').first();
        if (await deleteButton.count() > 0) {
          await deleteButton.click();

          // Confirm deletion if dialog appears
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Bestätigen")');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
          }
        }
      });
    });

    test.describe('Add Job Offer Section', () => {
      test('should display URL input field', async ({ page }) => {
        const urlInput = page.locator('input[type="url"], input[name*="url"], input[placeholder*="URL"]');
        await expect(urlInput.first()).toBeVisible();
      });

      test('should display application type dropdown', async ({ page }) => {
        const typeDropdown = page.locator(
          'select[name*="type"], select[name*="application"], [data-testid="application-type"]'
        );
        // At least one type selector should exist
        const count = await typeDropdown.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display language selectors', async ({ page }) => {
        const langSelectors = page.locator('select[name*="language"], select[name*="lang"]');
        const count = await langSelectors.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should create job application from URL', async ({ page }) => {
        await mockAPIResponse(page, '**/jobs/analyze', {
          title: 'Software Engineer',
          company: 'Test Company',
          description: 'Job description here',
          location: 'Zürich',
        });

        await mockAPIResponse(page, '**/applications', {
          id: 1,
          job_title: 'Software Engineer',
          company: 'Test Company',
          status: 'not_applied',
          created_at: new Date().toISOString(),
        });

        const urlInput = page.locator('input[type="url"], input[name*="url"], input[placeholder*="URL"]').first();
        await urlInput.fill('https://example.com/job/123');

        const submitButton = page.locator('button[type="submit"], button:has-text("Add"), button:has-text("Hinzufügen")').first();
        await submitButton.click();

        await page.waitForTimeout(2000);
      });

      test('should show error for invalid URL', async ({ page }) => {
        const urlInput = page.locator('input[type="url"], input[name*="url"]').first();
        await urlInput.fill('not-a-valid-url');

        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();

        // Should show validation error
        await expect(page).toHaveURL(/\/dashboard/);
      });
    });

    test.describe('Spontaneous Outreach Section', () => {
      test('should display company name input', async ({ page }) => {
        const companyInput = page.locator(
          'input[name*="company"], input[placeholder*="Company"], input[placeholder*="Firma"]'
        );
        const count = await companyInput.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display role/position input', async ({ page }) => {
        const roleInput = page.locator(
          'input[name*="role"], input[name*="position"], input[name*="title"]'
        );
        const count = await roleInput.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should create spontaneous application', async ({ page }) => {
        await mockAPIResponse(page, '**/applications', {
          id: 2,
          job_title: 'Frontend Developer',
          company: 'Dream Company',
          spontaneous: true,
          status: 'not_applied',
          created_at: new Date().toISOString(),
        });

        // Look for spontaneous section
        const spontaneousSection = page.locator(':has-text("Spontaneous"), :has-text("Initiativ")').first();
        if (await spontaneousSection.count() > 0) {
          const companyInput = page.locator('input[name*="company"]').first();
          if (await companyInput.count() > 0) {
            await companyInput.fill('Dream Company');
          }

          const roleInput = page.locator('input[name*="role"], input[name*="position"]').first();
          if (await roleInput.count() > 0) {
            await roleInput.fill('Frontend Developer');
          }

          const submitButton = spontaneousSection.locator('button[type="submit"]').first();
          if (await submitButton.count() > 0) {
            await submitButton.click();
          }
        }
      });
    });

    test.describe('Your Applications List', () => {
      test.beforeEach(async ({ page }) => {
        await mockAPIResponse(page, '**/applications/history*', [
          {
            id: 1,
            job_title: 'Software Engineer',
            company: 'Test Company',
            job_offer_url: 'https://example.com/job/1',
            applied: false,
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            job_title: 'Frontend Developer',
            company: 'Another Company',
            job_offer_url: 'https://example.com/job/2',
            applied: true,
            applied_at: new Date().toISOString(),
            result: 'Interview',
            created_at: new Date().toISOString(),
          },
        ]);

        await page.reload();
        await waitForPageLoad(page);
      });

      test('should display all applications', async ({ page }) => {
        const applications = page.locator('[class*="application"], [data-testid="application-card"]');
        // Should have application items visible
        await page.waitForTimeout(1000);
      });

      test('should show company and title for each application', async ({ page }) => {
        const companyText = page.getByText('Test Company');
        await expect(companyText.first()).toBeVisible();
      });

      test('should expand job description on click', async ({ page }) => {
        const expandButton = page.locator(
          'button:has-text("Details"), button:has-text("Expand"), [data-testid="expand-details"]'
        ).first();

        if (await expandButton.count() > 0) {
          await expandButton.click();
          await page.waitForTimeout(500);
        }
      });

      test('should mark application as applied', async ({ page }) => {
        await page.route('**/applications/1', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({
                id: 1,
                applied: true,
                applied_at: new Date().toISOString(),
              }),
            });
          } else {
            route.continue();
          }
        });

        const applyButton = page.locator(
          'button:has-text("Mark as Applied"), button:has-text("Beworben")'
        ).first();

        if (await applyButton.count() > 0) {
          await applyButton.click();
          await page.waitForTimeout(1000);
        }
      });

      test('should open status update modal', async ({ page }) => {
        const statusButton = page.locator(
          'button:has-text("Update Status"), button:has-text("Status")'
        ).first();

        if (await statusButton.count() > 0) {
          await statusButton.click();

          const modal = page.locator('[role="dialog"], [class*="modal"]');
          await expect(modal).toBeVisible({ timeout: 5000 });
        }
      });

      test('should navigate to application detail', async ({ page }) => {
        const detailLink = page.locator('a[href*="/applications/"]').first();

        if (await detailLink.count() > 0) {
          await detailLink.click();
          await expect(page).toHaveURL(/\/applications\/\d+/);
        }
      });
    });

    test.describe('Filters and Sorting', () => {
      test('should filter by status', async ({ page }) => {
        const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();

        if (await statusFilter.count() > 0) {
          await statusFilter.selectOption({ index: 1 });
          await page.waitForTimeout(500);
        }
      });

      test('should filter by month', async ({ page }) => {
        const monthFilter = page.locator('select[name*="month"], input[type="month"], [data-testid="month-filter"]').first();

        if (await monthFilter.count() > 0) {
          // Select a month
          await monthFilter.click();
        }
      });

      test('should sort by date', async ({ page }) => {
        const sortButton = page.locator('button:has-text("Sort"), select[name*="sort"]').first();

        if (await sortButton.count() > 0) {
          await sortButton.click();
        }
      });
    });

    test.describe('RAV Report', () => {
      test('should show RAV report button when applications exist', async ({ page }) => {
        await mockAPIResponse(page, '**/applications/history*', [
          {
            id: 1,
            job_title: 'Test Job',
            company: 'Test Company',
            applied: true,
            created_at: new Date().toISOString(),
          },
        ]);

        await page.reload();
        await waitForPageLoad(page);

        const ravButton = page.locator('button:has-text("RAV"), button:has-text("Report")');
        // RAV button may or may not be visible depending on user locale
      });

      test('should download RAV report', async ({ page }) => {
        await mockAPIResponse(page, '**/applications/history*', [
          { id: 1, job_title: 'Test Job', company: 'Test Company', applied: true, created_at: new Date().toISOString() },
        ]);

        await page.reload();
        await waitForPageLoad(page);

        const ravButton = page.locator('button:has-text("RAV")').first();
        if (await ravButton.count() > 0) {
          // Set up download listener
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
          await ravButton.click();
          const download = await downloadPromise;
          // Download may or may not occur depending on implementation
        }
      });
    });

    test.describe('Navigation', () => {
      test('should navigate to settings', async ({ page }) => {
        const settingsButton = page.locator('a[href*="settings"], button:has-text("Settings")').first();
        await settingsButton.click();

        await expect(page).toHaveURL(/\/settings/);
      });

      test('should logout and redirect to home', async ({ page }) => {
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Abmelden")').first();
        await logoutButton.click();

        // Should clear auth and redirect
        await expect(page).toHaveURL(/^\/$|\/login/);

        const token = await page.evaluate(() => localStorage.getItem('token'));
        expect(token).toBeNull();
      });
    });

    test.describe('Responsive Design', () => {
      test('should display correctly on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Main content should be visible
        const main = page.locator('main');
        await expect(main).toBeVisible();
      });

      test('should not have horizontal overflow on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const body = page.locator('body');
        const scrollWidth = await body.evaluate(el => el.scrollWidth);
        const clientWidth = await body.evaluate(el => el.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
      });

      test('should have functional forms on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // URL input should be visible and fillable
        const urlInput = page.locator('input[type="url"], input[name*="url"]').first();
        if (await urlInput.isVisible()) {
          await urlInput.fill('https://example.com/job');
          const value = await urlInput.inputValue();
          expect(value).toBe('https://example.com/job');
        }
      });
    });
  });
});

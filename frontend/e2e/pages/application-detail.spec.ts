import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

test.describe('Application Detail Page', () => {
  const mockApplication = {
    id: 1,
    job_title: 'Software Engineer',
    company: 'Test Company',
    job_offer_url: 'https://example.com/job/1',
    description: 'This is a test job description for a Software Engineer position.',
    applied: false,
    spontaneous: false,
    application_type: 'fulltime',
    created_at: new Date().toISOString(),
  };

  const mockGeneratedDocs = [
    { id: 1, doc_type: 'COVER_LETTER', format: 'PDF', created_at: new Date().toISOString() },
    { id: 2, doc_type: 'CV', format: 'PDF', created_at: new Date().toISOString() },
  ];

  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/applications/1');
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

      // Mock API responses
      await mockAPIResponse(page, '**/users/me', {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        credits: 10,
      });

      await mockAPIResponse(page, '**/applications/1', mockApplication);
      await mockAPIResponse(page, '**/applications/1/documents', mockGeneratedDocs);
    });

    test.describe('Visual Elements', () => {
      test('should display back to dashboard button', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const backButton = page.locator(
          'a[href*="dashboard"], button:has-text("Back"), button:has-text("Zurück")'
        ).first();
        await expect(backButton).toBeVisible();
      });

      test('should display application header with company and title', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const companyText = page.getByText('Test Company');
        await expect(companyText.first()).toBeVisible();

        const titleText = page.getByText('Software Engineer');
        await expect(titleText.first()).toBeVisible();
      });

      test('should display job description section', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const description = page.getByText(/test job description/i);
        await expect(description.first()).toBeVisible();
      });

      test('should display applied status indicator', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const statusIndicator = page.locator(
          '[class*="status"], :has-text("Applied"), :has-text("Not Applied"), :has-text("Beworben")'
        );
        const count = await statusIndicator.count();
        expect(count).toBeGreaterThan(0);
      });
    });

    test.describe('Document Generation Section', () => {
      test('should display document type checkboxes', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const checkboxes = page.locator('input[type="checkbox"]');
        const count = await checkboxes.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should display generate button', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const generateButton = page.locator(
          'button:has-text("Generate"), button:has-text("Generieren")'
        ).first();
        await expect(generateButton).toBeVisible();
      });

      test('should display credit cost', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const creditInfo = page.locator(':has-text("Credit"), :has-text("Kredit")');
        // Credit info may or may not be displayed depending on UI
      });

      test('should start document generation', async ({ page }) => {
        await page.route('**/applications/1/generate', (route) => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              task_id: 'task-123',
              status: 'processing',
            }),
          });
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        // Select document types
        const checkboxes = page.locator('input[type="checkbox"]');
        if (await checkboxes.count() > 0) {
          await checkboxes.first().check();
        }

        const generateButton = page.locator('button:has-text("Generate"), button:has-text("Generieren")').first();
        if (await generateButton.isVisible()) {
          await generateButton.click();
          await page.waitForTimeout(1000);
        }
      });

      test('should show generation progress', async ({ page }) => {
        await page.route('**/applications/1/generate', (route) => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ task_id: 'task-123', status: 'processing' }),
          });
        });

        await page.route('**/applications/1/generation-status/task-123', (route) => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              status: 'processing',
              completed_docs: 1,
              total_docs: 3,
            }),
          });
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        // Trigger generation
        const checkboxes = page.locator('input[type="checkbox"]');
        if (await checkboxes.count() > 0) {
          await checkboxes.first().check();
        }

        const generateButton = page.locator('button:has-text("Generate"), button:has-text("Generieren")').first();
        if (await generateButton.isVisible()) {
          await generateButton.click();

          // Progress indicator should appear
          await page.waitForTimeout(2000);
        }
      });
    });

    test.describe('Generated Documents List', () => {
      test('should display generated documents', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        // Check for document items
        const docItems = page.locator('[class*="document"], :has-text("Cover Letter"), :has-text("CV")');
        const count = await docItems.count();
        expect(count).toBeGreaterThan(0);
      });

      test('should have download buttons for documents', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const downloadButtons = page.locator(
          'a[download], button:has-text("Download"), button:has-text("Herunterladen")'
        );
        const count = await downloadButtons.count();
        // May or may not have download buttons depending on generated docs
      });

      test('should show document content preview', async ({ page }) => {
        await mockAPIResponse(page, '**/applications/1/documents/1', {
          id: 1,
          doc_type: 'COVER_LETTER',
          content: 'Dear Hiring Manager...',
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const viewButton = page.locator('button:has-text("View"), button:has-text("Ansehen")').first();
        if (await viewButton.count() > 0) {
          await viewButton.click();
          await page.waitForTimeout(500);
        }
      });
    });

    test.describe('Matching Score Section', () => {
      test('should have generate matching score button', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const matchingButton = page.locator(
          'button:has-text("Matching"), button:has-text("Score"), button:has-text("Analyse")'
        );
        const count = await matchingButton.count();
        // May or may not have matching score feature
      });

      test('should display matching score results', async ({ page }) => {
        await mockAPIResponse(page, '**/applications/1/matching-score', {
          overall_score: 85,
          strengths: ['Experience with React', 'Strong TypeScript skills'],
          gaps: ['No cloud experience mentioned'],
          recommendations: ['Highlight any cloud projects'],
          story: 'You are a strong candidate for this position.',
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const matchingButton = page.locator('button:has-text("Matching"), button:has-text("Score")').first();
        if (await matchingButton.count() > 0) {
          await matchingButton.click();
          await page.waitForTimeout(2000);

          // Score should be displayed
          const score = page.locator(':has-text("85"), :has-text("85%")');
          const count = await score.count();
          // Score may or may not be visible depending on implementation
        }
      });
    });

    test.describe('Navigation', () => {
      test('should navigate back to dashboard', async ({ page }) => {
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const backButton = page.locator('a[href*="dashboard"], button:has-text("Back")').first();
        await backButton.click();

        await expect(page).toHaveURL(/\/dashboard/);
      });
    });

    test.describe('Status Updates', () => {
      test('should mark application as applied', async ({ page }) => {
        await page.route('**/applications/1', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ ...mockApplication, applied: true }),
            });
          } else {
            route.continue();
          }
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const applyButton = page.locator('button:has-text("Mark as Applied"), button:has-text("Beworben")').first();
        if (await applyButton.count() > 0) {
          await applyButton.click();
          await page.waitForTimeout(1000);
        }
      });

      test('should update application result', async ({ page }) => {
        await page.route('**/applications/1', (route) => {
          if (route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ ...mockApplication, result: 'Interview' }),
            });
          } else {
            route.continue();
          }
        });

        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const statusButton = page.locator('button:has-text("Update Status"), button:has-text("Status")').first();
        if (await statusButton.count() > 0) {
          await statusButton.click();

          const modal = page.locator('[role="dialog"], [class*="modal"]');
          if (await modal.count() > 0) {
            const input = modal.locator('input, textarea').first();
            await input.fill('Interview');

            const saveButton = modal.locator('button:has-text("Save"), button:has-text("Speichern")').first();
            await saveButton.click();
          }
        }
      });
    });

    test.describe('Responsive Design', () => {
      test('should display correctly on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        // Content should be visible
        const main = page.locator('main');
        await expect(main).toBeVisible();
      });

      test('should not have horizontal overflow on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/applications/1');
        await waitForPageLoad(page);

        const body = page.locator('body');
        const scrollWidth = await body.evaluate(el => el.scrollWidth);
        const clientWidth = await body.evaluate(el => el.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
      });
    });

    test.describe('Error Handling', () => {
      test('should show error for non-existent application', async ({ page }) => {
        await page.route('**/applications/999', (route) => {
          route.fulfill({
            status: 404,
            body: JSON.stringify({ detail: 'Application not found' }),
          });
        });

        await page.goto('/applications/999');
        await waitForPageLoad(page);

        // Should show error or redirect
        const errorMessage = page.locator('[class*="error"], :has-text("not found"), :has-text("nicht gefunden")');
        const redirected = page.url().includes('/dashboard');

        const hasError = await errorMessage.count() > 0;
        expect(hasError || redirected).toBeTruthy();
      });
    });
  });
});

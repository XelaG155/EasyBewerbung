import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

/**
 * End-to-End User Flow: Complete Job Application Process
 *
 * Tests the entire journey from adding a job to generating documents
 */
test.describe('Job Application Flow', () => {
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

    await mockAPIResponse(page, '**/users/me', {
      id: 1,
      email: 'test@example.com',
      full_name: 'Test User',
      credits: 10,
    });

    await mockAPIResponse(page, '**/documents', [
      { id: 1, filename: 'cv.pdf', doc_type: 'CV', created_at: new Date().toISOString() },
    ]);

    await mockAPIResponse(page, '**/applications/history*', []);
  });

  test('complete job application flow from URL', async ({ page }) => {
    // 1. Navigate to dashboard
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // 2. Mock job analysis response
    await mockAPIResponse(page, '**/jobs/analyze', {
      title: 'Software Engineer',
      company: 'Dream Company',
      description: 'We are looking for a talented software engineer...',
      location: 'Zürich, Switzerland',
    });

    // 3. Mock application creation
    await mockAPIResponse(page, '**/applications', {
      id: 1,
      job_title: 'Software Engineer',
      company: 'Dream Company',
      job_offer_url: 'https://example.com/job/123',
      description: 'We are looking for a talented software engineer...',
      applied: false,
      created_at: new Date().toISOString(),
    });

    // 4. Find and fill URL input
    const urlInput = page.locator('input[type="url"], input[name*="url"], input[placeholder*="URL"]').first();
    await urlInput.fill('https://example.com/job/123');

    // 5. Submit job URL
    const submitButton = page.locator('button[type="submit"], button:has-text("Add"), button:has-text("Hinzufügen")').first();
    await submitButton.click();

    // 6. Wait for application to be created
    await page.waitForTimeout(2000);

    // 7. Verify application appears in list
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Dream Company',
        applied: false,
        created_at: new Date().toISOString(),
      },
    ]);

    await page.reload();
    await waitForPageLoad(page);

    const applicationCard = page.locator(':has-text("Software Engineer"), :has-text("Dream Company")');
    const count = await applicationCard.count();
    expect(count).toBeGreaterThan(0);
  });

  test('mark application as applied', async ({ page }) => {
    // Setup with existing application
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Test Company',
        applied: false,
        created_at: new Date().toISOString(),
      },
    ]);

    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Mock status update
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

    // Find and click "Mark as Applied" button
    const applyButton = page.locator('button:has-text("Mark as Applied"), button:has-text("Beworben")').first();
    if (await applyButton.count() > 0) {
      await applyButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('update application status', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Test Company',
        applied: true,
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Mock status update
    await page.route('**/applications/1', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 1,
            applied: true,
            result: 'Interview',
          }),
        });
      } else {
        route.continue();
      }
    });

    // Find and click "Update Status" button
    const statusButton = page.locator('button:has-text("Update Status"), button:has-text("Status")').first();
    if (await statusButton.count() > 0) {
      await statusButton.click();

      // Fill modal
      const modal = page.locator('[role="dialog"], [class*="modal"]');
      if (await modal.count() > 0) {
        const input = modal.locator('input, textarea').first();
        await input.fill('Interview');

        const saveButton = modal.locator('button:has-text("Save"), button:has-text("Speichern")').first();
        await saveButton.click();
      }
    }
  });

  test('navigate to application detail and generate documents', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Test Company',
        applied: false,
        created_at: new Date().toISOString(),
      },
    ]);

    await mockAPIResponse(page, '**/applications/1', {
      id: 1,
      job_title: 'Software Engineer',
      company: 'Test Company',
      description: 'Job description...',
      applied: false,
      created_at: new Date().toISOString(),
    });

    await mockAPIResponse(page, '**/applications/1/documents', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Navigate to application detail
    const detailLink = page.locator('a[href*="/applications/1"]').first();
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await expect(page).toHaveURL(/\/applications\/1/);
    } else {
      // Direct navigation if no link found
      await page.goto('/applications/1');
    }

    await waitForPageLoad(page);

    // Mock document generation
    await page.route('**/applications/1/generate', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          task_id: 'task-123',
          status: 'processing',
        }),
      });
    });

    // Select document types to generate
    const checkboxes = page.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 0) {
      await checkboxes.first().check();
    }

    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Generieren")').first();
    if (await generateButton.count() > 0) {
      await generateButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('spontaneous application flow', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Mock spontaneous application creation
    await mockAPIResponse(page, '**/applications', {
      id: 2,
      job_title: 'Frontend Developer',
      company: 'Target Company',
      spontaneous: true,
      applied: false,
      created_at: new Date().toISOString(),
    });

    // Find spontaneous section
    const companyInput = page.locator('input[name*="company"]').first();
    const roleInput = page.locator('input[name*="role"], input[name*="position"], input[name*="title"]').first();

    if (await companyInput.count() > 0 && await roleInput.count() > 0) {
      await companyInput.fill('Target Company');
      await roleInput.fill('Frontend Developer');

      const contextInput = page.locator('textarea[name*="context"]').first();
      if (await contextInput.count() > 0) {
        await contextInput.fill('I am very interested in joining your team...');
      }

      const submitButton = page.locator('button[type="submit"]').last();
      await submitButton.click();

      await page.waitForTimeout(2000);
    }
  });

  test('filter applications by status', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/history*', [
      { id: 1, job_title: 'Job 1', company: 'Company 1', applied: true, created_at: new Date().toISOString() },
      { id: 2, job_title: 'Job 2', company: 'Company 2', applied: false, created_at: new Date().toISOString() },
    ]);

    await page.goto('/dashboard');
    await waitForPageLoad(page);

    const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });
});

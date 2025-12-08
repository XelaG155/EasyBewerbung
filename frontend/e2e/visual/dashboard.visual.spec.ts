import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

/**
 * Visual Regression Tests for Dashboard
 */
test.describe('Dashboard Visual Tests', () => {
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
  });

  test('empty state desktop', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('dashboard-empty-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('empty state mobile', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('dashboard-empty-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('with documents desktop', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', [
      { id: 1, filename: 'cv.pdf', doc_type: 'CV', created_at: '2024-01-01T00:00:00Z' },
      { id: 2, filename: 'reference.pdf', doc_type: 'REFERENCE', created_at: '2024-01-01T00:00:00Z' },
    ]);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('dashboard-with-docs-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('with applications desktop', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Test Company',
        applied: true,
        result: 'Interview',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        job_title: 'Frontend Developer',
        company: 'Another Company',
        applied: false,
        created_at: '2024-01-02T00:00:00Z',
      },
    ]);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('dashboard-with-apps-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('with applications mobile', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', [
      {
        id: 1,
        job_title: 'Software Engineer',
        company: 'Test Company',
        applied: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('dashboard-with-apps-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('upload section', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });

    const uploadSection = page.locator('[class*="upload"], form:has(input[type="file"])').first();
    if (await uploadSection.count() > 0) {
      await expect(uploadSection).toHaveScreenshot('dashboard-upload-section.png', {
        animations: 'disabled',
      });
    }
  });

  test('add job section', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });

    const jobSection = page.locator('form:has(input[type="url"])').first();
    if (await jobSection.count() > 0) {
      await expect(jobSection).toHaveScreenshot('dashboard-add-job-section.png', {
        animations: 'disabled',
      });
    }
  });

  test('navigation bar', async ({ page }) => {
    await mockAPIResponse(page, '**/documents', []);
    await mockAPIResponse(page, '**/applications/history*', []);

    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });

    const nav = page.locator('nav, header').first();
    await expect(nav).toHaveScreenshot('dashboard-nav.png', {
      animations: 'disabled',
    });
  });
});

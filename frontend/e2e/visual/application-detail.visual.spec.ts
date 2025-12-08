import { test, expect } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

/**
 * Visual Regression Tests for Application Detail Page
 */
test.describe('Application Detail Visual Tests', () => {
  const mockApplication = {
    id: 1,
    job_title: 'Software Engineer',
    company: 'Test Company',
    job_offer_url: 'https://example.com/job/1',
    description: 'This is a test job description for a Software Engineer position. We are looking for a talented developer to join our team.',
    applied: false,
    spontaneous: false,
    application_type: 'fulltime',
    created_at: '2024-01-01T00:00:00Z',
  };

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

  test('not applied state desktop', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/1', mockApplication);
    await mockAPIResponse(page, '**/applications/1/documents', []);

    await page.goto('/applications/1');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('app-detail-not-applied-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('applied state desktop', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/1', {
      ...mockApplication,
      applied: true,
      applied_at: '2024-01-02T00:00:00Z',
      result: 'Interview',
    });
    await mockAPIResponse(page, '**/applications/1/documents', []);

    await page.goto('/applications/1');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('app-detail-applied-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('with generated documents', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/1', mockApplication);
    await mockAPIResponse(page, '**/applications/1/documents', [
      { id: 1, doc_type: 'COVER_LETTER', format: 'PDF', created_at: '2024-01-01T00:00:00Z' },
      { id: 2, doc_type: 'CV', format: 'PDF', created_at: '2024-01-01T00:00:00Z' },
    ]);

    await page.goto('/applications/1');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('app-detail-with-docs-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile view', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/1', mockApplication);
    await mockAPIResponse(page, '**/applications/1/documents', []);

    await page.goto('/applications/1');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('app-detail-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('spontaneous application', async ({ page }) => {
    await mockAPIResponse(page, '**/applications/1', {
      ...mockApplication,
      spontaneous: true,
      job_offer_url: null,
      opportunity_context: 'I am interested in joining your team as a software engineer.',
    });
    await mockAPIResponse(page, '**/applications/1/documents', []);

    await page.goto('/applications/1');
    await waitForPageLoad(page);
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('app-detail-spontaneous-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

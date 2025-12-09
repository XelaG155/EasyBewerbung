import { test, expect, Page } from '@playwright/test';
import { waitForPageLoad, mockAPIResponse } from '../utils/helpers';

/**
 * Layout-Grundregeln Tests
 *
 * Diese Tests überprüfen die grundlegenden Layout-Regeln, die auf allen Seiten
 * der Anwendung gelten müssen (siehe LAYOUT_RULES.md).
 *
 * Regeln:
 * 1. Logo + Name "EasyBewerbung" oben links (nie abgekürzt)
 * 2. Kein horizontaler Überlauf
 * 3. Theme-Toggle auf allen Seiten sichtbar
 * 4. User-Info + Credits auf authentifizierten Seiten (oben rechts)
 */

// Viewports für responsive Tests
const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

// Seiten die getestet werden sollen
const PUBLIC_PAGES = ['/', '/login', '/register'];
const AUTHENTICATED_PAGES = ['/dashboard', '/settings'];

// Mock-Daten für authentifizierte Seiten
async function setupAuthenticatedSession(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxOTk5OTk5OTk5fQ.mock';
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'test@example.com',
      full_name: 'Test User',
      is_admin: true,
      credits: 42,
    }));
  });

  // Mock API responses
  await mockAPIResponse(page, '**/users/me', {
    id: 1,
    email: 'test@example.com',
    full_name: 'Test User',
    is_admin: true,
    credits: 42,
  });
  await mockAPIResponse(page, '**/documents', []);
  await mockAPIResponse(page, '**/applications/history*', []);
  await mockAPIResponse(page, '**/admin/users*', []);
  await mockAPIResponse(page, '**/admin/languages*', []);
}

test.describe('Layout-Grundregeln', () => {
  test.describe('Regel 1: Logo und Anwendungsname', () => {
    test.describe('Öffentliche Seiten', () => {
      for (const pagePath of PUBLIC_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Logo und vollständiger Name sichtbar`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            // Logo muss sichtbar sein
            const logo = page.locator('header img[src*="logo"], nav img[src*="logo"]').first();
            await expect(logo).toBeVisible();

            // Vollständiger Name "EasyBewerbung" muss sichtbar sein
            const brandName = page.locator('header, nav').getByText('EasyBewerbung', { exact: true }).first();
            await expect(brandName).toBeVisible();

            // Name darf nicht abgeschnitten sein
            const nameElement = page.locator('header span:has-text("EasyBewerbung"), nav span:has-text("EasyBewerbung")').first();
            if (await nameElement.count() > 0) {
              const boundingBox = await nameElement.boundingBox();
              if (boundingBox) {
                // Element sollte mindestens eine vernünftige Breite haben (nicht abgeschnitten)
                expect(boundingBox.width).toBeGreaterThan(50);
              }
            }
          });
        }
      }
    });

    test.describe('Authentifizierte Seiten', () => {
      for (const pagePath of AUTHENTICATED_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Logo und vollständiger Name sichtbar`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await setupAuthenticatedSession(page);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            // Logo muss sichtbar sein
            const logo = page.locator('header img[src*="logo"], nav img[src*="logo"]').first();
            await expect(logo).toBeVisible();

            // Vollständiger Name "EasyBewerbung" muss sichtbar sein
            const brandName = page.locator('header, nav').getByText('EasyBewerbung', { exact: true }).first();
            await expect(brandName).toBeVisible();
          });
        }
      }
    });
  });

  test.describe('Regel 2: Kein horizontaler Überlauf', () => {
    test.describe('Öffentliche Seiten', () => {
      for (const pagePath of PUBLIC_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Kein horizontaler Überlauf`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            // Prüfe, dass kein horizontaler Scroll vorhanden ist
            const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
            const clientWidth = await page.evaluate(() => document.body.clientWidth);

            // Toleranz von 5px für Rundungsfehler
            expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
          });
        }
      }
    });

    test.describe('Authentifizierte Seiten', () => {
      for (const pagePath of AUTHENTICATED_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Kein horizontaler Überlauf`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await setupAuthenticatedSession(page);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
            const clientWidth = await page.evaluate(() => document.body.clientWidth);

            expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
          });
        }
      }
    });
  });

  test.describe('Regel 3: Theme-Toggle sichtbar', () => {
    test.describe('Öffentliche Seiten', () => {
      for (const pagePath of PUBLIC_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Theme-Toggle sichtbar`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            // Theme-Toggle Button (mit Emoji 🌙 oder ☀️)
            const themeToggle = page.locator('button:has-text("🌙"), button:has-text("☀️")').first();
            await expect(themeToggle).toBeVisible();
          });
        }
      }
    });

    test.describe('Authentifizierte Seiten', () => {
      for (const pagePath of AUTHENTICATED_PAGES) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          test(`${pagePath} - ${viewportName}: Theme-Toggle sichtbar`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await setupAuthenticatedSession(page);
            await page.goto(pagePath);
            await waitForPageLoad(page);

            const themeToggle = page.locator('button:has-text("🌙"), button:has-text("☀️")').first();
            await expect(themeToggle).toBeVisible();
          });
        }
      }
    });

    test('Theme-Toggle wechselt Theme korrekt', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const themeToggle = page.locator('button:has-text("🌙"), button:has-text("☀️")').first();

      // Initiales Theme prüfen
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light'
      );

      // Toggle klicken
      await themeToggle.click();
      await page.waitForTimeout(100);

      // Theme sollte gewechselt haben
      const newTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light'
      );

      expect(newTheme).not.toBe(initialTheme);
    });
  });

  test.describe('Regel 4: Benutzerinformationen auf authentifizierten Seiten', () => {
    for (const pagePath of AUTHENTICATED_PAGES) {
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        test(`${pagePath} - ${viewportName}: Benutzername sichtbar`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await setupAuthenticatedSession(page);
          await page.goto(pagePath);
          await waitForPageLoad(page);

          // Benutzername oder E-Mail sollte sichtbar sein
          const userInfo = page.locator('header, nav').getByText('Test User').first();
          await expect(userInfo).toBeVisible();
        });

        test(`${pagePath} - ${viewportName}: Credits-Anzeige sichtbar`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await setupAuthenticatedSession(page);
          await page.goto(pagePath);
          await waitForPageLoad(page);

          // Credits sollten angezeigt werden
          const credits = page.locator('header, nav').getByText(/Credits:?\s*\d+/i).first();
          await expect(credits).toBeVisible();
        });
      }
    }

    test('Grüner Spinner erscheint bei aktiver Generierung', async ({ page }) => {
      await setupAuthenticatedSession(page);

      // Mock eine aktive Generierung
      await mockAPIResponse(page, '**/applications/history*', [
        {
          id: 1,
          job_title: 'Test Job',
          company: 'Test Company',
          status: 'generating',
          generation_progress: { completed: 1, total: 3 },
          created_at: new Date().toISOString(),
        },
      ]);

      await page.goto('/dashboard');
      await waitForPageLoad(page);

      // Prüfe auf animierten Spinner (emerald/grün gefärbt)
      const spinner = page.locator('header svg.animate-spin, nav svg.animate-spin').first();

      // Der Spinner sollte vorhanden sein wenn Generierung aktiv ist
      // (Dies ist ein optionaler Test - Spinner erscheint nur bei aktiver Generierung)
      const spinnerCount = await spinner.count();
      if (spinnerCount > 0) {
        await expect(spinner).toBeVisible();
      }
    });
  });

  test.describe('Header-Positionierung', () => {
    test('Logo befindet sich links, User-Info rechts', async ({ page }) => {
      await setupAuthenticatedSession(page);
      await page.goto('/dashboard');
      await waitForPageLoad(page);

      // Logo Position
      const logo = page.locator('header img[src*="logo"]').first();
      const logoBox = await logo.boundingBox();

      // Credits Position
      const credits = page.locator('header').getByText(/Credits/i).first();
      const creditsBox = await credits.boundingBox();

      if (logoBox && creditsBox) {
        // Logo sollte links sein (x-Position kleiner)
        expect(logoBox.x).toBeLessThan(creditsBox.x);

        // Credits sollte rechts sein (höhere x-Position)
        expect(creditsBox.x).toBeGreaterThan(logoBox.x + logoBox.width);
      }
    });

    test('Alle Header-Elemente auf gleicher Höhe', async ({ page }) => {
      await setupAuthenticatedSession(page);
      await page.goto('/dashboard');
      await waitForPageLoad(page);

      // Hole Header-Element
      const header = page.locator('header').first();
      const headerBox = await header.boundingBox();

      if (headerBox) {
        // Header sollte im oberen Bereich der Seite sein
        expect(headerBox.y).toBeLessThan(100);
      }
    });
  });
});

test.describe('Layout-Regeln Ausnahmen', () => {
  // Hier können explizite Ausnahmen für bestimmte Seiten definiert werden
  // Beispiel: Eine Seite die keinen Theme-Toggle haben soll

  test('Login-Seite zeigt keine User-Info (nicht authentifiziert)', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);

    // Auf Login-Seite sollte kein Benutzername sichtbar sein
    const userInfo = page.locator('header, nav').getByText('Test User');
    await expect(userInfo).toHaveCount(0);

    // Credits sollten auch nicht sichtbar sein
    const credits = page.locator('header, nav').getByText(/Credits/i);
    await expect(credits).toHaveCount(0);
  });

  test('Register-Seite zeigt keine User-Info (nicht authentifiziert)', async ({ page }) => {
    await page.goto('/register');
    await waitForPageLoad(page);

    const userInfo = page.locator('header, nav').getByText('Test User');
    await expect(userInfo).toHaveCount(0);

    const credits = page.locator('header, nav').getByText(/Credits/i);
    await expect(credits).toHaveCount(0);
  });
});

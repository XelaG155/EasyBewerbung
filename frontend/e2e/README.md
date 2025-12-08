# EasyBewerbung E2E Tests

Automatisierte End-to-End Tests mit Playwright zur Sicherstellung der Applikationsqualität.

## Übersicht

Diese Test-Suite enthält:
- **Funktionale Tests** für jede Seite der Applikation
- **Visual Regression Tests** für Screenshot-Vergleiche
- **User Flow Tests** für komplette Benutzer-Journeys

## Installation

```bash
# Im frontend Verzeichnis
npm install

# Browser installieren (einmalig)
npx playwright install
```

## Tests ausführen

### Alle E2E Tests
```bash
npm run test:e2e
```

### Mit Browser UI (empfohlen für Debugging)
```bash
npm run test:e2e:ui
```

### Visual Regression Tests
```bash
npm run test:visual
```

### Baselines aktualisieren (nach beabsichtigten visuellen Änderungen)
```bash
npm run test:visual:update
```

### Mobile Tests
```bash
npm run test:mobile
```

### Test Report anzeigen
```bash
npm run test:report
```

## Test-Struktur

```
e2e/
├── fixtures/           # Test-Fixtures und Authentifizierungs-Helfer
├── pages/              # Seiten-spezifische Tests
│   ├── landing.spec.ts       # Landing Page Tests
│   ├── login.spec.ts         # Login Tests
│   ├── register.spec.ts      # Registrierung Tests
│   ├── dashboard.spec.ts     # Dashboard Tests
│   ├── application-detail.spec.ts  # Application Detail Tests
│   ├── settings.spec.ts      # Settings Tests
│   └── admin.spec.ts         # Admin Tests
├── flows/              # User Flow Tests
│   ├── registration-flow.spec.ts
│   ├── job-application-flow.spec.ts
│   └── document-generation-flow.spec.ts
├── visual/             # Visual Regression Tests
│   ├── landing.visual.spec.ts
│   ├── auth.visual.spec.ts
│   ├── dashboard.visual.spec.ts
│   ├── settings.visual.spec.ts
│   └── application-detail.visual.spec.ts
├── utils/              # Hilfs-Funktionen
│   └── helpers.ts
├── README.md
└── TEST_SPECIFICATION.md  # Vollständige Test-Spezifikation
```

## Wann Tests ausführen?

**WICHTIG:** Tests sollten nach JEDER Änderung am Code ausgeführt werden!

### Empfohlener Workflow

1. **Vor dem Commit:**
   ```bash
   npm run test:e2e
   ```

2. **Nach visuellen Änderungen:**
   ```bash
   npm run test:visual
   # Bei gewollten Änderungen:
   npm run test:visual:update
   ```

3. **Bei Responsive-Änderungen:**
   ```bash
   npm run test:mobile
   ```

## Was wird getestet?

### Seiten-Tests (pages/)
- Alle visuellen Elemente vorhanden
- Formulare funktionieren
- Navigation funktioniert
- Responsive Design (Desktop, Tablet, Mobile)
- Error States

### Flow-Tests (flows/)
- Kompletter Registrierungsprozess
- Bewerbungsprozess von URL-Eingabe bis Dokument-Generierung
- Dokument-Generierung mit Progress-Tracking

### Visual Tests (visual/)
- Screenshots werden mit Baselines verglichen
- Desktop, Tablet und Mobile Views
- Dark/Light Mode

## Neue Tests hinzufügen

### Für eine neue Seite
1. Erstelle `e2e/pages/[pagename].spec.ts`
2. Erstelle `e2e/visual/[pagename].visual.spec.ts`
3. Aktualisiere `TEST_SPECIFICATION.md`

### Für einen neuen User Flow
1. Erstelle `e2e/flows/[flowname]-flow.spec.ts`

## Fehlerbehebung

### Tests schlagen fehl wegen Visual Differences
1. Prüfen ob die Änderung beabsichtigt war
2. Wenn ja: `npm run test:visual:update`
3. Wenn nein: Bug fixen

### Browser nicht gefunden
```bash
npx playwright install chromium
```

### Tests zu langsam
```bash
# Parallel ausführen
npx playwright test --workers=4
```

## Hilfreiche Befehle

```bash
# Einzelnen Test ausführen
npx playwright test landing.spec.ts

# Test mit spezifischem Namen
npx playwright test -g "should display login form"

# Nur fehlgeschlagene Tests erneut ausführen
npx playwright test --last-failed

# Test im Debug-Modus
npx playwright test --debug
```

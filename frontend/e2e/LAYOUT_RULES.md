# EasyBewerbung - Layout-Grundregeln

Diese Grundregeln gelten für **alle Seiten** der Anwendung, sofern sie nicht explizit für eine bestimmte Seite ausser Kraft gesetzt werden.

---

## 1. Logo und Anwendungsname

### Regel
- Das **Logo** und der **vollständige Anwendungsname "EasyBewerbung"** müssen **immer oben links** sichtbar sein.
- Der Name darf **niemals abgekürzt** werden (z.B. nicht "EB" oder "Easy...").
- Das Logo ist ein 8x8 abgerundetes Bild (`/logo.png`).

### Gültigkeitsbereich
- Alle Seiten
- Alle Bildschirmgrössen (Desktop, Tablet, Mobile)

### Testkriterien
- [ ] Logo-Element ist sichtbar
- [ ] Text "EasyBewerbung" ist vollständig sichtbar und nicht abgeschnitten
- [ ] Logo befindet sich im Header-Bereich

---

## 2. Responsive Design - Kein Überlauf

### Regel
- Der Seiteninhalt darf **niemals über den rechten Bildschirmrand hinausragen**.
- Es darf **keine horizontale Scrollbar** geben (ausser bei spezifischen Inhalten wie Code-Blöcken).

### Gültigkeitsbereich
- Alle Seiten
- Alle Bildschirmgrössen

### Testkriterien
- [ ] `document.body.scrollWidth <= document.body.clientWidth`
- [ ] Keine horizontale Scrollbar sichtbar

---

## 3. Theme-Toggle (Hell/Dunkel)

### Regel
- Der **Theme-Toggle** (Wechsel zwischen Hell- und Dunkelmodus) muss auf **allen Seiten** sichtbar und funktionsfähig sein.
- Darstellung: Emoji-Icon (🌙 für Hellmodus / ☀️ für Dunkelmodus)

### Gültigkeitsbereich
- Alle Seiten
- Alle Bildschirmgrössen

### Testkriterien
- [ ] Theme-Toggle-Button ist sichtbar
- [ ] Klick wechselt das Theme
- [ ] Theme-Präferenz wird gespeichert

---

## 4. Benutzerinformationen (authentifizierte Seiten)

### Regel
Auf allen **authentifizierten Seiten** müssen **oben rechts** folgende Elemente sichtbar sein:

1. **Benutzername** oder E-Mail-Adresse
2. **Grüner Kreis/Spinner** (wenn Dokumente im Hintergrund generiert werden)
3. **Credits-Anzeige** (z.B. "Credits: 10")

### Gültigkeitsbereich
- Dashboard (`/dashboard`)
- Application Detail (`/applications/[id]`)
- Settings (`/settings`)
- Admin-Seiten (`/admin`, `/admin/documents`)

### Ausnahmen
- Landing Page (`/`) - zeigt keine Benutzerinformationen (nicht authentifiziert)
- Login/Register-Seiten - zeigt keine Benutzerinformationen

### Testkriterien
- [ ] Benutzername oder E-Mail ist sichtbar
- [ ] Credits-Badge ist sichtbar und zeigt Zahl an
- [ ] Grüner Spinner erscheint bei aktiven Hintergrundprozessen
- [ ] Alle Elemente befinden sich im Header-Bereich (oben rechts)

---

## 5. Zusammenfassung der Regeln pro Seitentyp

| Seite | Logo + Name | Theme-Toggle | User-Info + Credits |
|-------|-------------|--------------|---------------------|
| Landing (`/`) | ✅ | ✅ | ❌ |
| Login (`/login`) | ✅ | ✅ | ❌ |
| Register (`/register`) | ✅ | ✅ | ❌ |
| Dashboard (`/dashboard`) | ✅ | ✅ | ✅ |
| Application Detail | ✅ | ✅ | ✅ |
| Settings (`/settings`) | ✅ | ✅ | ✅ |
| Admin-Seiten | ✅ | ✅ | ✅ |

---

## 6. Ausnahmen definieren

Um eine Regel für eine bestimmte Seite auszusetzen, muss dies explizit in den Tests dokumentiert werden:

```typescript
// Beispiel: Theme-Toggle auf spezifischer Seite aussetzen
const THEME_TOGGLE_EXCEPTIONS = ['/some-special-page'];
```

---

## 7. Technische Implementation

### HTML-Struktur (erwartet)

```html
<header>
  <!-- Links: Logo + Name -->
  <div class="flex items-center gap-2">
    <img src="/logo.png" alt="EasyBewerbung" />
    <span>EasyBewerbung</span>
  </div>

  <!-- Rechts: User-Info, Credits, Theme-Toggle -->
  <div class="flex items-center gap-2">
    <span>{user.full_name || user.email}</span>
    <!-- Grüner Spinner (wenn aktiv) -->
    <svg class="animate-spin text-emerald-400">...</svg>
    <span>Credits: {user.credits}</span>
    <button>{theme === "light" ? "🌙" : "☀️"}</button>
  </div>
</header>
```

---

## 8. Test-Ausführung

Die Layout-Grundregeln werden automatisch in den E2E-Tests überprüft:

```bash
# Nur Layout-Tests ausführen
npm run test:e2e -- e2e/layout/

# Alle Tests inkl. Layout-Regeln
npm run test:e2e
```

---

## Änderungshistorie

| Datum | Version | Änderung |
|-------|---------|----------|
| 2025-12-09 | 1.0 | Initiale Erstellung der Layout-Grundregeln |

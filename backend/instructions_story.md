# EasyBewerbung - Artefakt-Dokumentation

Diese Datei dokumentiert alle Artefakte (generierte Dokumente), die das EasyBewerbung-System für Bewerbungen erstellt.

## Übersicht der Spracheinstellungen

Bei jeder Bewerbung werden drei Spracheinstellungen verwendet:

1. **UI Language** (`ui_language`): Die Sprache, in der der Benutzer die Plattform navigiert
2. **Documentation Language** (`documentation_language`): Die Zielsprache für alle generierten Bewerbungsdokumente (CV, Motivationsschreiben, etc.)
3. **Company Profile Language** (`company_profile_language`): Die Sprache für das Firmenprofil-Briefing

Die **Documentation Language** wird für die meisten generierten Dokumente verwendet und basiert auf:
- Der vom Benutzer gewählten Sprache für Dokumente
- Fallback: Die in den Benutzereinstellungen hinterlegte `documentation_language`
- Fallback: Die bevorzugte Sprache des Benutzers (`preferred_language`)

---

## Essential Pack (Basis-Paket)

Diese Dokumente bilden die Grundlage jeder Bewerbung.

### 1. Tailored CV (ATS-friendly PDF)
**Technischer Schlüssel:** `tailored_cv_pdf`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Ein auf die spezifische Stellenausschreibung angepasster Lebenslauf, der für ATS (Applicant Tracking Systems) optimiert ist. Enthält:
- Klare Überschriften und Strukturierung für automatisches Parsing
- Faktische Ausrichtung auf die Anforderungen des Stellenangebots
- Markierungen der angepassten Abschnitte

**Ziel:**
Maximale Kompatibilität mit automatisierten Bewerbungssystemen und hohe Relevanz für die ausgeschriebene Stelle.

**Warum wichtig:**
Viele Unternehmen verwenden ATS-Software, die Bewerbungen vor menschlicher Prüfung automatisch filtert. Ein ATS-freundlicher CV erhöht die Chance, dass die Bewerbung einen Recruiter erreicht. Die spezifische Anpassung zeigt dem Arbeitgeber, dass der Kandidat die Stellenanforderungen ernst nimmt.

---

### 2. Tailored CV (Editable)
**Technischer Schlüssel:** `tailored_cv_editable`
**Format:** DOCX
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Bearbeitbare Version des angepassten Lebenslaufs mit:
- Kommentaren, die jede Anpassung erklären
- Möglichkeit für Last-Minute-Änderungen
- Gleicher Inhalt wie die PDF-Version

**Ziel:**
Dem Bewerber Flexibilität geben, letzte Anpassungen vorzunehmen oder spezifische Details hinzuzufügen.

**Warum wichtig:**
Nicht jede Bewerbung ist identisch. Manchmal erfährt der Bewerber zusätzliche Details über die Stelle oder möchte persönliche Nuancen hinzufügen. Die DOCX-Version ermöglicht schnelle Anpassungen ohne Neugenerierung.

---

### 3. Tailored CV (1-page)
**Technischer Schlüssel:** `tailored_cv_one_page`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Kompakte, einseitige CV-Variante die:
- Nur die relevanteste Erfahrung und Fähigkeiten hervorhebt
- Für Positionen geeignet ist, die kurze Bewerbungen erfordern
- Konzentriert und prägnant formuliert ist

**Ziel:**
Bereitstellung einer Option für Stellenausschreibungen, die explizit kurze Bewerbungen verlangen, oder für Situationen, in denen ein schneller Überblick wichtiger ist als Details.

**Warum wichtig:**
Manche Recruiter haben wenig Zeit oder bevorzugen kompakte Darstellungen. Eine einseitige Version zeigt, dass der Kandidat die wichtigsten Qualifikationen priorisieren kann - eine wertvolle Fähigkeit in vielen Berufen.

---

### 4. Motivational Letter (PDF)
**Technischer Schlüssel:** `motivational_letter_pdf`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Ein regionen-konformes Motivationsschreiben (DE/CH/FR-freundlich), das:
- Fakten aus dem Kandidatenprofil nutzt
- 1-2 unternehmensspezifische Punkte enthält
- Auf die Stellenausschreibung zugeschnitten ist

**Ziel:**
Eine überzeugende, persönliche Verbindung zwischen dem Kandidaten und der ausgeschriebenen Stelle herzustellen.

**Warum wichtig:**
Ein Motivationsschreiben ist oft die einzige Gelegenheit, Persönlichkeit und Motivation zu zeigen, die über den CV hinausgehen. Es kann entscheidend sein, besonders in kompetitiven Märkten oder bei Kandidaten mit unkonventionellen Profilen.

---

### 5. Motivational Letter (Editable)
**Technischer Schlüssel:** `motivational_letter_editable`
**Format:** DOCX
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Bearbeitbare Version des Motivationsschreibens mit:
- Gleichem Inhalt wie die PDF-Version
- Möglichkeit für individuelle Anpassungen
- Formatierung für einfache Bearbeitung

**Ziel:**
Dem Bewerber die Möglichkeit geben, persönliche Details oder spezifische Erfahrungen hinzuzufügen.

**Warum wichtig:**
Motivationsschreiben sind sehr persönlich. Die Möglichkeit, den generierten Text anzupassen, ermöglicht es dem Bewerber, authentischer zu kommunizieren und spontane Gedanken zu integrieren.

---

### 6. Email / Accompanying Message (formal)
**Technischer Schlüssel:** `email_formal`
**Format:** Text
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Formale E-Mail-Vorlage für die Bewerbungseinreichung mit:
- Professioneller Begrüßung
- Kurzer, prägnanter Pitch
- Verweise auf Anhänge

**Ziel:**
Eine professionelle erste Kontaktaufnahme mit dem potentiellen Arbeitgeber.

**Warum wichtig:**
Die Begleit-E-Mail ist oft der erste Text, den ein Recruiter liest. Eine professionelle, klare E-Mail signalisiert Kompetenz und Aufmerksamkeit für Details. Viele Bewerber unterschätzen diesen ersten Eindruck.

---

### 7. LinkedIn DM Message
**Technischer Schlüssel:** `email_linkedin`
**Format:** Text
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Kurze Recruiter-Ansprache, die:
- Auf die Stellenausschreibung zugeschnitten ist
- Für Kürze und Klarheit in LinkedIn-Nachrichten optimiert ist
- Einen prägnanten Pitch enthält

**Ziel:**
Direkte Kontaktaufnahme mit Recruitern oder Hiring Managern über LinkedIn.

**Warum wichtig:**
LinkedIn ist ein wichtiger Kanal für Job-Networking. Eine gut formulierte DM kann Türen öffnen, besonders wenn die offizielle Bewerbung in einem großen Pool untergeht. Sie zeigt Eigeninitiative und direkte Kommunikationsfähigkeit.

---

### 8. Match Score Report
**Technischer Schlüssel:** `match_score_report`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
ATS-Style Scorecard mit:
- Stärken des Kandidaten in Bezug auf die Stelle
- Identifizierten Lücken
- Vorgeschlagenen Verbesserungen

**Ziel:**
Dem Bewerber eine objektive Einschätzung seiner Eignung für die Stelle zu geben und Transparenz zu schaffen.

**Warum wichtig:**
Dieser Report baut Vertrauen auf, indem er ehrlich sowohl Stärken als auch Schwächen aufzeigt. Er hilft dem Bewerber, realistische Erwartungen zu haben und sich gezielt auf Schwachstellen vorzubereiten. Transparenz ist der Schlüssel zu langfristiger Kundenbindung.

---

## High Impact Add-ons (Erweiterte Dokumente)

Diese Dokumente bieten zusätzlichen Wert für professionellere Bewerbungen.

### 9. Company Intelligence Briefing
**Technischer Schlüssel:** `company_intelligence_briefing`
**Format:** PDF
**Verwendete Sprache:** `company_profile_language`

**Inhalt:**
1-2 Seiten Brief mit:
- Unternehmensübersicht
- Kultursignale
- Strategische Gesprächspunkte
- Leichtgewichtige SWOT-Analyse
- Einstellungsmuster

**Ziel:**
Den Bewerber mit relevantem Hintergrundwissen über das Unternehmen auszustatten, um in Gesprächen kompetent und vorbereitet zu wirken.

**Warum wichtig:**
Hiring Manager schätzen Kandidaten, die sich mit dem Unternehmen auseinandergesetzt haben. Dieses Briefing gibt dem Bewerber einen Informationsvorsprung und zeigt echtes Interesse. Es kann der Unterschied zwischen einem generischen und einem überzeugenden Gespräch sein.

---

### 10. Interview Preparation Pack
**Technischer Schlüssel:** `interview_preparation_pack`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Umfassendes Vorbereitungspaket mit:
- Wahrscheinlichen Interview-Fragen
- Maßgeschneiderten Antworten
- STAR-Beispielen (Situation, Task, Action, Result)
- 30-Sekunden-Pitch
- Spickzettel für die Vorbereitung am Tag des Interviews

**Ziel:**
Den Bewerber optimal auf das Vorstellungsgespräch vorzubereiten und Nervosität durch Vorbereitung zu reduzieren.

**Warum wichtig:**
Viele qualifizierte Kandidaten scheitern an Interviews wegen mangelnder Vorbereitung oder Nervosität. Dieses Paket gibt eine strukturierte Vorbereitung und erhöht die Erfolgschancen dramatisch. STAR-Beispiele sind besonders in Behavioral Interviews wertvoll.

---

### 11. Role-Specific Portfolio Page
**Technischer Schlüssel:** `role_specific_portfolio`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Einseitige Portfolio-Darstellung mit:
- Erfolgen, die auf die Stellenanforderungen abgestimmt sind
- Messbare Ergebnisse und Projekte
- Visuelle Aufbereitung für schnelle Erfassung

**Ziel:**
Konkrete Beweise für Kompetenz und Erfolg in einem leicht verdaulichen Format liefern.

**Warum wichtig:**
Besonders in Tech-, Marketing-, HR- und Consulting-Rollen werden greifbare Erfolge geschätzt. Eine Portfolio-Seite macht Leistungen sichtbar und unterscheidet den Kandidaten von anderen, die nur allgemeine Beschreibungen liefern.

---

### 12. LinkedIn Optimization Output
**Technischer Schlüssel:** `linkedin_optimization`
**Format:** Text
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Optimierungsvorschläge für LinkedIn-Profil:
- Aktualisierter "About"-Bereich
- Vorgeschlagene Job-Titel
- Keywords für bessere Auffindbarkeit

**Ziel:**
Die Sichtbarkeit des Kandidaten für Recruiter auf LinkedIn zu erhöhen.

**Warum wichtig:**
LinkedIn ist eine der wichtigsten Plattformen für professionelles Networking und Jobsuche. Ein optimiertes Profil erhöht die Chance, dass Recruiter den Kandidaten proaktiv kontaktieren. Keywords und Titel sind entscheidend für die Suchalgorithmen.

---

## Premium Documents (Premium-Dokumente)

Diese Dokumente richten sich an Senior-Positionen, Manager und spezialisierte Rollen.

### 13. Executive Summary / Personal Profile
**Technischer Schlüssel:** `executive_summary`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Einseitige Karrieregeschichte mit:
- Wertversprechen
- Wichtigsten Erfolgen
- QR-Code-Platzhalter für Portfolio oder LinkedIn
- Professionellem Layout

**Ziel:**
Eine kompakte, überzeugende Darstellung der Karriere für Senior- und Executive-Positionen.

**Warum wichtig:**
Bei höheren Positionen zählen strategische Erfolge und Führungserfahrung mehr als technische Details. Ein Executive Summary zeigt auf einen Blick den Wert, den ein Senior-Kandidat einem Unternehmen bringen kann. Es ist ideal für Networking-Events und Top-Level-Bewerbungen.

---

### 14. Skill Gap & Upskilling Recommendation Report
**Technischer Schlüssel:** `skill_gap_report`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Detaillierte Analyse mit:
- Identifizierten fehlenden Fähigkeiten
- Priorisierung nach Wichtigkeit
- Vorgeschlagenen Kursen und Zertifizierungen
- Lernpfaden

**Ziel:**
Dem Bewerber einen klaren Entwicklungsplan zu geben, um Qualifikationslücken zu schließen.

**Warum wichtig:**
Dieser Report positioniert EasyBewerbung als langfristigen Partner in der Karriereentwicklung, nicht nur als einmaliges Tool. Er zeigt dem Kandidaten konkrete Schritte zur Verbesserung und stärkt die Kundenbindung. Bewerber, die gezielt an Lücken arbeiten, sind bei der nächsten Bewerbung erfolgreicher.

---

### 15. AI-Verified Reference Summary
**Technischer Schlüssel:** `reference_summary`
**Format:** PDF
**Verwendete Sprache:** `documentation_language`

**Inhalt:**
Konsolidierte Zusammenfassung mit:
- Stärken, die aus Referenzschreiben extrahiert wurden
- Optionaler Empfehlungszeile
- Verifizierungshinweis
- Strukturierter Darstellung

**Ziel:**
Referenzen in einem professionellen, verifizierten Format bereitzustellen, das Vertrauen schafft.

**Warum wichtig:**
Referenzen sind oft schwer zu überprüfen und werden von Recruitern skeptisch betrachtet. Eine AI-verifizierte Zusammenfassung zeigt Professionalität und macht Referenzen leichter verdaulich. Dies ist ein Differentiator, der EasyBewerbung von Konkurrenten abhebt und Vertrauen beim Arbeitgeber aufbaut.

---

## Spracheinstellungen - Verwendungsübersicht

| Artefakt | Verwendete Sprache |
|----------|-------------------|
| Tailored CV (PDF) | `documentation_language` |
| Tailored CV (Editable) | `documentation_language` |
| Tailored CV (1-page) | `documentation_language` |
| Motivational Letter (PDF) | `documentation_language` |
| Motivational Letter (Editable) | `documentation_language` |
| Email (formal) | `documentation_language` |
| LinkedIn DM | `documentation_language` |
| Match Score Report | `documentation_language` |
| Company Intelligence Briefing | `company_profile_language` |
| Interview Preparation Pack | `documentation_language` |
| Role-Specific Portfolio | `documentation_language` |
| LinkedIn Optimization | `documentation_language` |
| Executive Summary | `documentation_language` |
| Skill Gap Report | `documentation_language` |
| Reference Summary | `documentation_language` |

**Hinweis:** Die `ui_language` wird für die Benutzeroberfläche verwendet, beeinflusst aber nicht den Inhalt der generierten Dokumente.

---

## Pakete

### Basic Pack
**Credit-Band:** Low
**Enthält:**
- Tailored CV (PDF)
- Motivational Letter (PDF)
- Email (formal)

**Beschreibung:** Grundlage für jede Bewerbung mit den essentiellen Dokumenten.

---

### Professional Pack
**Credit-Band:** Medium
**Enthält:**
- Tailored CV (PDF)
- Tailored CV (Editable)
- Motivational Letter (PDF)
- Email (formal)
- Match Score Report
- Company Intelligence Briefing

**Beschreibung:** Erweiterte Bewerbung mit bearbeitbarem CV, Matching-Analyse und Unternehmens-Briefing.

---

### Premium Pack
**Credit-Band:** High
**Enthält:**
- Tailored CV (PDF)
- Tailored CV (Editable)
- Tailored CV (1-page)
- Motivational Letter (PDF)
- Email (formal)
- Match Score Report
- Company Intelligence Briefing
- Interview Preparation Pack
- Skill Gap Report
- Executive Summary
- LinkedIn Optimization

**Beschreibung:** Vollständige Suite mit Interview-Vorbereitung, Skill-Gap-Analyse, Executive Summary und LinkedIn-Optimierung.

---

## Technische Implementation

Alle Dokumente werden asynchron im Hintergrund generiert durch:
- `generate_documents_background()` Funktion
- OpenAI API für Content-Generierung
- Sprach-spezifische Prompts basierend auf `documentation_language`
- Speicherung im Dateisystem unter `storage/generated_documents/`

Die Generierung folgt diesem Ablauf:
1. Benutzer wählt Dokumente zur Generierung
2. Background Task wird gestartet
3. Für jeden Dokumenttyp wird ein OpenAI-Prompt erstellt
4. Dokument wird generiert und gespeichert
5. Eintrag in der Datenbank wird aktualisiert
6. Benutzer kann Dokumente herunterladen

---

*Diese Dokumentation wird fortlaufend aktualisiert, wenn neue Artefakte hinzugefügt werden.*

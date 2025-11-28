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
3. Für jeden Dokumenttyp wird ein OpenAI-Prompt erstellt (JSON-basiert)
4. Dokument wird generiert und gespeichert
5. Eintrag in der Datenbank wird aktualisiert
6. Benutzer kann Dokumente herunterladen

---

## JSON-basierte Prompt-Struktur

Alle Dokumentengenerierungs-Prompts sind in einer strukturierten JSON-Datei definiert: `app/document_prompts.json`

### Prompt-Anatomie

Jeder Dokumenttyp hat folgende Struktur:

```json
{
  "document_type": "string",           // Technischer Schlüssel
  "role": "string",                    // Rolle der KI (z.B. "professional CV writer")
  "task": "string",                    // Hauptaufgabe
  "inputs": ["array"],                 // Benötigte Input-Variablen
  "instructions": ["array"],           // Schritt-für-Schritt Anweisungen
  "output_format": "string",           // Erwartetes Ausgabeformat
  "length_guideline": "string",        // Längenvorgabe
  "prompt_template": "string"          // Vollständiger Prompt-Template
}
```

### Spracheinstellungen in Prompts

Die Prompts respektieren automatisch die gewünschte Output-Sprache:
- Für **alle Dokumente außer Company Intelligence Briefing**: `documentation_language`
- Für **Company Intelligence Briefing**: `company_profile_language`

Die Sprachanweisung wird dynamisch in den Prompt eingefügt:
```
Language: {language}
```

**Beispiel:** Wenn `documentation_language = "Tigrinya"`, dann enthält der generierte Prompt:
```
Language: Tigrinya
```

Die KI generiert dann das Dokument vollständig in Tigrinya.

### Prompt-Template Variablen

Verfügbare Variablen in allen Templates:
- `{role}` - Die Rolle der KI
- `{task}` - Die Hauptaufgabe
- `{job_description}` - Stellenbeschreibung
- `{cv_text}` - Vollständiger CV-Text
- `{cv_summary}` - Kurzfassung des CVs (erste 500 Zeichen)
- `{language}` - Zielsprache für Dokumentengenerierung
- `{company_profile_language}` - Sprache für Unternehmensprofil
- `{instructions}` - Formatierte Liste aller Anweisungen

### Beispiel: Motivational Letter Prompt

```json
{
  "document_type": "motivational_letter_pdf",
  "role": "professional career counselor",
  "task": "Write a motivational letter for this job application",
  "inputs": ["job_description", "cv_text", "language"],
  "instructions": [
    "Output ONLY the motivational letter content",
    "Start directly with the letter",
    "Use facts from the candidate's CV only",
    "Write a formal, compelling letter",
    "Include proper letter formatting",
    "Keep it concise (typically 1 page)"
  ],
  "output_format": "Direct letter content with proper formatting",
  "length_guideline": "1 page",
  "prompt_template": "You are a {role}. {task}.\n\nJob Details:\n{job_description}\n\nCandidate CV:\n{cv_text}\n\nLanguage: {language}\n\nIMPORTANT INSTRUCTIONS:\n{instructions}\n\nBegin the motivational letter now:"
}
```

**Generierter Prompt (Beispiel für Tigrinya):**
```
You are a professional career counselor. Write a motivational letter for this job application.

Job Details:
[Stellenbeschreibung hier]

Candidate CV:
[CV-Text hier]

Language: Tigrinya

IMPORTANT INSTRUCTIONS:
1. Output ONLY the motivational letter content
2. Start directly with the letter
3. Use facts from the candidate's CV only
4. Write a formal, compelling letter
5. Include proper letter formatting
6. Keep it concise (typically 1 page)

Begin the motivational letter now:
```

Die KI erhält diesen Prompt und generiert dann das Motivationsschreiben **vollständig in Tigrinya**.

### Mehrsprachigkeit: Funktionsweise

**Aktueller Ansatz:**
- Prompt-Sprache: **Englisch** (fix)
- Output-Sprache: **Variabel** (basierend auf Benutzerauswahl)
- Die KI versteht die englischen Anweisungen und generiert Output in der angegebenen Sprache

**Beispiel-Workflow:**
1. Benutzer wählt: `documentation_language = "Deutsch"`
2. System erstellt Prompt mit: `Language: Deutsch`
3. KI erhält englische Anweisungen + Sprachanweisung "Deutsch"
4. KI generiert: **Deutsches** Motivationsschreiben

**Unterstützte Sprachen:**
Alle 46 aktiven Sprachen in der Datenbank werden unterstützt. Die KI (OpenAI GPT-4) beherrscht alle diese Sprachen nativ.

### Prompt-Verwaltung

**Datei-Location:**
```
backend/app/document_prompts.json
```

**Änderungen vornehmen:**
1. JSON-Datei editieren
2. Backend neu starten (PM2 restart)
3. Änderungen sind sofort aktiv

**Neue Dokumenttypen hinzufügen:**
1. Eintrag in `document_prompts.json` erstellen
2. Dokumenttyp in `document_catalog.py` registrieren
3. Backend neu starten

---

## ATS-Optimierung & Ehrlichkeitsgarantie

### Was sind ATS-Systeme?

**Applicant Tracking Systems (ATS)** sind Software-Lösungen, die von 97.8% der Fortune 500 Unternehmen und 75% aller Firmen weltweit verwendet werden, um Bewerbungen automatisch zu filtern und zu ranken.

**Typische ATS-Pipeline:**
1. **Ingestion:** PDF/DOCX → Textextraktion
2. **Parsing:** Erkennung von Struktur (Name, Kontakt, Erfahrung, Skills, Ausbildung)
3. **Normalisierung:** Skill-Taxonomie, Synonyme zusammenführen (z.B. "JS", "JavaScript" → ein Skill)
4. **Matching:** Keyword-Matching, TF-IDF, Deep Learning (BERT-Embeddings)
5. **Scoring:** Ranking der Kandidaten nach Match-Score
6. **Filtering:** Hard Filters für Must-Have Requirements

**Wichtige Erkenntnis:** Ohne ATS-Optimierung erreichen viele qualifizierte Bewerbungen nie einen menschlichen Recruiter.

### Unsere ATS-Optimierungsstrategie

**Ziel:** Maximale ATS-Kompatibilität bei absoluter Ehrlichkeit

#### Wichtig: Dynamisches CV vs. Verifizierbare Quellen

**Das CV in unserem System ist dynamisch:**
- Für jedes Job-Angebot wird ein neues, angepasstes CV generiert
- Das CV ist **NICHT** die Quelle der Wahrheit

**Die wahren Quellen der Wahrheit sind:**
1. **Hochgeladene verifizierbare Dokumente:**
   - Referenzen (reference letters)
   - Arbeitszeugnisse (certificates)
   - Diplome (degrees/diplomas)
   - Weitere Zertifikate

2. **Dokumentierte Arbeitserfahrung:**
   - Stationen wo der Kandidat gearbeitet hat
   - Erfolge die erzielt wurden (und in Referenzen/Zeugnissen überprüfbar sind)
   - Skills die in diesen Dokumenten erwähnt werden

**Das generierte CV ist eine Kompilation dieser Quellen** - optimiert für das jeweilige Job-Angebot, aber immer basierend auf den verifizierbaren Dokumenten.

#### 1. Formatierungs-Optimierung

**ATS-freundlich:**
- ✓ **Single-Column Layout** (keine Tabellen, Multi-Column, Textboxen)
- ✓ **Standard Section Headers:** "Professional Summary", "Work Experience", "Education", "Skills", "Certifications", "Languages"
- ✓ **Simple Bullet Points** (•, -, *) - keine speziellen Grafiken
- ✓ **Kontaktinfo im Main Body** (nicht in Header/Footer - 25% werden sonst nicht erkannt)
- ✓ **Common Fonts:** Arial, Calibri, Times New Roman, Helvetica
- ✓ **Konsistente Datumsformate:** MM/YYYY oder Month YYYY

**ATS-problematisch (vermeiden):**
- ✗ Tabellen mit kritischem Content
- ✗ Text-Boxen, Bilder, Icons
- ✗ Mehrspaltiges Layout
- ✗ Ungewöhnliche Section Headers ("My Journey", "What I Do")
- ✗ Komplexe Grafiken oder Skill-Bars

#### 2. Keyword-Optimierung (Ehrlich!)

**Strategie:**
1. **Must-Have Skills extrahieren** aus Stellenbeschreibung
2. **Exact Phrasing verwenden** (wenn Job "Python" sagt, verwende "Python", nicht "Python programming")
3. **Acronyms + Long-Form** beide angeben (z.B. "ERP (Enterprise Resource Planning)")
4. **Strategische Platzierung:**
   - Professional Summary/Profile (Top des CV)
   - Job Titles (wenn sie tatsächlich passen)
   - Erste 1-2 Bullets der relevantesten Work Experience
   - Skills Section (prominent)
5. **Synonyme einbauen:** "JavaScript (JS, ES6+, Node.js)" statt nur "JavaScript"
6. **Natürliche Integration:** Keyword-Stuffing vermeiden, Kontext bewahren

**KRITISCH - Ehrlichkeitsgarantie:**
- ✓ Nur Skills verwenden, die **in verifizierbaren Dokumenten (Referenzen, Zeugnisse, Diplome) nachweisbar** sind
- ✓ Nur Erfahrungen referenzieren, die **dokumentiert** sind (in Referenzen, Arbeitszeugnissen)
- ✗ **NIEMALS** Skills erfinden, die nicht in hochgeladenen Dokumenten stehen
- ✗ **NIEMALS** Qualifikationen hinzufügen, die nicht dokumentiert sind
- ✗ **NIEMALS** Erfahrungen fabrizieren, die nicht verifizierbar sind

**Beispiel - Richtig:**
- Dokumentierte Erfahrung: "Worked with Python for data analysis" (in Referenz/Zeugnis erwähnt)
- Job fordert: "Python, Pandas, NumPy"
- Wenn Pandas/NumPy in Dokumenten erwähnt: ✓ "Python (Pandas, NumPy) for data analysis"
- Wenn NICHT in Dokumenten: ✗ NICHT hinzufügen

**Beispiel - Falsch:**
- Hochgeladene Dokumente: Keine Erwähnung von "Machine Learning"
- Job fordert: "Machine Learning experience required"
- ✗ NICHT hinzufügen: "Experience with Machine Learning"
- ✓ STATTDESSEN: Skill-Gap transparent lassen oder verwandte dokumentierte Skills highlighten

#### 3. Content-Priorisierung

**ATS-Score-Faktoren:**
- 40% Must-Have Skills Coverage
- 15% Nice-to-Have Skills
- 15% Job Title/Seniority Match
- 15% Experience Relevance
- 10% Keyword Optimization
- 5% ATS-Friendly Formatting

**Optimierung:**
1. **Reorder Work Experiences:** Relevanteste zuerst (chronologisch innerhalb Relevanz-Gruppen)
2. **Emphasize Achievements:** Die Job-Requirements matchen
3. **Quantify with Metrics:** Wo im Original-CV vorhanden (z.B. "improved efficiency by 25%")
4. **Action Verbs:** Aus Job Description übernehmen (wenn Job "managed" sagt, verwende "managed")

#### 4. Motivationsschreiben & ATS

**Wichtig:** Viele moderne ATS parsen auch Cover Letters als zusätzliche Textquelle für Keyword-Matching.

**Optimierung:**
- 5-8 kritische Keywords natürlich einbauen
- Exact Phrasing für Must-Have Skills verwenden
- Company Name + Job Title nennen
- Spezifische Requirements referenzieren und mit CV-Erfahrungen matchen
- Soft Skills und Cultural Fit zeigen (mit Keywords)

**Balance:** ATS-Optimierung + menschliche Lesbarkeit

#### 5. Match Score Report

**Simulation echter ATS-Behavior:**
- Keyword-Matching analysieren
- Hard Filter identifizieren (fehlende Must-Haves)
- Skill Coverage berechnen
- Formatting-Issues erkennen

**Ehrliche Gap-Analyse:**
- Wenn Must-Have Skills fehlen → **transparent kommunizieren**
- Wenn CV ATS-Filter wahrscheinlich nicht besteht → **klar sagen**
- Recommendations nur für **echte, vorhandene Qualifikationen**

### Implementierung in Prompts

Alle CV- und Motivationsschreiben-Prompts enthalten jetzt:

1. **=== ABSOLUTE HONESTY REQUIREMENTS (CRITICAL) ===**
   - Explizite Anweisungen, niemals Skills/Erfahrungen zu erfinden
   - Verifikations-Requirement (gegen Diplome, Referenzen, Arbeitszeugnisse)
   - Warnung vor Background-Checks

2. **=== ATS OPTIMIZATION STRATEGY ===**
   - Keyword-Extraction Anweisungen
   - Exact Phrasing Guidelines
   - Placement Strategy (wo Keywords platzieren)

3. **=== ATS-FRIENDLY FORMATTING ===**
   - Single-Column Layout
   - Standard Section Headers
   - Simple Formatting-Regeln

4. **=== KEYWORD OPTIMIZATION (HONEST) ===**
   - Nur vorhandene Skills expandieren
   - Synonyme nur für existierende Tools/Skills
   - Natural Language, kein Keyword-Stuffing

**Beispiel-Prompt-Auszug (tailored_cv_pdf):**
```
"The CV text provided is a compilation of the candidate's verifiable documents (references, diplomas, certificates) and actual work history"
"ONLY use skills, experiences, and qualifications that can be verified in these uploaded documents"
"NEVER invent, fabricate, or add skills not documented in the candidate's references, certificates, or diplomas"
"NEVER create fictional experiences, qualifications, or achievements beyond what is verifiable"
"NEVER claim competencies the candidate does not possess - background checks will verify against original documents"
"ONLY reorder, emphasize, and rephrase information from the candidate's verifiable documents and work history"
```

### Ethik & Realismus

**Philosophie:**
- ATS-Optimierung = **Präsentation optimieren, nicht Fakten**
- Reihenfolge, Wortwahl, Gewichtung optimieren ✓
- Skills erfinden ✗

**Warum Ehrlichkeit kritisch ist:**
- Background Checks würden Lügen aufdecken
- Probezeit würde fehlendes Know-how offenbaren
- Rechtliche Konsequenzen (Kündigung, Schadensersatz)
- Reputationsschaden

**Was wir tun:**
- Vorhandene Stärken optimal präsentieren ✓
- ATS-Hürden mit echten Qualifikationen überwinden ✓
- Gaps transparent lassen oder ehrlich adressieren ✓

**Was wir NICHT tun:**
- Fake Skills hinzufügen ✗
- Erfahrungen erfinden ✗
- Qualifikationen fabrizieren ✗

---

*Diese Dokumentation wird fortlaufend aktualisiert, wenn neue Artefakte hinzugefügt werden.*

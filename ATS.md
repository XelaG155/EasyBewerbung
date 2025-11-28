Ich starte direkt mit einer technischen Sicht auf ATS, und danach bekommst du einen ziemlich konkreten „Instruktions‑Algorithmus“, mit dem man eine App bauen kann, die Lebenslauf + Motivationsschreiben gezielt auf ein Jobangebot schreibt.

⸻

1. Wie ATS typischerweise arbeiten

1.1 Pipeline auf hoher Ebene

Die meisten modernen ATS (Greenhouse, Lever, Workday, aber auch kleinere SaaS‑Player) folgen grob dieser Pipeline:
	1.	Ingestion
	•	Kandidat lädt PDF/DOCX/Text oder LinkedIn‑Profil hoch.
	•	ATS wandelt alles in reinen Text um (inkl. OCR bei gescannten PDFs).  ￼
	2.	Parsing / Strukturierung
	•	NLP + Heuristiken erkennen typische CV‑Struktur:
	•	Name, Kontakt
	•	Berufstitel / Summary
	•	Berufserfahrung (Firma, Titel, Zeitraum, Ort, Bulletpoints)
	•	Ausbildung
	•	Skills, Zertifikate, Sprachen, Tools
	•	Ergebnis: ein strukturierter Kandidaten‑Datensatz (JSON‑ähnlich).  ￼
	3.	Jobbeschreibung parsen
	•	Aehnlicher Prozess:
	•	Jobtitel, Level, Standort
	•	Muss‑Anforderungen (Skills, Erfahrung, Ausbildung)
	•	Nice‑to‑have Skills
	•	Aufgaben / Verantwortungen
	•	formale Kriterien (Reisebereitschaft, Sprache, etc.).  ￼
	4.	Normalisierung & Skill‑Taxonomie
	•	Mapping auf standardisierte Begriffe:
	•	„JS“, „JavaScript“, „ECMAScript“ → ein Skill‑Knoten
	•	Jobtitel werden auf Jobfamilien / Taxonomien wie ESCO oder O*NET gemappt.  ￼
	•	Ziel: Synonyme, Abkuerzungen, Tippfehler zusammenfuehren.
	5.	Feature‑Engineering
Typische Features fuers Matching:  ￼
	•	Anzahl uebereinstimmender Muss‑Skills
	•	Anteil der Job‑Skills, die im CV vorkommen
	•	Seniorenitaet‑Match (Jobtitel‑Aehnlichkeit + Jahre Erfahrung)
	•	Domain‑Match (Branche)
	•	Standort‑/Remote‑Match
	•	Ausbildungsniveau
	•	Embeddings: Vektorrepräsentationen von CV und Stellenanzeige (BERT‑Varianten, Sentence‑BERT, spezialisierte Modelle wie CareerBERT).  ￼
	6.	Matching / Scoring
In der Praxis koexistieren mehrere Logiken:
	•	Hard Filter
	•	Wenn Muss‑Kriterium fehlt (z.B. „Arbeitsbewilligung“, „C1 Deutsch“), Score → sehr tief oder Kandidat wird gefiltert.
	•	Keyword‑Matching
	•	Klassische ATS machen viel auf Boolean‑Search:
	•	(Python OR Django) AND PostgreSQL AND (Docker OR Kubernetes)
	•	Gewichtete Felder (Titel/Berufserfahrung schwerer als Hobbys).  ￼
	•	TF‑IDF / Cosine Similarity
	•	Text der Jobbeschreibung vs. Text aus CV (v.a. Berufserfahrung + Skills).
	•	Sehr verbreitet in akademischen und praktischen Matching‑Systemen.  ￼
	•	Deep Learning / Embeddings
	•	Beide Dokumente in denselben semantischen Raum betten (BERT, CareerBERT etc.), Cosine Similarity als Score.  ￼
	•	Learning‑to‑Rank
	•	Superviseds Modell (z.B. Gradient Boosting oder Transformer), trainiert auf historischen Daten:
	•	Input: (Job, CV) Features
	•	Label: „eingestellt / interview / abgelehnt“
	•	Output: Relevanzscore, Ranking pro Job.  ￼
	7.	Output
	•	Liste von Kandidaten mit Scores, ggf. Bucket „strong match / medium / weak“, Vorschlaege fuers Recruiting.

Open‑Source‑ATS wie OpenCATS bilden diese Pipeline eher simpel ab (Parsing + Suchfilter, evtl. einfache Keyword‑Suche, kaum komplexes Deep‑Learning).  ￼

⸻

2. Was ATS fuer die Gestaltung von CV & Motivationsschreiben implizieren

Aus der Pipeline ergeben sich direkte Design‑Regeln:

2.1 Struktur & Layout
	•	Einspaltiges Layout, standardisierte Sections:
Summary, Experience, Education, Skills, Certifications, Languages.  ￼
	•	Keine Tabellen mit kritischem Content, keine Textboxen, keine Bilder/Icons fuer Skills.
	•	Jede Station:
Jobtitel – Firma – Ort – Von/Bis in einer eigenen Zeile, darunter Bulletpoints.

2.2 Keywords & Formulierungen
	•	Muss‑Skills der Stelle muessen wortgleich oder sehr nahe im CV auftauchen, ideal in:
	•	Jobtitel
	•	erste 1–2 Bulletpoints unter relevanter Position
	•	Skills‑Section.  ￼
	•	Synonyme zusätzlich einbauen:
	•	„Python (Pandas, NumPy)“ statt nur „Python“.
	•	„ERP (Odoo)“ statt nur „Odoo“.
	•	Gilt auch fuer Tools, Frameworks, Methoden, Sprachen, Zertifizierungen.

2.3 ATS & Motivationsschreiben
	•	Viele ATS parsen den CV sauber, das Motivationsschreiben aber „nur“ als Fliesstext.
	•	Trotzdem: zusätzliche Keyword‑Dichte + Kontext („wie angewendet“) → kann Matching verbessern, wenn der gesamte Bewerbungs‑Text analysiert wird.  ￼
	•	Aus Sicht eines Algorithmus ist das Motivationsschreiben eine zusätzliche Textquelle, um:
	•	Soft Skills
	•	Domain‑Wissen
	•	kulturelle Passung
abzubilden.

2.4 Ethik / Realismus
	•	ATS‑Optimierung heisst:
	•	Reihenfolge, Wortwahl und Gewichtung optimieren,
	•	nicht Skills erfinden.
	•	Ein gutes System darf nur das highlighten, was in der Historie verankert ist, sonst crashen Spaetestens Background‑Checks / Probearbeit.

⸻

3. Instruktions‑Algorithmus fuer eine App, die CV + Motivationsschreiben auf ein Jobangebot matched

Ich formuliere das als technische Spezifikation / Algorithmus, den du direkt in eine Architektur uebersetzen kannst.

3.1 Datenmodell

JobPosting {
  id,
  raw_text,
  title,
  level,
  location,
  employment_type,
  skills_must: [SkillRequirement],
  skills_nice: [SkillRequirement],
  responsibilities: [string],
  soft_skills: [string],
  education_requirements: [string],
  languages: [LanguageRequirement],
  constraints: { travel, work_auth, workload, salary_range_optional }
}

CandidateProfile {
  id,
  master_cv_raw_text,
  experiences: [Experience],
  education: [Education],
  skills: [Skill],
  certifications: [Certification],
  languages: [LanguageSkill],
  meta: { location, salary_expectation, work_auth, remote_preference }
}

Experience {
  title,
  company,
  location,
  date_from,
  date_to,
  bullets: [string],
  tags: [normalized_skill_id]
}

SkillRequirement/Skill {
  name_raw,
  normalized_id,
  weight
}

3.2 Module
	1.	JobParser
Input: job_posting_text
Output: JobPosting
	•	Sentence‑Splitting, POS‑Tagging, Dependency Parsing.
	•	Satzklassifikation: jeder Satz → Label:
	•	MUST_SKILL, NICE_SKILL, RESPONSIBILITY, BENEFIT, FORMAL_REQUIREMENT
	•	Entitaetserkennung fuer:
	•	Skills/Tools (über Skill‑NER, ggf. auf ESCO/O*NET gemappt)  ￼
	•	Sprachen, Abschluesse, Zertifikate, Standort.
	2.	ResumeParser
Input: master_cv_raw_text
Output: CandidateProfile
	•	Linienklassifikation (Section‑Header vs. Content).
	•	Erkennung von Experience‑Blöcken: Patterns wie:
	•	Jobtitel + Firma + Ort + Datum
	•	Bullet‑Detection (•, -, * etc.).
	•	NER fuer Skills, Tools, Sprachen, Zertifikate in Bullets & Skills‑Abschnitt.  ￼
	3.	Normalizer / OntologyMapper
	•	Mappt alle Skill‑Strings auf normalized_id (z.B. via Embedding + Nearest‑Neighbour in einer Skill‑Ontologie).
	•	Vereinheitlicht Jobtitel und Fachgebiete.
	•	Normalisiert Datumsformate, Orte, Unternehmensnamen.
	4.	ATSScorer (Simulation)
Bekommt JobPosting + beliebigen Text (CV oder CV+Letter) und gibt Score 0–100 aus.
Features (Beispiele):
	•	hard_fail (0/1): Verletzung Muss‑Kriterien (z.B. fehlende Sprache).
	•	skill_recall_must = Abdeckung Muss‑Skills (0–1).
	•	skill_recall_nice
	•	title_similarity_recent (Embedding‑Cosine zwischen aktuellem Jobtitel und Ziel‑Jobtitel).
	•	experience_years_match (Penalty wenn deutlich drunter).
	•	domain_match
	•	location_match
	•	text_similarity (TF‑IDF oder Embedding CV vs. Jobbeschreibung).  ￼
Beispiel‑Formel:

if hard_fail = 1:
    score = 0
else:
    score =
      0.40 * skill_recall_must +
      0.15 * skill_recall_nice +
      0.15 * title_similarity_recent +
      0.10 * text_similarity +
      0.10 * domain_match +
      0.10 * location_match

(Gewichte natuerlich konfigurierbar / lernbar.)

	5.	ContentPlanner_CV
Input: JobPosting, CandidateProfile
Output: abstrakter CV‑Plan
Schritte:
	1.	Relevanz pro Experience berechnen
	•	Score je Position: Overlap der Skills + Textsimilaritaet Bullets ↔ Muss‑/Nice‑Skills.
	2.	Top‑Erfahrungen selektieren (z.B. Top‑5)
	•	Reihenfolge chronologisch, aber bei langen CVs irrelevante Jobs kuerzen.
	3.	Skill‑Priorisierung
	•	skills_must und die wichtigsten skills_nice nach oben in die Skills‑Section.
	4.	Summary‑Blueprint
	•	2–3 Saetze, die:
	•	Zielrolle + Seniorenitaet
	•	2–3 Kernskills (aus Muss‑Liste)
	•	1–2 messbare Outcomes hervorheben.
Output z.B.:

{
  "summary_slots": ["role", "years_experience", "top_skill_1", "top_skill_2", "key_achievement"],
  "experiences_to_include": [...],
  "skills_ordered": [...],
  "sections": ["Summary", "Experience", "Skills", "Education", "Certifications", "Languages"]
}


	6.	Generator_CV
	•	Nutzt LLM oder regelbasierte Templates, um:
	•	Summary‑Text zu generieren
	•	Bullets neu zu formulieren (Action Verb + Kontext + Ergebnis + relevanter Skill).
	•	Regeln:
	•	Jeder Muss‑Skill:
	•	mind. einmal in Skills‑Section
	•	mind. einmal in einem relevanten Bullet.
	•	Keine neuen Skills, die nicht im CandidateProfile vorkommen (hartes Constraint).
	7.	ContentPlanner_Letter
	•	Waehlt 3–4 „Story‑Achsen“:
	•	z.B. „Tech‑Stack‑Match“, „Domain‑Match“, „Soft Skills“, „Ownership / Impact“.
	•	Mapped jede Achse auf 1–2 konkrete Erfahrungen / Projekte aus CandidateProfile.
	•	Legt Struktur fest:
	1.	Opening (Rolle + warum Firma)
	2.	2–3 Abschnitte mit Cases
	3.	Closing (Call‑to‑Action, Availability).
	8.	Generator_Letter
	•	Erzeugt Motivationsschreiben, das:
	•	Firmenname, Rolle, ggf. Produkt nennt,
	•	3–5 Kernkeywords aus der Jobbeschreibung sauber einbaut,
	•	gleichzeitig als menschlicher Text lesbar bleibt.
	•	Wieder: keine erfundenen Skills.
	9.	ConsistencyChecker
	•	Checkt:
	•	gleiche Jobtitel, Firmennamen, Daten in CV und Letter.
	•	Skills im Letter ⊆ Skills im CV (oder explizit im Profil).
	•	Flaggt eventuelle Widersprueche.
	10.	ATSScoreOptimizer

	•	Loopt ueber mehrere Varianten (z.B. unterschiedliche Summaries oder Bullet‑Formulierungen):
	1.	Generiere n Varianten.
	2.	ATSScorer(JobPosting, CV‑Text [+ Letter]) → Score.
	3.	Waehle Variante mit hoechstem Score unter Nebenbedingungen:
	•	Max‑Laenge CV (z.B. 2 Seiten)
	•	Max‑Laenge Letter (z.B. ¾ Seite)
	•	Mindest‑Lesbarkeit (z.B. Flesch‑Index oder interne Heuristik).

⸻

3.3 End‑to‑End‑Ablauf (Pseudocode)

function generate_application(job_text, candidate_master_cv, candidate_meta):
    job = JobParser.parse(job_text)
    cand = ResumeParser.parse(candidate_master_cv)
    cand = Normalizer.normalize(cand, ontologies)
    job  = Normalizer.normalize(job, ontologies)

    // 1. Gap-Analyse
    match_report = compute_match(job, cand)

    // 2. CV planen & generieren
    cv_plan      = ContentPlanner_CV.plan(job, cand, match_report)
    cv_variants  = Generator_CV.generate_variants(cv_plan, cand)

    // 3. Motivationsschreiben planen & generieren
    letter_plan  = ContentPlanner_Letter.plan(job, cand, match_report)
    letter_variants = Generator_Letter.generate_variants(letter_plan, cand)

    // 4. Konsistenz & Optimierung
    best_solution = null
    best_score    = -inf

    for cv in cv_variants:
        for letter in letter_variants:
            if not ConsistencyChecker.is_valid(cv, letter, cand):
                continue
            score = ATSScorer.score(job, cv.text + " " + letter.text)
            if score > best_score:
                best_score = score
                best_solution = {cv, letter, score}

    return best_solution, match_report

3.4 Match‑Report fuer Transparenz

Damit das System nicht als Blackbox arbeitet, erzeugt es parallel einen Match‑Report:
	•	Liste aller Muss‑Skills mit Status:
	•	covered_in: [experience_id/section]
	•	oder missing
	•	Liste der wichtigsten Nice‑to‑have Skills mit Status.
	•	Visualisierung von:
	•	Skill‑Coverage,
	•	Titel‑Aehnlichkeit,
	•	Domain‑Match,
	•	Location‑Match,
	•	Gesamt‑ATSScore.

So kann der User verstehen, warum ein bestimmter CV/Letter‑Entwurf so aussieht.

⸻

Damit hast du:
	•	ein realistisches Modell, wie ATS tatsaechlich CVs & Stellen matchen (von Keyword‑Baselines bis BERT‑Embedding‑Ansätzen),  ￼
	•	und einen modularen Instruktions‑Algorithmus, der genau diese Logik simuliert und darauf aufbauend Lebenslauf + Motivationsschreiben generiert, optimiert und auf Konsistenz prueft.

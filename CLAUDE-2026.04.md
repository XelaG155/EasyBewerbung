# CLAUDE-2026.04.md — Agent-Armada & Re-Review-Befunde

**Datum:** 2026-04-26
**Modell:** Claude Opus 4.7 (1M Context)
**Auftraggeber:** Alex Giss
**Anlass:** Frische-Augen-Re-Review der mit Opus 4.5 gebauten App — vor weiterer Pilot-Skalierung.
**Voriger Status:** `status_20260405.md` deklarierte „pilot-ready" mit Round-3-Scores 9.5+ auf allen drei Achsen (QA, DA, UX/UI). Die Armada hat das mit unabhängigem Blick neu bewertet.

---

## 1. Auftrag

Drei Lieferungen in einem:

1. **Armada aufbauen:** UI/UX-, Development-, Security-, Architecture-, QA-, DA-, Testing-Agenten plus alles, was hilft.
2. **Vollständigen Re-Review** des Repos durchführen lassen.
3. **Ergebnisse + Setup** in dieser Datei dokumentieren, damit zukünftige Sessions die Armada gezielt einsetzen können.

Plus zwei Nach-Anforderungen:
- **Auto-Testing aktivieren** — Vorbild ist DescoEmocional.
- **Sprach-Bug fixen** — User-Sprache vs. Job-Sprache pro Dokument korrekt.

---

## 2. Die Armada

15 Spezialisten wurden parallel auf das Repo angesetzt. Definitionen liegen unter `~/.claude/agents/` (global) oder `.claude/agents/` (project-lokal — `code-simplifier`, `qa-reviewer`, `devils-advocate`, `ux-ui-reviewer` sind bereits committet).

| # | Agent | Rolle in dieser Armada | Trigger / wann einsetzen |
|---|---|---|---|
| 1 | `architect-reviewer` | System-Architektur, Service-Grenzen, Skalierungs-Risiken | Vor groesseren Refactors, vor Skalierungs-Entscheidungen |
| 2 | `security-auditor` | Auth, OWASP, Secrets, CORS/CSRF, OAuth | Vor jedem Pilot-Release, nach Auth-Aenderungen |
| 3 | `code-reviewer` | Modern code-quality (FastAPI, React 19, Python 3.11+, TS) | Routine-Review, vor Merge in `main` |
| 4 | `database-optimizer` | Schema, Indizes, N+1, Migrations | Bei DB-Schemata, vor Skalierung |
| 5 | `ai-engineer` | LLM-Integration, Provider-Dispatch, RAG, Caching | Bei LLM-Feature-Aenderungen |
| 6 | `prompt-engineer` | Prompt-Qualitaet, Injection-Schutz, CH-Spezifika | Bei Prompt-Aenderungen in `document_prompts.json` |
| 7 | `accessibility-guardian` | WCAG 2.2 AA, Screenreader, Keyboard | Vor jedem UI-Release |
| 8 | `performance-engineer` | Backend + Frontend Perf, Bundle, DB-Pool | Bei Latenz-Beschwerden, vor Skalierung |
| 9 | `devils-advocate` (project) | Hidden assumptions, Failure-Modes, Scope-Drift | Vor jedem Ship — Pflicht-Gate |
| 10 | `ux-ui-reviewer` (project) | Hierarchie, Workflows, Swiss-German-Copy, Dark-Mode | Vor UI-Ship — Pflicht-Gate |
| 11 | `qa-reviewer` (project) | Test-Coverage, Idempotenz, Audit-Trails | Vor jedem Ship — Pflicht-Gate |
| 12 | `deployment-engineer` | CI/CD, Container-Security, Rollback | Bei Deploy-Pipeline-Aenderungen |
| 13 | `privacy-architect` | Schweizer DSG, EU-DSGVO, EU-KI-VO, DPAs | Vor Pilot-Skalierung mit echten Nutzern |
| 14 | `test-automator` | Test-Strategie, CI-Pipelines, LLM-Mocking | Wenn Auto-Testing aufgesetzt wird |
| 15 | `code-simplifier` (project) | Idiom-Cleanup, dead code, Swiss-German-Konventionen | Nach Feature-Implementation |

**Empfohlene Pflicht-Gates vor Ship:** `devils-advocate`, `qa-reviewer`, `ux-ui-reviewer`, `security-auditor`. Alle anderen anlassbezogen.

**Aufruf-Muster (Beispiel):**
```
Agent: subagent_type=architect-reviewer
Prompt: kurzer Kontext (Stack, Repo-Pfad, Lese-Liste) + spezifischer Fokus +
        "P0/P1/P2 mit file:line, unter 350 Woertern".
```

Erfahrung aus diesem Lauf: Agenten liefern besser, wenn (a) Read-Liste explizit ist, (b) eine Wort-Obergrenze genannt wird und (c) klar ist, dass es ein **Re-Review** ist, nicht ein Erst-Review (sonst wiederholen sie banale Best-Practice-Phrasen).

---

## 3. Konsolidierter Befund

Gesamt-Lage: Pilot-ready unter eingeschraenkten Bedingungen. **Sechs P0-Befunde** wurden in der frischen Runde gefunden, die im voherigen Round-3-Review nicht auf dem Radar waren — hauptsaechlich, weil dort die Reviewer-Agenten denselben Code-Pfad gelesen haben wie der Implementer (Selbst-Bias).

### P0 — Ship-Blocker fuer Pilot-Skalierung

| # | Befund | Quelle | Datei |
|---|---|---|---|
| P0-1 | **Credits werden bei LLM-Fehler nicht zurueckerstattet.** Upfront-Abzug in Endpoint, kein Refund-Pfad bei `LlmProviderUnavailable` oder Worker-Crash. User zahlt fuer 0 Dokumente. | DA, Code, AI | `applications.py:874`, `tasks.py:543-721` |
| P0-2 | **`generate_documents_task` setzt `status="completed"` auch bei Partial-Failure.** Schleife ueber Doc-Types bricht bei Einzel-Fehler nicht ab und schreibt am Ende immer `completed`. User sieht „fertig", bekommt aber 2 von 5 Dokumenten. | DA, Code | `tasks.py:705-707` |
| P0-3 | **Sprach-Logik ignoriert das designte Schema.** `tasks.py:362-367` ersetzt `{language}`, `{company_profile_language}` und `{documentation_language}` ALLE mit derselben `documentation_language`. Das `Application`-Modell hat aber bereits drei separate Felder. **Konkret hat der App-Owner berichtet:** Anschreiben/CV sollen in **Job-Sprache** geschrieben sein, das Firmenportrait in **User-Sprache**. Aktuell laufen alle Dokumente in `documentation_language`. (Details + Fix-Plan in Abschnitt 4.) | User-Report, Code, AI | `tasks.py:312, 362-367`, `models.py:94-96, 284-285` |
| P0-4 | **Kein Logout / keine Token-Revocation.** JWT 7 Tage gueltig, keine `jti`, keine Blacklist, kein `password_changed_at`-Check. Admin-Demote oder gestohlener Token bleibt 7 Tage aktiv. | Security | `auth.py:34-67`, `admin.py:280` |
| P0-5 | **`SECRET_KEY`-Default + Ephemeral-Fallback.** Wenn `ENVIRONMENT != "production"` (Compose setzt es nicht!), generiert Container bei Restart einen Zufalls-Key → Auto-Deploy via bigvmcontrol invalidiert silently alle Sessions. | Security | `auth.py:21-32` |
| P0-6 | **Drei Quellen fuer Document-Types.** DB (`models.DocumentType`) + statische `document_catalog.py` + `document_prompts.json` (im Worker-Import gecached). Frontend-Paket-Picker liest noch aus statischer Datei → neue DB-Eintraege fehlen in Paketen. | Architecture, DA | `tasks.py:36-42`, `document_catalog.py`, `document_prompts.json` |

### P1 — Must-fix vor Skalierung

| # | Befund | Quelle | Datei |
|---|---|---|---|
| P1-1 | **Privacy-Policy ist Boilerplate.** Erwaehnt nicht: US-Drittland-Transfer (OpenAI/Anthropic/Google), Verantwortlichen-Identitaet, Aufbewahrungsfristen, KI-Generierung. Verstoss revDSG Art. 19/20. | Privacy | `privacy_policy.py:5-66` |
| P1-2 | **Recht auf Loeschung fehlt.** Kein `DELETE /me`, kein Datenexport. Pflicht revDSG Art. 32 / DSGVO Art. 17+20. | Privacy | `users.py` |
| P1-3 | **Keine DPAs / OpenAI-ZDR-Vereinbarung dokumentiert.** Standard-OpenAI speichert Inputs 30 Tage. PII-CV → US ohne ZDR ist unzulaessig. | Privacy | extern + `tasks.py:633-661` |
| P1-4 | **`pytest-anyio` nicht in `requirements.txt`.** Async-Tests werden in CI silent-skipped. | Testing | `backend/requirements.txt` |
| P1-5 | **E2E-Tests sind „vacuous-asserts".** 156 Stellen mit `if (await x.count() > 0)` ohne `expect`-Call. Tests passieren auch bei voelligem UI-Ausfall. | Testing | `frontend/e2e/flows/document-generation-flow.spec.ts:100-105, 263-266`; `job-application-flow.spec.ts:123-128` |
| P1-6 | **Kein Pre-Deploy-Test-Gate.** `.github/workflows/docker.yml` baut Images, pytest laeuft NICHT. bigvmcontrol-Webhook deployt unabhaengig vom CI-Status. | Testing, Deployment | `.github/workflows/docker.yml` |
| P1-7 | **Sync-SQLAlchemy in async FastAPI-Handlers.** Jeder Request blockiert den Event-Loop. Throughput-Killer. | Code, Performance | `applications.py:279,380,412,459,490,604,622,657,702,826,909,966,1082` |
| P1-8 | **Sequenzielle LLM-Calls in einem Celery-Task.** 5 Docs x 15s = 75s Latenz, blockiert den Worker-Slot. Mit nur 4 Slots = 4 parallele Bewerbungen sperren alles. | Performance | `tasks.py:635` |
| P1-9 | **Kein Anthropic-Prompt-Caching.** 10000-Char-CV pro Doc-Type erneut gesendet. ~70% Latenz und ~90% Cost verschenkt. | AI, Performance | `tasks.py:166-179, 346` |
| P1-10 | **Kein Provider-Fallback / Timeout / Retry-Backoff.** Haengender Provider blockiert Worker unbegrenzt. | AI | `tasks.py:160-189` |
| P1-11 | **`calculate_matching_score_task` hardcoded auf OpenAI `gpt-4o-mini`.** Ignoriert den Provider-Dispatch. | AI, Code | `tasks.py:466, 488` |
| P1-12 | **Keine Indizes auf FK + Hot-Filter-Spalten.** `applications.user_id`, `generated_documents.application_id`, etc. — bei 10k+ Rows Full-Scan. | DB | `models.py:54, 67, 83, 109, 123, 139-140, 157-158, 172` |
| P1-13 | **Keine `ON DELETE`-Regeln auf irgendeiner FK.** User-Loeschung mit IntegrityError; Bulk-Delete erzeugt Orphans. | DB | `models.py` durchgehend |
| P1-14 | **DB-Connection-Pool ist Default (5+10) ohne pre-ping.** Default-Postgres `max_connections` wird unter Last gesprengt. | DB, Performance | `database.py:16` |
| P1-15 | **`init_db()` + Alembic-Drift.** `create_all` erzeugt nur fehlende Tabellen, nicht fehlende Spalten — Schema-Drift garantiert. | Architecture, DB | `database.py:38`, `init_db.py:26-29`, `main.py:41` |
| P1-16 | **Modal hat keinen Focus-Trap.** WCAG 2.1.2 Verstoss. Privacy-Modal bei Register hat zusaetzlich kein `role="dialog"`. | A11y | `components/Modal.tsx`, `app/register/page.tsx:282` |
| P1-17 | **`<Input>`-Label nicht mit `<input>` verbunden.** Kein `htmlFor`/`id`. Alle Inputs sind fuer Screenreader unbenannt. WCAG 1.3.1, 4.1.2. | A11y | `components/Input.tsx:27-42` |
| P1-18 | **Form-Errors haben kein Live-Region und kein `aria-invalid`.** | A11y | `components/Input.tsx:42`, `app/login/page.tsx:93` |
| P1-19 | **`<html lang="en">` hardcoded** — App spricht 33 Sprachen, Screenreader spricht alles englisch aus. WCAG 3.1.1. | A11y | `app/layout.tsx:30` |
| P1-20 | **User-Dashboard ist komplett englisch.** „Upload Documents", „Mark as Applied", „Spontaneous Outreach" usw. — bei einer Schweizer Job-Plattform Pilot-Blocker. | UX | `app/dashboard/page.tsx:628, 686, 728, 831, 904, 1129, 1140, 1169` und `components/ErrorBoundary.tsx:27-33` |
| P1-21 | **`POST /{id}/matching-score/calculate` hat KEIN Rate-Limit.** Dispatched eine Celery-Task pro Aufruf — User kann Worker-Pool in Minuten saturieren. | QA, Security | `applications.py:701` |
| P1-22 | **Doppelter `get_llm_client` in `applications.py:58-81` schluckt SDK-Errors silent** und faellt auf `gpt-4` zurueck. Anthropic-konfiguriertes Template = silent falsches Dokument, Admin sieht keinen Fehler. | QA, Code | `applications.py:58-81` |
| P1-23 | **Backend-Container laeuft als `root`.** Privilege-Escalation-Risiko. | Deploy | `backend/Dockerfile` |
| P1-24 | **`POSTGRES_PASSWORD` Fallback `localdev123`** in `docker-compose.yml`. Falls `.env` fehlt → Default-Passwort in Production. | Deploy, Security | `docker-compose.yml:19` |
| P1-25 | **Prompt-Injection-Defense fehlt.** `cv_text`, `job_description`, `additional_profile_context` werden roh interpoliert. | Prompt, Security | `tasks.py:359-360, 597-622` |
| P1-26 | **PII-`print()` in Production-Code.** User-IDs, Tracebacks gehen in Docker-Logs ohne Retention. | Security, Code | `applications.py:374, 496, 504, 513, 550, 553-554, 652`; `jobs.py:391, 444` |
| P1-27 | **CSRF deaktiviert + JWT in localStorage** = jeder XSS-Treffer ist Account-Takeover. | Security | `main.py:23`, `SECURITY.md:75-77` |
| P1-28 | **Postgres + File-Storage on local Docker volume — unverschluesselt, ohne Backup-Cron.** Schweizer DSG-Risiko. | Privacy, Deploy | `docker-compose.yml`, `tasks.py:664-666` |

### P2 — Wichtig, nicht ship-blocking

- **Worker-Topology-Mismatch:** Compose `--concurrency=2` ueberschreibt `worker_concurrency=4` (`celery_app.py:42`); globaler `task_default_rate_limit=10/m` drosselt cheap und teure Tasks gleich. → split queues `matching` / `generation`.
- **Zwei Task-Tabellen** `GenerationTask` + `MatchingScoreTask` mit fast identischem Schema → eine `BackgroundTask`.
- **`UserActivityLog` waechst unbegrenzt.** Partition + Retention.
- **`models.py` 300 LOC mixed** — split in `models/user.py`, `models/application.py`, `models/catalog.py`.
- **`MatchingScore.strengths/gaps/recommendations` als TEXT** statt JSONB.
- **`gpt-4o-mini` und `gpt-4` hardcoded** an mehreren Stellen statt aus Template-Config.
- **`max_tokens=4096` hardcoded** in `tasks.py:170` — Long-form-Templates wie `interview_preparation_pack` werden abgeschnitten.
- **Sprach-Routing-Bug:** `get_language_instruction("de")` liefert "ß where appropriate", widerspricht der projekt-weiten ss-Regel.
- **Zeugnis-Code-Tabelle unvollstaendig** (json:1000-1019) — fehlt „stets bemueht", „haben kennengelernt als", „ausgeschieden".
- **Zero Few-Shot-Beispiele** in den Prompts.
- **Tab-ARIA in `TemplateEditorDrawer.tsx:249`** verwendet `aria-current="page"` — falsch fuer In-Page-Tabs.
- **Spinner ohne `prefers-reduced-motion`-Guard** (`dashboard/page.tsx:546, 571`).
- **`PlaceholderExplorer.tsx`** mischt „du"-Form und „Sie"-Form.
- **`Modal.tsx` `bg-slate-900` hardcoded** — Light-Mode zeigt schwarzen Modal.
- **Kein API-Versioning** (`/v1/`).
- **Ein einziger `next/dynamic`-Import wuerde** Admin-Page-Hydration-Cost halbieren.
- **`UserActivityLog.ip_address` ohne Forwarded-IP-Resolver** = nutzlos hinter nginx.
- **Pydantic v1/v2-Mix** (`@validator` neben `@field_validator`).

---

## 4. Sprach-Logik — der Empfaenger entscheidet

Das aktuelle Verhalten in `tasks.py:312, 362-367` benutzt fuer ALLE Platzhalter dieselbe `documentation_language`. Das Datenmodell ist bereits richtig vorgesehen (`Application.ui_language`, `Application.documentation_language`, `Application.company_profile_language` in `models.py:94-96`, plus `DocumentTemplate.language_source` in `models.py:284-285`), aber die Runtime ignoriert es.

**Regel:** Jedes Dokument wird in der Sprache des **Empfaengers** geschrieben.

| Doc-Type | Empfaenger | Sprach-Quelle |
|---|---|---|
| `tailored_cv_pdf` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `tailored_cv_editable` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `tailored_cv_one_page` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `motivational_letter_pdf` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `motivational_letter_editable` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `email_formal` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `email_linkedin` | Recruiter / Arbeitgeber | **Job-Sprache** |
| `match_score_report` | Bewerber selbst (Selbstkorrektur) | **User-Sprache** |
| `company_intelligence_briefing` | Bewerber selbst (Interview-Vorbereitung) | **User-Sprache** |
| `interview_preparation_pack` | Bewerber selbst | **User-Sprache** |
| `linkedin_optimization` | Bewerber selbst (Profil-Update) | **User-Sprache** |
| `executive_summary` | Bewerber selbst (Karriere-Uebersicht) | **User-Sprache** |
| `skill_gap_report` | Bewerber selbst (Weiterbildungs-Plan) | **User-Sprache** |
| `reference_summary` | Bewerber selbst (Nutzung in Bewerbung) | **User-Sprache** |
| `role_specific_portfolio` | Bewerber selbst | **User-Sprache** |

### Konkreter Fix-Plan

**Schritt 1 — Datenmodell ist schon da, nutzen.**
- `User.preferred_language` = Benutzersprache (UI + an-User-gerichtete Dokumente).
- `Application.documentation_language` = **Job-Sprache** (an Arbeitgeber gerichtete Dokumente). Bei Erstellung der Bewerbung aus der Job-Anzeige automatisch detektieren (`langdetect` auf `job_description`), User kann ueberschreiben.
- `Application.company_profile_language` (existiert!) = User-Sprache fuer Firmenportrait.
- `DocumentTemplate.language_source` (existiert!) = `"job_language"` | `"user_language"`. Default per Doc-Type wie in der Tabelle oben.

**Schritt 2 — `tasks.py` korrigieren.**
- Aus `template.language_source` ableiten, welche Sprache zu nehmen ist.
- `generate_document_prompt_from_template` bekommt eine `_resolve_doc_language(template, application, user) -> str` Funktion.
- Drei Platzhalter unterscheiden:
  - `{language}` → Empfaenger-Sprache des Doc-Types (resolved)
  - `{job_language}` → fix `application.documentation_language`
  - `{user_language}` → fix `user.preferred_language`
  - `{company_profile_language}` → bleibt `application.company_profile_language`

**Schritt 3 — Seed/Migration.**
- Migration: setze `language_source` per Doc-Type entsprechend Tabelle oben.
- `seed_document_templates.py`: gleiche Defaults.

**Schritt 4 — Job-Sprache automatisch erkennen.**
- Bei `POST /jobs` und `POST /applications`: `langdetect` auf `job_description` → schreibt `Application.documentation_language`.
- UI: User sieht erkannte Sprache und kann pro Bewerbung ueberschreiben (Dropdown im Application-Detail).

**Schritt 5 — Tests.**
- `test_language_routing.py`: drei Faelle:
  - Job-de + User-fr → CV in DE, Firmenportrait in FR.
  - Job-en + User-de → Anschreiben in EN, Skill-Gap-Report in DE.
  - Job-Sprache leer / nicht erkannt → Fallback auf `user.documentation_language` mit Warning.

**Schritt 6 — Bug `de → ß`.**
- `get_language_instruction("de")` (`tasks.py:194-204`) liefert noch „ß where appropriate". CH-User mit `de` (statt `de-CH`) bekommen falsche Orthografie. → fuer CH-Markt-Default `de-CH` als Pflicht oder die Anweisung pauschal auf „use 'ss' (Swiss orthography)" setzen.

---

## 5. Automatisches Testen — Pipeline wie DescoEmocional

### Was DescoEmocional macht

DescoEmocional hat in `.github/workflows/ci.yml` drei Jobs, die bei jedem PR auf `main` und jedem Push auf `main` laufen:

1. **`unit-tests`** — `npm test` (Vitest) gegen Unit-Tests in `tests/unit/`. Kein DB, kein Redis. Schnell.
2. **`integration-tests`** — Postgres-16 + Redis-7 als GitHub-Actions-Service-Container, `prisma migrate deploy`, `prisma seed`, dann `npm run test:coverage` (Vitest mit Coverage). Routes werden via `supertest` getestet, echte DB.
3. **`e2e-tests`** — gleicher Postgres+Redis-Stack, `playwright install --with-deps chromium`, dann `npm run test:e2e`. Bei Fehlschlag wird der `playwright-report/`-Ordner als Artifact 7 Tage hochgeladen.

Schluessel-Tricks:
- **Service-Container per Job** (Postgres + Redis als sidecar) — keine externe Infra noetig.
- **Anthropic-Key als Placeholder** (`sk-ant-ci-placeholder`) — Tests muessen LLM-Calls mocken.
- **Admin-Seed via Env-Vars** (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) — deterministischer Login.
- **`SKIP_KB=1`** — Knowledge-Base-Bootstrapping ueberspringen, sonst wird CI extrem langsam.
- **`playwright.config.js`** startet den Server selbst via `webServer: { command: "node server.js" }` — kein separates Compose-Setup im CI noetig.
- **Retries=2 in CI**, aber keine in lokal — Flake-Resilienz ohne Lokal-Maskierung.

### Plan fuer EasyBewerbung

**Schritt 1 — Lokale Test-Hygiene** (vor CI noetig, sonst rot):
- `backend/requirements.txt`: `pytest-anyio`, `pytest-mock`, `pytest-cov` ergaenzen.
- `frontend/e2e/flows/document-generation-flow.spec.ts` und `job-application-flow.spec.ts`: alle `if (await x.count() > 0) {…}`-Bloecke entweder durch `await expect(x).toBeVisible()` ersetzen oder via `test.skip` ehrlich machen. Vacuous-asserts loeschen.
- `frontend/playwright.config.ts`: `webServer`-Block wie bei DescoEmocional einbauen, damit CI keinen separaten Compose-Stack braucht.

**Schritt 2 — `.github/workflows/test.yml` neu** (analog DescoEmocional):

```yaml
name: Test Suite

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: easybewerbung
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: easybewerbung_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-retries 5

    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - run: pip install -r requirements.txt pytest-anyio pytest-mock pytest-cov

      - name: Unit + integration tests with coverage
        env:
          DATABASE_URL: postgresql://easybewerbung:testpass@localhost:5432/easybewerbung_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: ci-test-secret-key-32chars-minimum
          ENVIRONMENT: test
          # LLM-Keys absichtlich leer — LlmProviderUnavailable-Tests pruefen genau diesen Pfad
        run: pytest -v --cov=app --cov-report=xml --cov-fail-under=60 tests/

      - uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
        continue-on-error: true

  frontend-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-check]
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'push' && github.ref == 'refs/heads/main')
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: easybewerbung, POSTGRES_PASSWORD: testpass, POSTGRES_DB: easybewerbung_e2e }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11", cache: pip, cache-dependency-path: backend/requirements.txt }
      - run: pip install -r backend/requirements.txt
      - name: Boot backend
        env:
          DATABASE_URL: postgresql://easybewerbung:testpass@localhost:5432/easybewerbung_e2e
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: ci-e2e-secret-32chars-minimum-please
          OPENAI_API_KEY: sk-dummy
          CORS_ORIGINS: http://localhost:3001
          ENVIRONMENT: test
        run: |
          cd backend
          uvicorn app.main:app --host 0.0.0.0 --port 8002 &
          for i in {1..30}; do curl -sf http://localhost:8002/ && break; sleep 1; done
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install --with-deps chromium
      - name: Run Playwright
        working-directory: frontend
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3001
          NEXT_PUBLIC_API_URL: http://localhost:8002
          CI: "true"
        run: npx playwright test --project=chromium
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 7
```

**Schritt 3 — LLM-Mocking-Strategie.**
- In Tests: `monkeypatch.setattr("app.tasks.generate_with_llm", lambda *a, **kw: "mocked content")`.
- In CI: `OPENAI_API_KEY` etc. **nicht setzen** → `get_llm_client` raised `LlmProviderUnavailable`, was die Fehler-Pfade testet. Tests, die echten LLM-Output brauchen, mocken explizit.
- Echte LLM-Calls **nie** in CI — kostet Geld, ist non-deterministisch.

**Schritt 4 — Coverage-Gates fuer kritische Module.**
Beginnen mit `--cov-fail-under=60`, ueber 4 Wochen auf 75% hochziehen. Module mit Pflicht-Coverage:
- `tasks.py` (`generate_documents_task`, `calculate_matching_score_task`) → mind. 80%
- `applications.py` (Credits-Pfad, Generate-Endpoint) → mind. 80%
- `auth.py` → mind. 90%

**Schritt 5 — Pre-Deploy-Gate via Branch-Protection.**
GitHub → Settings → Branches → Rule auf `main`:
- Require status checks: `backend-test`, `frontend-check`.
- Require pull request before merging.
- Force-Push deaktivieren.

Damit kann **kein Push direkt auf `main`** mehr ohne gruene CI. Der bigvmcontrol-Webhook deployt erst dann, weil er auf den Push reagiert — und der Push findet nur statt nach gruenem Gate.

**Schritt 6 — bigvmcontrol-Webhook absichern.**
Optional zusaetzlich im `~/bigvmcontrol/config.yaml`: `wait_for_check: "test.yml"` (falls bigvmcontrol das unterstuetzt — andernfalls reicht Branch-Protection als Gate).

**Schritt 7 — Stretch.**
- `hypothesis` fuer reine Funktionen: `normalize_language`, `validate_url_safety`, `_resolve_prompt_components`, `_resolve_doc_language` (neu).
- `mutmut` weekly-Job — bestaetigt vacuous-asserts.
- Vitest fuer Frontend-Komponenten (`Input`, `Modal`, `TemplateEditorDrawer`) — bisher nur E2E.

### Reihenfolge der Umsetzung

1. **Erst `requirements.txt`-Fix + vacuous-asserts loeschen** (sonst ist erste CI sofort rot bzw. luegt-gruen).
2. **`test.yml` mergen** und Branch-Protection scharfstellen.
3. **Coverage-Gate ab 50% einschalten**, langsam hochziehen.
4. **E2E auf merge-PR-only** lassen — sonst bremst es Feature-Branches.
5. **Sprach-Logik-Fix** in eigenem PR mit `test_language_routing.py` als erstes Feature, das die neue Pipeline durchlaeuft.

---

## 6. Wie die Armada in Zukunft genutzt wird

**Pflicht-Gate vor jedem `git push origin main`:**
1. `qa-reviewer` — Tests, Validation, Idempotenz.
2. `devils-advocate` — Hidden Assumptions, Failure Modes.
3. `ux-ui-reviewer` — falls UI geaendert.
4. `security-auditor` — falls Auth/CORS/Endpoints geaendert.

**Anlass-bezogen:**
- DB-Migration → `database-optimizer`.
- LLM-Prompt-Aenderung → `prompt-engineer` + `ai-engineer`.
- Performance-Beschwerde → `performance-engineer`.
- Pilot-Skalierungs-Vorbereitung → `architect-reviewer` + `privacy-architect`.
- CI/CD-Aenderung → `deployment-engineer` + `test-automator`.

**Nicht mehr machen:**
- **Kein Selbst-Review.** Wenn derselbe Agent Code schreibt UND reviewt, entsteht Bias (Round-3-Score 9.5+ war so zustande gekommen, die frische Armada hat 6 P0-Befunde gefunden).
- **Keine 9.x-Scores als Ship-Signal interpretieren** — interne Reviews sind kein externer Audit.

**Kommunikations-Standard mit Agenten:**
- Lese-Liste explizit (`Read backend/app/X.py`).
- Wort-Obergrenze (`unter 300 Woertern`).
- P0/P1/P2-Format mit `file:line`.
- Re-Review-Kontext: „diese App wurde mit Opus 4.5 gebaut, jetzt frisch mit Opus 4.7 reviewen — keine generischen Best-Practice-Phrasen, nur konkrete Befunde aus DIESEM Code."

---

## 7. Naechste Schritte (empfohlen)

In dieser Reihenfolge — jeder Block in eigenem PR:

1. **Auto-Testing aktivieren** (Abschnitt 5, Schritt 1-3). Niedriges Risiko, hoher Schutzwert.
2. **Sprach-Logik-Fix** (Abschnitt 4). Direktes User-sichtbares Issue, blockt Pilot-Vertrauen.
3. **P0-1 + P0-2** (Credits-Refund + Partial-Failure-Status). Geld-Pfad, blockiert User-Vertrauen.
4. **P0-4 + P0-5** (Logout + SECRET_KEY). Auth-Hygiene.
5. **P1-Privacy-Block** (P1-1, P1-2, P1-3). Vor erster Aufnahme echter Schweizer Pilot-Nutzer Pflicht.
6. **P0-6 + P1-15** (DB-Drift + Single-Source-of-Truth fuer Doc-Types). Architekturschulden vor Skalierung.
7. **A11y-Block** (P1-16, P1-17, P1-18, P1-19, P1-20). User-Dashboard auf Deutsch + WCAG-AA.
8. **Performance-Block** (P1-7, P1-8, P1-9). Bei steigendem Verkehr.

Jeder dieser PRs sollte **mindestens** durch `qa-reviewer` und `devils-advocate` laufen, bevor er gemerged wird.

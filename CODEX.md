# Conversation Log

## Findings Summary
- [Critical] WeasyPrint rendert untrusted HTML aus userkontrollierten URLs und darf externe/`file://` Ressourcen laden → SSRF/Local-File-Read möglich (`backend/app/api/endpoints/jobs.py:177`, `backend/app/api/endpoints/jobs.py:203`).
- [High] SSRF-Schutz prüft nur die Start-URL; Redirects/DNS-Rebinding werden nicht erneut validiert, da `allow_redirects=True` genutzt wird (`backend/app/api/endpoints/jobs.py:69`, `backend/app/api/endpoints/jobs.py:215`).
- [High] Pfadtraversal beim Upload: `file.filename` fließt ungefiltert in `unique_filename`, damit kann `../` aus `uploads/<user>` ausbrechen (`backend/app/api/endpoints/documents.py:84`).
- [High] `doc_types` werden nicht validiert, aber für `storage_path` und Credits verwendet → Pfadmanipulation + Credits für nicht unterstützte Typen (`backend/app/api/endpoints/applications.py:1205`, `backend/app/api/endpoints/applications.py:505`).
- [Medium] JobOffer-Lookups nur über URL (kein `user_id`) → potenzielles Cross-User-Leak/inkonsistente `job_offer_id` Zuordnung (`backend/app/api/endpoints/applications.py:667`, `backend/app/api/endpoints/applications.py:893`).
- [Low] Access Token wird in `localStorage` persistiert (XSS-Replay-Risiko); httpOnly Cookie wäre robuster (`frontend/lib/api.ts:154`).
- [High] Keine automatische Testausführung (CI) vorhanden; `.github/workflows` enthält nur Claude‑Workflows.
- [Medium] Frontend‑E2E nutzt `localStorage`‑Keys `token`/`user`, die App nutzt `access_token` → Auth‑abhängige Tests brechen wahrscheinlich (`frontend/e2e/fixtures/auth.ts`, `frontend/lib/api.ts`).
- [Medium] E2E nutzt `generatingApplications`, App nutzt `activeGenerationTasks` → Status‑Tests für Generierung laufen ins Leere (`frontend/e2e/flows/document-generation-flow.spec.ts`, `frontend/app/dashboard/page.tsx`).
- [Low] Backend‑Tests können scheitern, weil `openai` importiert wird, aber in `backend/requirements.txt` fehlt (`backend/app/api/endpoints/jobs.py`).

## User
<environment_context>
  <cwd>/Users/alexgiss/EasyBewerbung</cwd>
  <approval_policy>on-request</approval_policy>
  <sandbox_mode>workspace-write</sandbox_mode>
  <network_access>restricted</network_access>
  <shell>zsh</shell>
</environment_context>

## User
bitte analysiere diesen Repo und finde Probleme

## Assistant
**Findings**
- [Critical] WeasyPrint rendert untrusted HTML aus userkontrollierten URLs und darf externe/`file://` Ressourcen laden → SSRF/Local-File-Read möglich (`backend/app/api/endpoints/jobs.py:177`, `backend/app/api/endpoints/jobs.py:203`).
- [High] SSRF-Schutz prüft nur die Start-URL; Redirects/DNS-Rebinding werden nicht erneut validiert, da `allow_redirects=True` genutzt wird (`backend/app/api/endpoints/jobs.py:69`, `backend/app/api/endpoints/jobs.py:215`).
- [High] Pfadtraversal beim Upload: `file.filename` fließt ungefiltert in `unique_filename`, damit kann `../` aus `uploads/<user>` ausbrechen (`backend/app/api/endpoints/documents.py:84`).
- [High] `doc_types` werden nicht validiert, aber für `storage_path` und Credits verwendet → Pfadmanipulation + Credits für nicht unterstützte Typen (`backend/app/api/endpoints/applications.py:1205`, `backend/app/api/endpoints/applications.py:505`).
- [Medium] JobOffer-Lookups nur über URL (kein `user_id`) → potenzielles Cross-User-Leak/inkonsistente `job_offer_id` Zuordnung (`backend/app/api/endpoints/applications.py:667`, `backend/app/api/endpoints/applications.py:893`).
- [Low] Access Token wird in `localStorage` persistiert (XSS-Replay-Risiko); httpOnly Cookie wäre robuster (`frontend/lib/api.ts:154`).

**Questions / Assumptions**
- Soll `job_offer_url` pro User isoliert sein (Filter auf `user_id`), oder ist Cross-User-Teilen bewusst?
- Sollen nur `ALLOWED_GENERATED_DOC_TYPES` erlaubt sein, damit Pfade/Credits konsistent bleiben?

**Change Summary**
- Keine Änderungen vorgenommen; keine Tests ausgeführt.

Wenn du willst, kann ich Fixes vorschlagen/umsetzen:  
1. SSRF/WeasyPrint härten (Redirect-Validierung + restriktiver URL-Fetcher).  
2. Filename- und `doc_type`-Sanitizing + Validierung gegen `ALLOWED_GENERATED_DOC_TYPES` + User-Scoping bei JobOffer.

## User
ich habe mal ein "automatisches" testen in diesem repo hereinprogrammieren lassen, ist es noch da ?  ist es funktionstüchtig ?

## Assistant
Kurzantwort: Tests sind noch im Repo, aber es gibt aktuell keine automatische Ausführung (CI), und mindestens die E2E‑Suite wirkt nicht mehr funktionsfähig.

**Was vorhanden ist**
- Backend‑Tests mit pytest: `backend/tests/test_applications.py`, `backend/tests/test_jobs.py`, `backend/tests/test_language_catalog.py` (Deps in `backend/requirements.txt`)
- Frontend E2E/Visual‑Tests mit Playwright: `frontend/e2e`, Config `frontend/playwright.config.ts`, Scripts `frontend/package.json`

**Automatisierung**
- In `.github/workflows/claude.yml` und `.github/workflows/claude-code-review.yml` gibt es nur Claude‑Workflows, kein Test‑Workflow → nichts läuft automatisch.

**Funktionstüchtig? (aus statischer Sicht)**
- Frontend‑E2E ist sehr wahrscheinlich kaputt: Tests setzen/prüfen `localStorage`‑Keys `token`/`user` (`frontend/e2e/fixtures/auth.ts`, `frontend/e2e/flows/registration-flow.spec.ts`), die App nutzt aber `access_token` (`frontend/lib/api.ts`). Das bricht Auth‑abhängige Tests.
- Zudem verwenden Tests `generatingApplications` (`frontend/e2e/flows/document-generation-flow.spec.ts`), die App nutzt `activeGenerationTasks` (`frontend/app/dashboard/page.tsx`, `frontend/app/applications/[id]/page.tsx`).
- Backend‑Tests können je nach Umgebung scheitern, weil `openai` in `backend/requirements.txt` fehlt, aber in `backend/app/api/endpoints/jobs.py` importiert wird.

Wenn du möchtest, kann ich:
1) `pytest` im `backend` ausführen und die Ergebnisse berichten  
2) `npm run test:e2e` im `frontend` laufen lassen (falls die Playwright‑Browser installiert sind)

## User
bitte speichere die ganze konversation in CODEX.md

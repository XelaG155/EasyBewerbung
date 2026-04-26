# Quality Log — EasyBewerbung 2026.04 Iteration

Iterations-Protokoll fuer den Re-Review-Lauf nach STANDARDS/instructions_quality.md.
Ziel: alle Pflicht-Agenten (QA, Devil's Advocate, UX/UI, Testing) >= 9.5 / 10.

## Setup

- Branch: `main` (lokal, nicht gepusht bis 9.5 erreicht)
- Test-Suite vor Iteration 1: 151 passed, 5 skipped (Postgres-Integration)
- Frontend `tsc --noEmit`: clean
- Commits seit Re-Review-Start: 23

## Stages bisher (Phase 1, vor Iteration 1)

| Stage | Inhalt | Status |
|---|---|---|
| 1 | Auto-Testing-Pipeline (CI) | ✅ |
| 2 | Sprach-Routing nach Empfaenger | ✅ |
| 3 | Credits-Refund + Partial-Failure | ✅ |
| 4 | SECRET_KEY fail-fast | ✅ |
| 5 | Logout + Token-Revocation | ✅ |
| 6 | DSAR (DELETE /me, GET /me/export) | ✅ |
| 7 | Privacy-Policy-Rewrite (revDSG/DSGVO/KI-VO) | ✅ |
| 8 | Rate-Limit-Luecken | ✅ |
| 9 | Duplikat-`get_llm_client` weg | ✅ |
| 10 | bcrypt-Prehash + PII-Logger | ✅ |
| 11 | DB-Indexe (Hot-Paths) | ✅ |
| 12 | DB-Pool-Tuning | ✅ |
| 13 | A11y (Input/Modal/lang/ErrorBoundary) | ✅ |
| 14 | User-Dashboard Deutsch (i18n) | ✅ |
| 15 | LLM-Timeout/Retry/Anthropic-Caching | ✅ |
| 16 | Sync→Async | ⏸️ defer (invasive, eigener PR-Cycle) |

Stage 16 ist bewusst aufgeschoben: aendern aller `async def` → `def` in
applications.py + users.py wuerde alle Tests brechen, die direkt diese
Funktionen aufrufen. Performance-Auswirkung ist bei Pilot-Volumen
(< 100 gleichzeitige User) gering. Eigener PR-Cycle nach Pilot-Feedback.

## Iterations-Logbuch

### Iteration 1 — 2026-04-26 (commit cbeadb4)

| Agent | Score | Kommentar |
|---|---|---|
| QA | 8.1 | solid, aber Credit-Race + fehlende Audit-Logs + Rate-Limit-Luecken |
| Devil's Advocate | 6.1 | Alembic laeuft nicht in Prod, falsche Privacy-Policy-Claims, Credit-Race |
| UX/UI | 7.4 | window.confirm, fehlende Focus-Rings, untranslated Auth-Strings |
| Testing | 6.5 | E2E vacuous-asserts noch da, fehlende Admin/Applications-Coverage |

**P0 — wird in Iteration 2 adressiert:**

1. Alembic-Migration in Dockerfile-Entrypoint einhaengen (DA P0-A)
2. `SELECT FOR UPDATE` auf Credit-Deduction in `/generate` (QA + DA P0-B)
3. Privacy-Policy entweder Backups + DPAs implementieren ODER ehrlich rausnehmen (DA P0-C)
4. 10 englische Auth/Settings-Strings in `de.json`/`de-CH.json` uebersetzen (UX/UI P0-B)
5. `focus-visible`-Ring auf alle Buttons (UX/UI P0-C)
6. `window.confirm()` -> accessible Modal-Confirmation fuer Delete-Aktionen (UX/UI P0-A)
7. Vacuous-Asserts in `frontend/e2e/flows/` ehrlich machen oder skippen (Testing P0)

### Iteration 2 — 2026-04-26 (commits 3f50b72..25bc73b, 11 Commits)

Adressiert: alle 7 P0 + 4 P1 aus Iteration 1.

**P0:**
- ✅ Alembic via Container-Entrypoint (`scripts/bootstrap_db.py` — `create_all` + stamp baseline + `upgrade head`).
- ✅ Credit-Race: `SELECT FOR UPDATE` in `/generate` plus `record_activity`-Audit-Log plus Doc-Type-Whitelist mit 400er-Reject.
- ✅ Privacy-Policy: Backup- und DPA-Versprechen ehrlich gemacht (Pre-Pilot-Sprache statt False Claim).
- ✅ 10 englische Auth/Settings-Strings -> Deutsch in de.json + de-CH.json.
- ✅ `focus-visible`-Ring auf alle Buttons + `prefers-reduced-motion`-Guard auf Spinner und Transitions.
- ✅ `window.confirm()` -> neue `ConfirmDialog`-Komponente (Modal-basiert, role/aria, Schweizer Copy).
- ✅ Vacuous-E2E-Specs: 3 Files mit `test.describe.fixme()` plus Status-Kommentar.

**P1:**
- ✅ `calculate_matching_score_task` durch `get_llm_client` / `generate_with_llm` (Env-konfigurierbar via `MATCHING_SCORE_PROVIDER` + `MATCHING_SCORE_MODEL`).
- ✅ 8 weitere Read-Endpoints mit Rate-Limit (`/history`, `/rav-report`, `/{id}`, etc.).
- ✅ Coverage-Gate `--cov-fail-under=55` mit Ratchet-Plan auf 75.
- ✅ Test-Suite: 159 passed (vorher 151) + 8 neue End-to-End-Tests fuer `/generate`-Endpunkt (test_generate_endpoint.py).

### Iteration 3 — 2026-04-26 (Re-Review)

| Agent | Score | Delta vs Iteration 1 |
|---|---|---|
| QA | 8.6 | +0.5 |
| Devil's Advocate | 7.2 | +1.1 |
| UX/UI | 7.5 | +0.1 (marginal) |
| Testing | 7.5 | +1.0 |

**Neue P0:**

1. **DA**: `default_client = OpenAI(...)` in `tasks.py:895/919` (no-template-Fallback-Pfad) ohne Timeout, hardcoded `gpt-4`. Wurde in Iteration 2 NICHT umgestellt; nur der Template-Pfad und der Matching-Score gehen jetzt durch `get_llm_client`. Crashes wenn `OPENAI_API_KEY` fehlt.
2. **QA**: HTTP-Layer-Test fuer `POST /applications` fehlt (nur `create_application` direkt, ohne TestClient).
3. **QA**: Englische Error-Messages im `/generate`-Endpoint („Insufficient credits..." statt Deutsch).

**Verbleibende P1:**

UX/UI:
- 4 residual `alert()`-Calls in `handleUpdateApplicationStatus`, `handleDownloadRAV`, `handleDownloadJobPDF`, `handleDownloadOriginalJobPDF`.
- Inline `<p>`-Errors ohne `role="alert"` an 3 Stellen (uploadError, analysisError, spontaneousError).
- Mobile-Nav-Luecke: Settings/Logout `hidden sm:inline-flex` ohne Fallback.
- `border-slate-700` hardcoded in `dashboard/page.tsx:1167`.
- `Modal.tsx:104` nutzt `dark:` statt CSS-Vars.
- Kein Success-Toast nach Upload / Spontane-Bewerbung-Save.

Testing:
- Vacuous-Assertion-Bodies in fixme'd Specs noch da (latentes Risiko bei `fixme`-Entfernung).
- Coverage-Gate auf 55% — Ratchet auf 65 noch nicht enforced.
- Admin- + Applications-HTTP-Tests fehlen.
- ESLint `continue-on-error: true` ohne Baseline.

DA:
- Empty-Reference-Letter-Edge-Case (`tasks.py:536-546`): leerer `content_text` produziert "No text content"-Prompt-Fragment, LLM erfindet Inhalt.
- Privacy-Policy Future-Tense-Versprechen ("vor Aufnahme des Pilotbetriebs") als Live-Text fragwuerdig.

### Iteration 4 — 2026-04-26 (commits 6b89c02..f4457dc, 7 Commits)

Adressiert: alle DA-P0 sowie alle UX/UI- und QA-P1 aus Iteration 3.

**P0:**
- ✅ `default_client`-Fallback in `tasks.py` durch `get_llm_client` ersetzt (Env-konfigurierbar via `DEFAULT_LLM_PROVIDER` + `DEFAULT_LLM_MODEL`).
- ✅ Empty-Reference-Letter-Guard: Filter auf `content_text.strip()`, kein "No text content"-Fragment im Prompt mehr.
- ✅ German Error-Messages in `/generate` (5 Strings: 404 Bewerbung, 400 leere doc_types, 400 unbekannter Typ, 400 kein CV, 402 nicht genug Credits).
- ✅ HTTP-Layer-Tests fuer `applications.py` (8 Tests, `tests/test_applications_http.py`).

**P1:**
- ✅ HTTP-Layer-Tests fuer `admin.py` (12 Tests, `tests/test_admin_http.py` — Credit-Adjust, Toggle-Active, Toggle-Admin, Auth-Gate).
- ✅ 4 residual `alert()`-Calls durch accessible Toast-Banner ersetzt (`role="alert"` fuer Fehler, `role="status"` fuer Success, 5s Auto-Dismiss).
- ✅ Success-Toast nach Upload, Stelleninserat-Analyse, Spontane-Bewerbung.
- ✅ `role="alert"` auf 3 inline Error-`<p>`-Elemente (uploadError, analysisError, spontaneousError).
- ✅ Mobile-Nav-Fallback-Reihe fuer Settings/Logout/Admin unter 640px.
- ✅ `border-slate-700` -> `border-muted` in dashboard.
- ✅ `Modal.tsx` von `dark:`-Literals auf CSS-Variablen migriert.

**Tests-Stand:** 180 passed, 5 skipped (vorher 159). Coverage 59% (vorher 56%). Coverage-Gate bei 55%.

### Iteration 5 — 2026-04-26 (commits c99f143..7209e25, 4 Commits)

Adressiert: alle in Iteration 4 gefundenen Restpunkte.

**QA:**
- ✅ ESLint blocking mit Warning-Baseline ceiling 95 (gegen 89 aktuell). 0 errors.
- ✅ Coverage-Gate-Ratchet 55 → 58.
- ✅ admin.py negative-balance Error-Message auf Deutsch.
- ✅ 3 neue Tests fuer GET /documents/catalog.

**Testing:**
- ✅ Vacuous-Bodies aus 3 fixme-Specs komplett ENTFERNT (1026 Zeilen Code geloescht, durch ehrliche `test.fixme()`-Shells ersetzt mit TODO-Kommentar zu `data-testid`-Hooks).

**UX/UI:**
- ✅ Credits-Chip auf `.chip` + CSS-vars (kein dark-mode-only).
- ✅ Application-Badges (Spontanbewerbung / Praktikum / Lehrstelle) auf `.chip`.
- ✅ Status-Update- und Original-Inserat-Buttons auf `btn-base btn-secondary` / `btn-base btn-primary`.
- ✅ `de-CH.json` letzte englische Zeile (`downloadPdfFailed`) übersetzt.
- ✅ Status-Update Modal mit `<datalist>` (6 Schweizer Status-Vorschlaege) + `aria-describedby`-Hint.
- ✅ loadData()-Error jetzt sichtbar (Action-Banner mit Reload-Hinweis statt silent console.error).

**Tests-Stand:** 183 passed, 5 skipped (vorher 180). Coverage 59% bei Gate 58.





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

**Verbleibend fuer Iteration 3 falls Score < 9.5:**
- Tests fuer admin.py HTTP-Layer (Credit-Grant, Toggle-Active, Toggle-Admin)
- Tests fuer applications.py HTTP-Layer (Create/List/Patch/Delete)
- Inline-Error `<p>`-Elemente auf `role="alert"` umstellen (UX/UI P1-A)
- `border-slate-700` -> `border-muted` in dashboard/page.tsx (UX/UI P1-B)
- Mobile-Nav-Hamburger fuer Settings/Logout unter 640px (UX/UI P1-F)





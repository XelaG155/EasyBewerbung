import { test } from '@playwright/test';

/**
 * Admin Page E2E
 *
 * STATUS (2026-04-26): empty placeholder bodies.
 *
 * Backend admin endpoints (credit grant, lock/unlock, demote/promote,
 * document-type CRUD, LLM-model CRUD) are well-tested via FastAPI
 * TestClient in:
 *   - backend/tests/test_admin_http.py            (12 tests)
 *   - backend/tests/test_document_types_endpoints.py (48 tests)
 *
 * The Playwright shells below cover the navigation/visual layer.
 * Real coverage will follow once the admin page exposes stable
 * ``data-testid="user-search"``, ``data-testid="credit-grant-form"``,
 * ``data-testid="user-row-{id}"`` etc. Replace each empty body with
 * a real assertion chain and only then remove ``test.fixme``.
 */

test.describe('Admin Page', () => {
    test.fixme('admin can search users (TODO)', async () => {});
    test.fixme('admin can grant credits to user (TODO)', async () => {});
    test.fixme('admin can toggle active state (TODO)', async () => {});
    test.fixme('admin can toggle admin role (TODO)', async () => {});
    test.fixme('admin can edit document types (TODO)', async () => {});
    test.fixme('admin can edit LLM models (TODO)', async () => {});
    test.fixme('non-admin redirected away (TODO)', async () => {});
});

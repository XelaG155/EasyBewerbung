#!/bin/sh
# Container entrypoint for the FastAPI backend.
#
# Runs Alembic migrations to head BEFORE starting uvicorn / celery so that
# columns added by recent migrations (tokens_invalidated_after,
# credits_held / credits_refunded / failed_docs, the hot-path indexes) are
# present on every Pod / container boot — including existing production
# databases that were originally bootstrapped via init_db.create_all and
# have NEVER had Alembic run against them.
#
# The CMD passed in docker-compose.yml is what gets exec'd at the end
# (uvicorn for the backend, celery worker for the worker service).
set -e

cd /app

# bootstrap_db.py reconciles the schema before the app starts:
# 1) create_all to guarantee tables exist (no-op on populated DBs)
# 2) stamp alembic_version to baseline if empty
# 3) alembic upgrade head to apply any post-baseline migrations
#
# Failing here is intentional — we DO NOT want to silently start the app
# against an inconsistent schema, which is what would have happened
# under the previous "uvicorn-only" CMD.
echo "[entrypoint] Reconciling DB schema..."
python -m scripts.bootstrap_db
echo "[entrypoint] Schema OK. Handing off to: $*"

exec "$@"

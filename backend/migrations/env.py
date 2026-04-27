import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

sys.path.append(str((__file__).rsplit('/migrations/', 1)[0]))

from app.models import Base  # noqa: E402
from app.database import DATABASE_URL as _APP_DATABASE_URL  # noqa: E402

config = context.config

# Resolve the migration target URL at runtime so callers (e.g. integration
# tests that point Alembic at a real Postgres via `cfg.set_main_option` or
# `os.environ["DATABASE_URL"] = ...`) actually take effect. Previously this
# unconditionally pinned the URL to the value `app.database` cached at
# module-import time, which silently sent migrations to the cached SQLite URL
# even when the caller had switched DATABASE_URL to Postgres.
_runtime_url = (
    config.get_main_option("sqlalchemy.url")
    if config.get_main_option("sqlalchemy.url") not in (None, "", "postgresql://localhost/easybewerbung")
    else os.environ.get("DATABASE_URL") or _APP_DATABASE_URL
)
config.set_main_option("sqlalchemy.url", _runtime_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

#!/bin/bash
set -euo pipefail

# Resolve script directory to allow relocatable execution
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

source venv/bin/activate

# Default to the port advertised in README; allow override via PORT env
PORT="${PORT:-8000}"
exec uvicorn app.main:app --host 127.0.0.1 --port "${PORT}"

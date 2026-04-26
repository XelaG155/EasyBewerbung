# Backend Dockerfile for EasyBewerbung
# Uses Python 3.11 with system deps for WeasyPrint PDF generation

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for WeasyPrint, python-magic, and PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libcairo2 \
    fonts-dejavu-core \
    # python-magic dependency
    libmagic1 \
    # PostgreSQL client (for psycopg2)
    libpq-dev \
    # Build tools (needed for some Python packages)
    gcc \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Make entrypoint script executable (defensive — chmod is also set on host)
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8000

# entrypoint.sh runs `alembic upgrade head` before exec'ing the CMD so
# every container boot reconciles the schema — including the worker
# service whose CMD is overridden in docker-compose.yml. This was the
# fix for the silent-broken-token-revocation and silent-broken-credit-
# refund bug: production was bootstrapped via init_db.create_all, and
# create_all NEVER adds columns to existing tables.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

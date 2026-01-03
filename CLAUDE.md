# Claude Code Guidelines for EasyBewerbung

## Project Overview
EasyBewerbung is a job application platform with AI-powered features for resume creation and job matching.

## Tech Stack
- **Frontend**: Next.js (React) on port 3001
- **Backend**: FastAPI (Python) on port 8002
- **Database**: PostgreSQL with Alembic migrations
- **Process Manager**: PM2
- **Domain**: https://app.easybewerbung.ch

## Code Style

### Python (Backend)
- Python 3.11+ with type hints
- FastAPI for REST API endpoints
- Pydantic for data validation
- Follow PEP 8 guidelines

### TypeScript/JavaScript (Frontend)
- Next.js App Router conventions
- TypeScript preferred
- Functional components with hooks
- Tailwind CSS for styling

## Architecture

### Backend (`backend/`)
- `main.py` - FastAPI application entry
- `routers/` - API route handlers
- `models/` - SQLAlchemy models
- `schemas/` - Pydantic schemas
- `services/` - Business logic

### Frontend (`frontend/`)
- `app/` - Next.js app router pages
- `components/` - React components
- `lib/` - Utility functions
- `styles/` - CSS/Tailwind styles

## Database
- PostgreSQL with SQLAlchemy ORM
- Alembic for migrations: `alembic upgrade head`
- Connection via environment variables

## Docker Services
EasyBewerbung runs as a Docker Compose stack:
- `easybewerbung-backend` - FastAPI backend (port 8002)
- `easybewerbung-frontend` - Next.js frontend (port 3001)
- `easybewerbung_worker` - Celery workers (5 replicas)
- `easybewerbung-db` - PostgreSQL database (port 5433)
- `easybewerbung-redis` - Redis message broker (port 6380)

Commands:
- Start: `docker-compose up -d`
- Stop: `docker-compose down`
- Rebuild: `docker-compose build --no-cache`
- Logs: `docker-compose logs -f [service]`

## Deployment
- Pushes to `main` trigger automatic deployment via GitHub webhook
- Webhook pulls code and runs `docker-compose build --no-cache`
- Then runs `docker-compose up -d` to restart containers
- Telegram notifications for deployment status

## Security
- Never commit API keys or tokens
- Use environment variables for sensitive data
- Keep `.env` file out of version control

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

## PM2 Services
- `EASYBEWERBUNG_SRV` - Backend FastAPI
- `easybewerbung-frontend` - Next.js frontend

## Deployment
- Pushes to `main` trigger automatic deployment via GitHub webhook
- Backend: pip install + alembic migrations
- Frontend: npm install + npm run build
- PM2 restarts both services
- Telegram notifications for deployment status

## Security
- Never commit API keys or tokens
- Use environment variables for sensitive data
- Keep `.env` file out of version control

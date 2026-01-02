# EasyBewerbung Quick Reference

## Local Development with Docker

### Prerequisites
- Docker Desktop installed and running
- `.env` file in project root (copy from `.env.docker` and add your secrets)

### Start Everything
```bash
docker compose up -d
```

### Access the App
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
```

### Stop Services
```bash
# Stop (keeps data)
docker compose down

# Stop and remove all data
docker compose down -v
```

### Rebuild After Code Changes
```bash
# Rebuild specific service
docker compose build backend
docker compose build frontend

# Rebuild and restart
docker compose up -d --build
```

## Scaling Workers

For high traffic, scale the Celery workers:
```bash
# Run 3 workers
docker compose up -d --scale worker=3

# Check worker count
docker compose ps
```

## Database Access

### Connect to PostgreSQL
```bash
docker compose exec db psql -U easybewerbung
```

### Common SQL Commands
```sql
-- List tables
\dt

-- View users
SELECT id, email, full_name FROM users;

-- View applications
SELECT id, job_title, company FROM applications;

-- Exit
\q
```

## Troubleshooting

### Check Service Health
```bash
docker compose ps
```

### Restart a Specific Service
```bash
docker compose restart backend
docker compose restart worker
```

### View Container Resource Usage
```bash
docker stats
```

### Clear Everything and Start Fresh
```bash
docker compose down -v
docker compose up -d --build
```

## Auto-Initialization

On first startup, the backend automatically:
- Creates all database tables
- Seeds 61 languages
- Seeds 15 document templates

No manual setup required when deploying to a new environment.

## Environment Variables

Required in `.env`:
```
POSTGRES_PASSWORD=your-db-password
SECRET_KEY=your-jwt-secret-key
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_CLIENT_ID=your-google-oauth-id  # optional
```

## Architecture

```
                    ┌─────────────┐
                    │   Frontend  │ :3001
                    │  (Next.js)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │ :8000
                    │  (FastAPI)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │  PostgreSQL │ │ Redis │ │   Worker    │
       │     :5432   │ │ :6379 │ │  (Celery)   │
       └─────────────┘ └───────┘ └─────────────┘
```

## GitHub Actions

Docker images are automatically built on push to `main`:
- Images pushed to: `ghcr.io/your-username/easybewerbung/backend`
- Images pushed to: `ghcr.io/your-username/easybewerbung/frontend`

To use pre-built images instead of building locally:
```bash
docker pull ghcr.io/your-username/easybewerbung/backend:latest
docker pull ghcr.io/your-username/easybewerbung/frontend:latest
```

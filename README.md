# EasyBewerbung

Job application management platform for multilingual workers. Upload documents, track applications, and generate reports in 33+ languages.

## Features

- **Document Management**: Upload CVs, diplomas, and references with automatic PDF text extraction
- **Job Analysis**: Paste job URLs to automatically extract company and position details
- **Application Tracking**: Keep track of all applications in one place
- **Swiss RAV Reports**: Generate job search reports for Swiss unemployment offices
- **Multilingual**: Support for 33+ languages
- **Secure**: JWT authentication, user-isolated data, file validation

## Internationalization (i18n) and Localization (l10n)

- **UTF-8 everywhere**: All services run with UTF-8 encoding to safely handle CJK, RTL, and emoji characters.
- **ISO language codes**: The backend exposes language options with ISO 639-1/locale codes and text direction via `/users/languages` (see `backend/app/language_catalog.py`). Clients should send the code while displaying the human-friendly label.
- **Content separation**: Keep UI copy in resource files (e.g., JSON for the frontend) instead of hardcoding strings to make adding new locales trivial.
- **Locale-aware formatting**: Use browser/Intl APIs (or libraries like `i18next`/`react-intl`) for dates, numbers, and currency following CLDR rules.
- **RTL & expansion ready**: Layouts should rely on logical CSS properties (e.g., `margin-inline-start`) and flexible sizing so RTL locales and longer translations render correctly.

## Tech Stack

**Backend:**
- FastAPI (Python) on port 8002
- SQLAlchemy (ORM)
- PostgreSQL (Database)
- Alembic (Database migrations)
- JWT Authentication
- Celery (Background task processing)
- Redis (Message broker)
- PDF text extraction
- Web scraping for job analysis

**Frontend:**
- Next.js 16.1.1 (React 19.2.3) on port 3001
- TypeScript 5
- Tailwind CSS 4
- Client-side auth management
- Playwright E2E testing framework

**Infrastructure:**
- Docker & Docker Compose
- PostgreSQL 16 (Alpine) - port 5433
- Redis 7 (Alpine) - port 6380
- Celery workers (5 replicas, 4 concurrent tasks each)

## Setup Instructions

### Docker Setup (Recommended for Production)

The easiest way to run EasyBewerbung is using Docker Compose:

1. Clone the repository:
```bash
git clone https://github.com/XelaG155/EasyBewerbung.git
cd EasyBewerbung
```

2. Copy and configure environment file:
```bash
cp .env.docker.example .env
```

Edit `.env` and set your actual values (never commit this file!):
- `SECRET_KEY` - Generate with `openssl rand -hex 32`
- `POSTGRES_PASSWORD` - Set a strong database password
- `OPENAI_API_KEY` - Your OpenAI API key for document generation
- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude-based generation (optional)
- `GOOGLE_API_KEY` - Your Google API key for Gemini-based generation (optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional, for Google Sign-In)

3. Start all services:
```bash
docker-compose up -d
```

This will start:
- Backend API on `http://localhost:8002`
- Frontend on `http://localhost:3001`
- PostgreSQL database on port 5433
- Redis on port 6380
- 5 Celery worker instances for background tasks

4. Check service status:
```bash
docker-compose ps
docker-compose logs -f [service-name]
```

5. Stop services:
```bash
docker-compose down
```

6. Rebuild after code changes:
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Backend Setup (Local Development)

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Apply database migrations (uses Alembic):
```bash
alembic -c alembic.ini upgrade head
```

5. Create environment file:
```bash
cp .env.example .env
```

Then edit `.env` and set a secure SECRET_KEY (generate with `openssl rand -hex 32`).

6. Start the backend server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

The default configuration points to `http://localhost:8000` for the API.

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Testing

### Backend Tests (pytest)

The backend includes pytest-based test suite for API endpoints and core functionality:

```bash
cd backend
pytest
```

Test coverage includes:
- Authentication and login lockout
- Language catalog functionality
- Job analysis endpoints
- Application management

### Frontend Tests (Playwright)

End-to-end testing with Playwright for UI workflows:

```bash
cd frontend

# Run E2E tests (Chromium only)
npm run test:e2e

# Run all browsers
npm run test:e2e:all

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Visual regression tests
npm run test:visual

# Mobile testing
npm run test:mobile

# View test report
npm run test:report
```

## Google OAuth Setup (Optional)

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen
6. Set **Authorized JavaScript origins**: `http://localhost:3000`
7. Set **Authorized redirect URIs**: `http://localhost:3000`
8. Copy the **Client ID**
9. Add to backend `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
10. Add to frontend `.env.local`:
    ```
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
    ```
11. Restart both servers

**Note:** Google OAuth is optional. Users can still register/login with email and password.

## Usage

1. **Register**: Create an account at `/register` (via email or Google)
2. **Upload Documents**: Go to the dashboard and upload your CV
3. **Add Jobs**: Paste job offer URLs to analyze and track
4. **Track Applications**: View all applications in one place
5. **Export RAV Report**: Download formatted reports for Swiss unemployment offices

## API Endpoints

### Authentication
- `POST /users/register` - Register new user
- `POST /users/login` - Login user
- `POST /users/google` - Login/register with Google OAuth
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update user profile

### Documents
- `POST /documents/upload` - Upload document
- `GET /documents/` - List user's documents
- `DELETE /documents/{id}` - Delete document
- `GET /documents/catalog` - Get document templates

### Jobs
- `POST /jobs/analyze` - Analyze job offer from URL

### Applications
- `POST /applications/` - Create application
- `GET /applications/history` - List applications
- `GET /applications/{id}` - Get specific application
- `PATCH /applications/{id}` - Update application
- `GET /applications/rav-report` - Generate RAV report

## Security Features

EasyBewerbung implements multiple layers of security:

- **Authentication**: JWT token-based authentication with expiration
- **Password Security**: Bcrypt hashing with proper salt generation
- **Data Isolation**: User-specific data queries prevent unauthorized access
- **File Upload Protection**:
  - Multi-layer validation (extension, magic number, size limit: 25MB)
  - User-specific directories with UUID filenames
  - Path traversal prevention
- **XSS Protection**: HTML sanitization for scraped job content
- **SSRF Protection**: URL validation preventing localhost/private IP access
- **SQL Injection Prevention**: SQLAlchemy ORM with parameterized queries
- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: Implemented on authentication and critical endpoints
- **Admin Authorization**: Proper role-based access control

**For detailed security information, see [SECURITY.md](SECURITY.md)**

## Application Structure & Navigation

### Screen Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LANDING PAGE (/)                         │
│  - Hero section with features                                   │
│  - Login/Register buttons                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  LOGIN (/login) │       │ REGISTER        │
│  - Email/PW     │       │ (/register)     │
│  - Google OAuth │       │ - Name/Email/PW │
└────────┬────────┘       │ - Languages     │
         │                └────────┬────────┘
         └────────────┬────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD (/dashboard)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Upload      │  │ Spontaneous │  │ Analyze Job URL         │  │
│  │ Documents   │  │ Application │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ APPLICATION LIST                                           │  │
│  │ - Filter (Status, Month)                                   │  │
│  │ - View details -> /applications/[id]                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐              ┌─────────────────────┐
│ SETTINGS (/settings)│              │ APPLICATION DETAIL  │
│ - Profile           │              │ (/applications/[id])│
│ - Languages         │              │ - Matching Score    │
│ - Extended Profile  │              │ - Generate Docs     │
└─────────────────────┘              │ - Download/Delete   │
                                     └─────────────────────┘

═══════════════════════════════════════════════════════════════════
                         ADMIN AREA
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN (/admin)                              │
│  - Language Management                                           │
│  - User Search & Management (Credits, Lock, Admin Rights)       │
│  - Prompt Templates                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               ADMIN DOCUMENTS (/admin/documents)                 │
│  - Document Templates Configuration                              │
│  - Credit Costs, LLM Provider, Model                            │
│  - Prompt Templates, Active/Inactive                            │
└─────────────────────────────────────────────────────────────────┘
```

### All Pages

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing page with features | Public |
| `/login` | User login (Email/Google) | Public |
| `/register` | New user registration | Public |
| `/dashboard` | Main hub: documents, applications, job analysis | Authenticated |
| `/applications/[id]` | Application details, matching score, document generation | Authenticated |
| `/settings` | Profile, languages, preferences | Authenticated |
| `/admin` | User management, languages, prompts | Admin only |
| `/admin/documents` | Document template configuration | Admin only |

### Admin Document Management Features

The `/admin/documents` page provides complete control over document generation:

| Feature | Description |
|---------|-------------|
| **Hide/Show Document** | `is_active` toggle to hide templates from users |
| **Set Credits (0-X)** | `credit_cost` field (0 = free, up to 10 credits) |
| **LLM Provider** | Choose OpenAI, Anthropic/Claude, or Google/Gemini |
| **LLM Model** | Select specific model per template |
| **Prompt Template** | Full control over the generation prompt |

## Planned Feature: Prompt Builder

A planned enhancement for `/admin/documents` to generate prompts from natural language descriptions:

```
┌─────────────────────────────────────────────────────────────────┐
│  Prompt Builder Modal                                            │
├─────────────────────────────────────────────────────────────────┤
│  STRUCTURED OPTIONS:                                             │
│  - Tone:        [Formal] [Friendly] [Neutral]                   │
│  - Length:      [Short] [Medium] [Detailed]                     │
│  - Focus:       [x] Qualifications [x] Motivation [ ] Soft Skills│
│  - Audience:    [HR Manager]                                     │
├─────────────────────────────────────────────────────────────────┤
│  FREE TEXT DESCRIPTION:                                          │
│  "A cover letter that immediately convinces, highlights key      │
│   experience and shows why the applicant is perfect..."          │
├─────────────────────────────────────────────────────────────────┤
│  LLM FOR GENERATION: [OpenAI] [gpt-4o-mini] (configurable)      │
├─────────────────────────────────────────────────────────────────┤
│  [Generate Prompt]                                               │
│                                                                  │
│  GENERATED PROMPT:                                               │
│  "You are an experienced HR consultant with expertise in..."     │
│                                                                  │
│  [Apply] [Regenerate] [Cancel]                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Available Placeholders for Prompt Templates

Use these placeholders in your prompt templates. They will be automatically replaced with actual data during document generation:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{role}` | The AI's role/persona | "experienced career coach" |
| `{task}` | The main task description | "Write a professional cover letter" |
| `{job_description}` | Full job posting text + application context | Job requirements, company info |
| `{cv_text}` | Complete CV/resume text | Full uploaded CV content |
| `{cv_summary}` | Short CV summary (first 500 chars) | Brief qualification overview |
| `{language}` | Target language for document | "German", "English", "French" |
| `{documentation_language}` | User's preferred doc language | Same as `{language}` |
| `{company_profile_language}` | Language for company research | For company intelligence docs |
| `{instructions}` | Formatted list of all instructions | Numbered list of rules |
| `{reference_letters}` | Content of uploaded references | Reference letter text |

**Example prompt template:**
```
You are a {role}. {task}.

Job Details:
{job_description}

Candidate CV:
{cv_text}

Language: {language}

IMPORTANT INSTRUCTIONS:
{instructions}

Begin the cover letter now:
```

**Auto-injected context (not placeholders):**
- Application type (fulltime/internship/apprenticeship)
- User employment status
- User education type
- Additional profile context

## File Structure

```
EasyBewerbung/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/    # API route handlers
│   │   ├── models.py         # Database models
│   │   ├── auth.py           # Authentication utilities
│   │   ├── database.py       # Database configuration
│   │   └── main.py           # FastAPI app
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── app/                  # Next.js app router
│   │   ├── page.tsx          # Landing page
│   │   ├── login/            # Login page
│   │   ├── register/         # Register page
│   │   └── dashboard/        # Main app
│   ├── components/           # Reusable components
│   ├── lib/
│   │   ├── api.ts            # API client
│   │   └── auth-context.tsx  # Auth state management
│   └── .env.local
└── README.md
```

## Development Notes

### Local Development
- Backend runs on port 8000 (local) or 8002 (Docker)
- Frontend runs on port 3000 (local) or 3001 (Docker)
- Database: PostgreSQL (Docker) or SQLite (local dev)
- Uploads stored in: `backend/uploads/{user_id}/`

### Docker Services
- `easybewerbung-backend` - FastAPI backend (port 8002)
- `easybewerbung-frontend` - Next.js frontend (port 3001)
- `easybewerbung_worker` - Celery workers (5 replicas, 4 concurrent tasks each)
  - Handles queues: celery, matching, generation
  - Memory limit: 512MB per worker
- `easybewerbung-db` - PostgreSQL 16 (Alpine) database (port 5433)
- `easybewerbung-redis` - Redis 7 (Alpine) message broker (port 6380)

## Production Deployment

The application is configured for production deployment with Docker Compose.

### Deployment Workflow
- **Production URL**: https://app.easybewerbung.ch
- **Automatic Deployment**: Pushes to `main` branch trigger GitHub webhook
- **Webhook Service**: Runs on production server (`systemctl status easybewerbung-webhook`)
- **Deployment Process**:
  1. Webhook receives GitHub push notification
  2. Pulls latest code from `main` branch
  3. Rebuilds containers: `docker-compose build --no-cache`
  4. Restarts services: `docker-compose up -d`
  5. Sends Telegram notification with deployment status

### Production Checklist

Before deploying to production:

1. **Security Configuration**:
   - Generate secure `SECRET_KEY`: `openssl rand -hex 32`
   - Set strong `POSTGRES_PASSWORD` (16+ characters)
   - Configure AI provider API keys:
     - `OPENAI_API_KEY` - Required for OpenAI-based document generation
     - `ANTHROPIC_API_KEY` - Optional, for Claude-based generation
     - `GOOGLE_API_KEY` - Optional, for Gemini-based generation
   - Configure `GOOGLE_CLIENT_ID` if using Google OAuth
   - **NEVER commit `.env` files** - use environment variables

2. **Database**:
   - Use PostgreSQL (configured in Docker)
   - Set up automated database backups
   - Configure connection pooling

3. **Storage**:
   - Consider S3 or similar for file uploads
   - Configure volume persistence for uploads

4. **Security**:
   - Configure CORS for production domain in `.env`
   - Enable HTTPS (reverse proxy with Let's Encrypt)
   - Set secure headers (CSP, HSTS, etc.)
   - Review rate limiting settings

5. **Monitoring**:
   - Set up application logging
   - Configure error tracking (Sentry, etc.)
   - Monitor Docker container health
   - Set up alerts for failures

6. **Performance**:
   - Configure Redis for caching and message brokering
   - Adjust Celery worker count as needed (default: 5 replicas, 4 concurrent tasks each = 20 parallel tasks)
   - Monitor worker memory usage (default limit: 512MB per worker)
   - Enable CDN for static assets
   - Consider increasing worker resources for heavy AI generation workloads

## License

MIT License

## Support

For issues and questions, please open a GitHub issue.

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
- FastAPI (Python)
- SQLAlchemy (ORM)
- SQLite (Database)
- JWT Authentication
- PDF text extraction
- Web scraping for job analysis

**Frontend:**
- Next.js 16 (React 19)
- TypeScript
- Tailwind CSS 4
- Client-side auth management

## Setup Instructions

### Backend Setup

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

- JWT token-based authentication
- Password hashing with bcrypt
- User-isolated data queries
- File upload validation (type, size)
- PDF text extraction
- CORS protection
- Admin credit grants require the `X-Admin-Token` header, are rate limited, and should only be called over HTTPS

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

- Backend runs on port 8000
- Frontend runs on port 3000
- Database file: `backend/easybewerbung.db`
- Uploads stored in: `backend/uploads/{user_id}/`

## Production Deployment

Before deploying to production:

1. Change `SECRET_KEY` in `backend/.env` to a secure random string
2. Use PostgreSQL instead of SQLite
3. Set up proper file storage (S3, etc.)
4. Configure CORS for production domain
5. Enable HTTPS
6. Set up database backups

## License

MIT License

## Support

For issues and questions, please open a GitHub issue.

# Test



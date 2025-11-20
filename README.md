# EasyBewerbung

Job application management platform for multilingual workers. Upload documents, track applications, and generate reports in 33+ languages.

## Features

- **Document Management**: Upload CVs, diplomas, and references with automatic PDF text extraction
- **Job Analysis**: Paste job URLs to automatically extract company and position details
- **Application Tracking**: Keep track of all applications in one place
- **Swiss RAV Reports**: Generate job search reports for Swiss unemployment offices
- **Multilingual**: Support for 33+ languages
- **Secure**: JWT authentication, user-isolated data, file validation

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

4. The backend automatically creates the database on first run. You can customize the `.env` file if needed.

5. Start the backend server:
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

3. The `.env.local` file is already configured for local development.

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Usage

1. **Register**: Create an account at `/register`
2. **Upload Documents**: Go to the dashboard and upload your CV
3. **Add Jobs**: Paste job offer URLs to analyze and track
4. **Track Applications**: View all applications in one place
5. **Export RAV Report**: Download formatted reports for Swiss unemployment offices

## API Endpoints

### Authentication
- `POST /users/register` - Register new user
- `POST /users/login` - Login user
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

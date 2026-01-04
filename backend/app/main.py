from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.limiter import limiter
# from app.csrf import CSRFMiddleware  # Uncomment to enable CSRF protection

from app.api.endpoints import documents, jobs, applications, users, admin, document_templates
from app.database import init_db

app = FastAPI(
    title="EasyBewerbung API",
    version="0.1.0",
    description="Job application automation platform for multilingual workers",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CSRF Protection - Uncomment to enable (requires frontend to send X-CSRF-Token header)
# app.add_middleware(CSRFMiddleware)


# Configure CORS
import os
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Token"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def read_root():
    return {"message": "Welcome to EasyBewerbung API"}


app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(admin.router, tags=["admin"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(
    document_templates.router,
    prefix="/admin/document-templates",
    tags=["admin", "document-templates"]
)

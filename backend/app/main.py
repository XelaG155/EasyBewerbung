from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import documents, jobs, applications, users
from app.database import init_db

app = FastAPI(
    title="EasyBewerbung API",
    version="0.1.0",
    description="Job application automation platform for multilingual workers",
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def read_root():
    return {"message": "Welcome to EasyBewerbung API"}


app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])

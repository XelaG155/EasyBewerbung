from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone
from app.language_catalog import DEFAULT_LANGUAGE

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    full_name = Column(String, nullable=True)
    preferred_language = Column(String, default=DEFAULT_LANGUAGE)
    mother_tongue = Column(String, default=DEFAULT_LANGUAGE)
    documentation_language = Column(String, default=DEFAULT_LANGUAGE)
    credits = Column(Integer, default=0)

    # OAuth fields
    oauth_provider = Column(String, nullable=True)  # "google", "email", etc.
    google_id = Column(String, unique=True, nullable=True, index=True)  # Google user ID
    profile_picture = Column(String, nullable=True)  # Profile picture URL

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="owner")
    job_offers = relationship("JobOffer", back_populates="owner")
    applications = relationship("Application", back_populates="owner")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    file_path = Column(String)
    doc_type = Column(String) # "CV", "REFERENCE", "DIPLOMA"
    content_text = Column(Text, nullable=True) # Extracted text
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="documents")

class JobOffer(Base):
    __tablename__ = "job_offers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    url = Column(String)
    title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="job_offers")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    job_offer_url = Column(String, nullable=True)
    applied = Column(Boolean, default=False)
    applied_at = Column(DateTime, nullable=True)
    result = Column(String, nullable=True)
    ui_language = Column(String, default=DEFAULT_LANGUAGE)
    documentation_language = Column(String, default=DEFAULT_LANGUAGE)
    company_profile_language = Column(String, default=DEFAULT_LANGUAGE)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="applications")
    generated_documents = relationship(
        "GeneratedDocument", back_populates="application", cascade="all, delete-orphan"
    )


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    doc_type = Column(String, nullable=False)
    format = Column(String, nullable=False, default="PDF")
    storage_path = Column(String, nullable=False)
    content = Column(Text, nullable=True)  # Generated document content
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    application = relationship("Application", back_populates="generated_documents")


class MatchingScore(Base):
    __tablename__ = "matching_scores"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True)
    overall_score = Column(Integer, nullable=False)
    strengths = Column(Text, nullable=False)  # JSON array stored as text
    gaps = Column(Text, nullable=False)  # JSON array stored as text
    recommendations = Column(Text, nullable=False)  # JSON array stored as text
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    application = relationship("Application")


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, processing, completed, failed
    progress = Column(Integer, nullable=False, default=0)  # 0-100
    total_docs = Column(Integer, nullable=False, default=0)
    completed_docs = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)  # Error details if failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    application = relationship("Application")
    user = relationship("User")

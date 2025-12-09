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
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    privacy_policy_accepted_at = Column(DateTime, nullable=True)

    # OAuth fields
    oauth_provider = Column(String, nullable=True)  # "google", "email", etc.
    google_id = Column(String, unique=True, nullable=True, index=True)  # Google user ID
    profile_picture = Column(String, nullable=True)  # Profile picture URL

    # Extended profile fields
    employment_status = Column(String, nullable=True)  # "employed", "unemployed", "student", "transitioning"
    education_type = Column(String, nullable=True)  # "wms", "bms", "university", "apprenticeship", "other", None
    additional_profile_context = Column(Text, nullable=True)  # Free text for additional info

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="owner")
    job_offers = relationship("JobOffer", back_populates="owner")
    applications = relationship("Application", back_populates="owner")

    activity_logs = relationship("UserActivityLog", back_populates="user")

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
    location = Column(String, nullable=True)  # Place of work / location
    description = Column(Text, nullable=True)
    original_pdf_path = Column(String, nullable=True)  # Path to original job listing PDF
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="job_offers")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    job_offer_url = Column(String, nullable=True)
    is_spontaneous = Column(Boolean, default=False)
    opportunity_context = Column(Text, nullable=True)
    # Application type: "fulltime", "internship", "apprenticeship" (Praktikum/Lehrstelle)
    application_type = Column(String, default="fulltime", nullable=False)
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
    story = Column(Text, nullable=True)
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


class MatchingScoreTask(Base):
    __tablename__ = "matching_score_tasks"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)  # Error details if failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    application = relationship("Application")
    user = relationship("User")


class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    ip_address = Column(String, nullable=True)
    metadata_ = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="activity_logs")


class LanguageSetting(Base):
    __tablename__ = "language_settings"

    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    label = Column(String, nullable=False)
    direction = Column(String, default="ltr")
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True)
    doc_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String, unique=True, nullable=False)  # e.g. "tailored_cv_pdf"
    display_name = Column(String, nullable=False)  # e.g. "Tailored CV (PDF)"
    credit_cost = Column(Integer, default=1, nullable=False)  # 0-10

    # Language configuration
    language_source = Column(String, default="documentation_language", nullable=False)
    # Options: "preferred_language", "mother_tongue", "documentation_language"

    # LLM configuration
    llm_provider = Column(String, default="openai", nullable=False)
    # Options: "openai", "anthropic", "google"
    llm_model = Column(String, default="gpt-4", nullable=False)
    # e.g. "gpt-4", "gpt-3.5-turbo", "claude-3-sonnet-20240229", "gemini-pro"

    # Prompt template with {language} placeholder
    prompt_template = Column(Text, nullable=False)

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

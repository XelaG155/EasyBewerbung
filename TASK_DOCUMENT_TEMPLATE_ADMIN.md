# Feature: Document Template Admin System for EasyBewerbung

## Ziel
Erstelle ein Admin-System zur Verwaltung von Dokumenten-Templates, mit dem konfiguriert werden kann:
- Credit-Kosten pro Dokument (0-10)
- Sprache für die Generierung (welches User-Sprachfeld verwendet wird)
- LLM-Provider und Modell
- Prompt-Template

## Kontext

### Aktueller Stand
- **Dokumenttypen** sind in `backend/app/document_catalog.py` definiert (ESSENTIAL_PACK, HIGH_IMPACT_ADDONS, PREMIUM_DOCUMENTS)
- **Prompts** sind in `backend/app/document_prompts.json` gespeichert
- **Dokumentengenerierung** erfolgt derzeit mit fest kodierten Werten
- **User-Sprachfelder**: `preferred_language`, `mother_tongue`, `documentation_language` in User-Model

### Repository
- Backend: `/home/alexgiss/EasyBewerbung/backend/`
- Frontend: `/home/alexgiss/EasyBewerbung/frontend/`
- Bestehendes Admin-System: `/frontend/app/admin/page.tsx`

---

## 1. Backend: Database Model

### Neue Tabelle: `document_templates`

Erstelle ein neues SQLAlchemy Model in `backend/app/models.py`:

```python
class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String, unique=True, nullable=False)  # z.B. "tailored_cv_pdf"
    display_name = Column(String, nullable=False)  # z.B. "Tailored CV (PDF)"
    credit_cost = Column(Integer, default=1, nullable=False)  # 0-10

    # Language configuration
    language_source = Column(String, default="documentation_language", nullable=False)
    # Optionen: "preferred_language", "mother_tongue", "documentation_language"

    # LLM configuration
    llm_provider = Column(String, default="openai", nullable=False)
    # Optionen: "openai", "anthropic", "google"
    llm_model = Column(String, default="gpt-4", nullable=False)
    # z.B. "gpt-4", "gpt-3.5-turbo", "claude-3-sonnet-20240229", "gemini-pro"

    # Prompt template with {language} placeholder
    prompt_template = Column(Text, nullable=False)

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

### Migration
Erstelle eine Alembic-Migration:
```bash
cd backend
alembic revision --autogenerate -m "Add document_templates table"
alembic upgrade head
```

### Seed Data
Erstelle ein Script `backend/app/seed_document_templates.py`, das:
1. Alle Dokumenttypen aus `document_catalog.py` liest
2. Alle Prompts aus `document_prompts.json` liest
3. Für jeden Dokumenttyp einen `DocumentTemplate` Eintrag erstellt mit:
   - `credit_cost = 1` (default)
   - `language_source = "documentation_language"`
   - `llm_provider = "openai"`
   - `llm_model = "gpt-4"`
   - `prompt_template` = entsprechender Prompt aus document_prompts.json

---

## 2. Backend: API Endpoints

### Neue Datei: `backend/app/api/endpoints/document_templates.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import DocumentTemplate, User
from app.api.dependencies import get_current_active_user
from pydantic import BaseModel, Field

router = APIRouter()

# Pydantic Schemas
class DocumentTemplateBase(BaseModel):
    doc_type: str
    display_name: str
    credit_cost: int = Field(ge=0, le=10)
    language_source: str = Field(pattern="^(preferred_language|mother_tongue|documentation_language)$")
    llm_provider: str
    llm_model: str
    prompt_template: str
    is_active: bool = True

class DocumentTemplateCreate(DocumentTemplateBase):
    pass

class DocumentTemplateUpdate(BaseModel):
    display_name: str | None = None
    credit_cost: int | None = Field(None, ge=0, le=10)
    language_source: str | None = Field(None, pattern="^(preferred_language|mother_tongue|documentation_language)$")
    llm_provider: str | None = None
    llm_model: str | None = None
    prompt_template: str | None = None
    is_active: bool | None = None

class DocumentTemplateResponse(DocumentTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Endpoints
@router.get("/", response_model=List[DocumentTemplateResponse])
async def list_document_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all document templates (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    templates = db.query(DocumentTemplate).order_by(DocumentTemplate.doc_type).all()
    return templates

@router.get("/{template_id}", response_model=DocumentTemplateResponse)
async def get_document_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific document template (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("/", response_model=DocumentTemplateResponse)
async def create_document_template(
    template: DocumentTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new document template (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check if doc_type already exists
    existing = db.query(DocumentTemplate).filter(DocumentTemplate.doc_type == template.doc_type).first()
    if existing:
        raise HTTPException(status_code=400, detail="Document type already exists")

    db_template = DocumentTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.put("/{template_id}", response_model=DocumentTemplateResponse)
async def update_document_template(
    template_id: int,
    template_update: DocumentTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a document template (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    db_template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Update only provided fields
    for field, value in template_update.dict(exclude_unset=True).items():
        setattr(db_template, field, value)

    db_template.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/{template_id}")
async def delete_document_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a document template (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    db_template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(db_template)
    db.commit()
    return {"message": "Template deleted successfully"}
```

### Router Registration
In `backend/app/api/router.py`:
```python
from app.api.endpoints import document_templates

api_router.include_router(
    document_templates.router,
    prefix="/admin/document-templates",
    tags=["admin", "document-templates"]
)
```

---

## 3. Frontend: API Client

### Update `frontend/lib/api.ts`

Füge hinzu:

```typescript
export interface DocumentTemplate {
  id: number;
  doc_type: string;
  display_name: string;
  credit_cost: number;
  language_source: 'preferred_language' | 'mother_tongue' | 'documentation_language';
  llm_provider: string;
  llm_model: string;
  prompt_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplateUpdate {
  display_name?: string;
  credit_cost?: number;
  language_source?: 'preferred_language' | 'mother_tongue' | 'documentation_language';
  llm_provider?: string;
  llm_model?: string;
  prompt_template?: string;
  is_active?: boolean;
}

// Add to api object:
async getDocumentTemplates(): Promise<DocumentTemplate[]> {
  const response = await fetch(`${this.baseUrl}/admin/document-templates`, {
    headers: this.getHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch document templates");
  return response.json();
},

async updateDocumentTemplate(id: number, data: DocumentTemplateUpdate): Promise<DocumentTemplate> {
  const response = await fetch(`${this.baseUrl}/admin/document-templates/${id}`, {
    method: "PUT",
    headers: this.getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update document template");
  return response.json();
},
```

---

## 4. Frontend: Admin Document Templates Page

### Neue Datei: `frontend/app/admin/documents/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import api, { DocumentTemplate } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function AdminDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DocumentTemplate>>({});
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.is_admin) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    try {
      const data = await api.getDocumentTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template: DocumentTemplate) => {
    setEditingId(template.id);
    setEditForm({
      display_name: template.display_name,
      credit_cost: template.credit_cost,
      language_source: template.language_source,
      llm_provider: template.llm_provider,
      llm_model: template.llm_model,
      prompt_template: template.prompt_template,
      is_active: template.is_active,
    });
  };

  const saveEdit = async (id: number) => {
    try {
      await api.updateDocumentTemplate(id, editForm);
      await loadTemplates();
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error("Failed to update template:", error);
      alert("Failed to update template");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (authLoading || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen page-shell">
      <header className="border-b border-muted">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Document Templates Admin</h1>
            <Button onClick={() => router.push("/admin")} variant="outline">
              ← Back to Admin
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <h2 className="text-xl font-bold mb-4">
            Configure Document Generation Templates
          </h2>
          <p className="text-muted mb-6">
            Manage credit costs, language sources, LLM providers, and prompts for each document type.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left p-3">Document Type</th>
                  <th className="text-left p-3">Credits</th>
                  <th className="text-left p-3">Language Source</th>
                  <th className="text-left p-3">LLM Provider</th>
                  <th className="text-left p-3">Model</th>
                  <th className="text-left p-3">Prompt</th>
                  <th className="text-left p-3">Active</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const isEditing = editingId === template.id;
                  const isExpanded = expandedPrompt === template.id;

                  return (
                    <tr key={template.id} className="border-b border-muted">
                      <td className="p-3">
                        <div className="font-semibold">{template.doc_type}</div>
                        <div className="text-sm text-muted">{template.display_name}</div>
                      </td>

                      {/* Credit Cost */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={editForm.credit_cost}
                            onChange={(e) => setEditForm({...editForm, credit_cost: parseInt(e.target.value)})}
                            className="input-base w-20"
                          />
                        ) : (
                          template.credit_cost
                        )}
                      </td>

                      {/* Language Source */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.language_source}
                            onChange={(e) => setEditForm({...editForm, language_source: e.target.value as any})}
                            className="input-base"
                          >
                            <option value="preferred_language">Preferred Language</option>
                            <option value="mother_tongue">Mother Tongue</option>
                            <option value="documentation_language">Documentation Language</option>
                          </select>
                        ) : (
                          <span className="text-sm">{template.language_source.replace(/_/g, ' ')}</span>
                        )}
                      </td>

                      {/* LLM Provider */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.llm_provider}
                            onChange={(e) => setEditForm({...editForm, llm_provider: e.target.value})}
                            className="input-base"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="google">Google (Gemini)</option>
                          </select>
                        ) : (
                          template.llm_provider
                        )}
                      </td>

                      {/* LLM Model */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.llm_model}
                            onChange={(e) => setEditForm({...editForm, llm_model: e.target.value})}
                            className="input-base"
                            placeholder="e.g. gpt-4"
                          />
                        ) : (
                          <span className="text-sm font-mono">{template.llm_model}</span>
                        )}
                      </td>

                      {/* Prompt */}
                      <td className="p-3">
                        {isEditing ? (
                          <textarea
                            value={editForm.prompt_template}
                            onChange={(e) => setEditForm({...editForm, prompt_template: e.target.value})}
                            className="input-base w-full"
                            rows={5}
                            placeholder="Prompt template with {language} placeholder"
                          />
                        ) : (
                          <div>
                            <button
                              onClick={() => setExpandedPrompt(isExpanded ? null : template.id)}
                              className="text-accent hover:underline text-sm"
                            >
                              {isExpanded ? "Hide" : "Show"} Prompt
                            </button>
                            {isExpanded && (
                              <pre className="mt-2 p-2 bg-slate-800 rounded text-xs overflow-auto max-h-60">
                                {template.prompt_template}
                              </pre>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                            className="w-4 h-4"
                          />
                        ) : (
                          <span className={template.is_active ? "text-success" : "text-error"}>
                            {template.is_active ? "✓" : "✗"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button onClick={() => saveEdit(template.id)} size="sm">
                              Save
                            </Button>
                            <Button onClick={cancelEdit} variant="outline" size="sm">
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => startEdit(template)} variant="outline" size="sm">
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
```

### Update Admin Page Navigation

In `frontend/app/admin/page.tsx`, füge einen Link zur neuen Seite hinzu:

```typescript
<Card>
  <h2 className="text-xl font-bold mb-2">Document Templates</h2>
  <p className="text-muted mb-4">Configure document generation settings, prompts, and LLM providers</p>
  <Button onClick={() => router.push("/admin/documents")}>
    Manage Document Templates
  </Button>
</Card>
```

---

## 5. Integration: Update Document Generation Logic

### Modify Document Generation

In der Datei wo Dokumente generiert werden (wahrscheinlich `backend/app/document_generation.py` oder ähnlich):

```python
async def generate_document(
    user: User,
    application: Application,
    doc_type: str,
    db: Session
) -> GeneratedDocument:
    # Get template configuration
    template = db.query(DocumentTemplate).filter(
        DocumentTemplate.doc_type == doc_type,
        DocumentTemplate.is_active == True
    ).first()

    if not template:
        raise ValueError(f"No active template found for {doc_type}")

    # Determine language based on template configuration
    language_field = template.language_source
    if language_field == "preferred_language":
        language = user.preferred_language
    elif language_field == "mother_tongue":
        language = user.mother_tongue
    elif language_field == "documentation_language":
        language = user.documentation_language
    else:
        language = user.documentation_language  # fallback

    # Build prompt with language
    prompt = template.prompt_template.format(language=language)

    # Select LLM based on template
    if template.llm_provider == "openai":
        llm = get_openai_client(template.llm_model)
    elif template.llm_provider == "anthropic":
        llm = get_anthropic_client(template.llm_model)
    elif template.llm_provider == "google":
        llm = get_google_client(template.llm_model)
    else:
        raise ValueError(f"Unknown LLM provider: {template.llm_provider}")

    # Generate document...
    result = await llm.generate(prompt, ...)

    # Deduct credits based on template cost
    user.credits -= template.credit_cost
    db.commit()

    return result
```

---

## 6. Testing & Validation

### Akzeptanzkriterien:
1. ✅ Admin kann alle Document Templates sehen
2. ✅ Admin kann Credit-Kosten von 0-10 einstellen
3. ✅ Admin kann Sprachquelle wählen (preferred/mother/documentation)
4. ✅ Admin kann LLM Provider und Modell wählen
5. ✅ Admin kann Prompt-Template bearbeiten
6. ✅ Admin kann Templates aktivieren/deaktivieren
7. ✅ Dokumentengenerierung verwendet Template-Konfiguration
8. ✅ Sprache wird dynamisch pro User ermittelt und an LLM übergeben
9. ✅ Korrekte Credit-Kosten werden berechnet

### Edge Cases:
- Template existiert nicht → Fehler mit klarer Message
- Template ist inaktiv → Dokument kann nicht generiert werden
- User hat nicht genug Credits → Fehler vor Generation
- Ungültige Sprachquelle → Fallback zu documentation_language
- LLM Provider nicht verfügbar → Fehler mit Retry-Option

---

## 7. Deployment

1. Database Migration ausführen
2. Seed Script ausführen um initiale Templates zu erstellen
3. Frontend bauen und deployen
4. Backend neu starten
5. Testen mit Admin-User

---

## Zusätzliche Hinweise

- **Prompt Format**: Der Prompt-Template muss einen `{language}` Placeholder enthalten, der zur Laufzeit ersetzt wird
- **Validierung**: Credit-Kosten müssen 0-10 sein, Language-Source muss valide sein
- **Permissions**: Nur Admins dürfen Templates verwalten
- **Backwards Compatibility**: Wenn kein Template existiert, sollte das System mit den alten Defaults arbeiten
- **UI/UX**: Die Admin-Seite sollte responsive sein und gut auf mobile Geräten funktionieren

---

Viel Erfolg bei der Implementierung! 🚀

"use client";

import { useState } from "react";

type PlaceholderSource = "user" | "job" | "document_config" | "template_admin" | "system";
type Editable = "no" | "json" | "admin_ui" | "both";

interface PlaceholderInfo {
  name: string;
  description: string;
  source: PlaceholderSource;
  sourceDescription: string;
  editable: Editable;
  editLocation: string;
  example: string;
  color: string;
}

const sourceLabels: Record<PlaceholderSource, { label: string; color: string }> = {
  user: { label: "Benutzerprofil", color: "bg-blue-500" },
  job: { label: "Job-Angebot / Bewerbung", color: "bg-green-500" },
  document_config: { label: "Dokument-Konfiguration", color: "bg-purple-500" },
  template_admin: { label: "Admin Template", color: "bg-orange-500" },
  system: { label: "System (automatisch)", color: "bg-gray-500" }
};

const editableLabels: Record<Editable, { label: string; icon: string }> = {
  no: { label: "Nicht editierbar (automatisch)", icon: "🔒" },
  json: { label: "In document_prompts.json", icon: "📄" },
  admin_ui: { label: "Im Admin UI (Template bearbeiten)", icon: "✏️" },
  both: { label: "JSON + Admin UI", icon: "✏️📄" }
};

const placeholders: PlaceholderInfo[] = [
  // === DOCUMENT-SPECIFIC (per document type) ===
  {
    name: "{role}",
    description: "KI-Rolle/Persona - Definiert, als wer die KI agieren soll",
    source: "document_config",
    sourceDescription: "Wird pro Dokumenttyp in document_prompts.json definiert",
    editable: "json",
    editLocation: "backend/app/document_prompts.json → [doc_type].role",
    example: `// Für tailored_cv_pdf:
"role": "ATS-optimized professional CV writer and career strategist"

// Für cover_letter:
"role": "professional cover letter writer and career consultant"

// Für company_intelligence_briefing:
"role": "business intelligence analyst and company researcher"`,
    color: "purple"
  },
  {
    name: "{task}",
    description: "Hauptaufgabe - Was die KI konkret tun soll (variiert pro Dokumenttyp!)",
    source: "document_config",
    sourceDescription: "Wird pro Dokumenttyp in document_prompts.json definiert",
    editable: "json",
    editLocation: "backend/app/document_prompts.json → [doc_type].task",
    example: `// Für tailored_cv_pdf:
"task": "Create an ATS-friendly tailored CV that maximizes the candidate's chances of passing Applicant Tracking System filters while maintaining complete honesty"

// Für cover_letter:
"task": "Write a compelling, personalized cover letter that highlights the candidate's relevant experience and genuine motivation"

// Für motivation_letter:
"task": "Create an authentic motivation letter that explains why this candidate is genuinely interested in this specific role and company"`,
    color: "purple"
  },
  {
    name: "{instructions}",
    description: "Detaillierte Anweisungen - Nummerierte Liste aller Regeln für diesen Dokumenttyp",
    source: "document_config",
    sourceDescription: "Wird pro Dokumenttyp in document_prompts.json definiert (Array von Strings)",
    editable: "json",
    editLocation: "backend/app/document_prompts.json → [doc_type].instructions[]",
    example: `// In document_prompts.json:
"instructions": [
  "Output ONLY the tailored CV content - NO conversational text",
  "Start directly with the CV content",
  "=== ABSOLUTE HONESTY REQUIREMENTS (CRITICAL) ===",
  "ONLY use skills that can be verified in uploaded documents",
  "NEVER invent or fabricate skills",
  ...
]

// Wird zu:
1. Output ONLY the tailored CV content - NO conversational text
2. Start directly with the CV content
3. === ABSOLUTE HONESTY REQUIREMENTS (CRITICAL) ===
4. ONLY use skills that can be verified in uploaded documents
5. NEVER invent or fabricate skills
...`,
    color: "purple"
  },
  {
    name: "{doc_type}",
    description: "Technischer Dokumenttyp-Schlüssel",
    source: "system",
    sourceDescription: "Wird automatisch vom System gesetzt basierend auf dem generierten Dokument",
    editable: "no",
    editLocation: "Automatisch - nicht editierbar",
    example: `cover_letter
tailored_cv_pdf
motivation_letter
company_intelligence_briefing
interview_preparation
linkedin_message`,
    color: "red"
  },
  {
    name: "{doc_type_display}",
    description: "Benutzerfreundlicher Anzeigename des Dokuments (MEHRSPRACHIG!)",
    source: "system",
    sourceDescription: "Automatisch lokalisiert basierend auf Dokumentsprache (documentation_language)",
    editable: "no",
    editLocation: "backend/app/tasks.py → DOC_TYPE_TRANSLATIONS (bei neuen Dokumenttypen)",
    example: `Wird automatisch in der Zielsprache ausgegeben:

Deutsch (de/de-CH): "Bewerbungsschreiben", "Lebenslauf", "Motivationsschreiben"
Englisch (en): "Cover Letter", "CV / Resume", "Motivation Letter"
Französisch (fr): "Lettre de motivation", "CV", "Lettre de motivation"
Italienisch (it): "Lettera di presentazione", "Curriculum Vitae"
Spanisch (es): "Carta de presentación", "Currículum Vitae"
Portugiesisch (pt): "Carta de apresentação", "Currículo"

Unterstützte Dokumenttypen:
- COVER_LETTER, CV, MOTIVATION_LETTER
- FOLLOW_UP, THANK_YOU, REFERENCE_REQUEST

Falls der Dokumenttyp keine Übersetzung hat, wird template.display_name verwendet.`,
    color: "gray"
  },

  // === USER DATA (from user profile) ===
  {
    name: "{cv_text}",
    description: "Vollständiger CV-Text des Kandidaten",
    source: "user",
    sourceDescription: "Aus dem hochgeladenen CV-Dokument des Benutzers (automatisch extrahiert)",
    editable: "no",
    editLocation: "Benutzer lädt CV hoch → Text wird automatisch extrahiert",
    example: `JOHN DOE
Senior Software Engineer
john.doe@email.com | +41 79 123 45 67

PROFESSIONAL SUMMARY
Experienced software engineer with 6+ years...

WORK EXPERIENCE
Senior Software Engineer | TechStartup AG | 2021 - Present
- Led a team of 4 developers
- Reduced API response time by 40%
...

EDUCATION
M.Sc. Computer Science | ETH Zürich

SKILLS
Python, JavaScript, Django, FastAPI, React...`,
    color: "blue"
  },
  {
    name: "{cv_summary}",
    description: "CV-Kurzfassung (erste 2000 Zeichen)",
    source: "user",
    sourceDescription: "Automatisch aus {cv_text} - die ersten 2000 Zeichen",
    editable: "no",
    editLocation: "Automatisch generiert aus CV-Text",
    example: `[Erste 2000 Zeichen des CV-Texts]

Wird abgeschnitten mit "..." wenn länger als 2000 Zeichen`,
    color: "blue"
  },
  {
    name: "{reference_letters}",
    description: "Inhalt aller hochgeladenen Referenzschreiben",
    source: "user",
    sourceDescription: "Aus allen Dokumenten mit doc_type='REFERENCE' des Benutzers",
    editable: "no",
    editLocation: "Benutzer lädt Referenzschreiben hoch → werden automatisch zusammengefügt",
    example: `--- Reference Letter 1 ---
To Whom It May Concern,

I am pleased to recommend John Doe, who worked under my supervision...
[Vollständiger Text des ersten Referenzschreibens]

--- Reference Letter 2 ---
Reference for John Doe

John has been an outstanding Senior Software Engineer...
[Vollständiger Text des zweiten Referenzschreibens]`,
    color: "blue"
  },

  // === JOB/APPLICATION DATA ===
  {
    name: "{job_description}",
    description: "Stellenbeschreibung + Bewerbungskontext",
    source: "job",
    sourceDescription: "Aus der Job-Bewerbung: Job-Details + Kontext (Bewerbungstyp, Status, etc.)",
    editable: "no",
    editLocation: "Wird aus Application-Daten zusammengestellt",
    example: `=== JOB DETAILS ===
Position: Senior Software Engineer
Company: TechCorp AG
Location: Zürich, Switzerland

=== JOB DESCRIPTION ===
We are looking for an experienced software engineer with 5+ years
of experience in Python and web development. The ideal candidate
should have:
- Strong problem-solving skills
- Experience with modern frameworks (Django, FastAPI, React)
- Team leadership experience
- Fluent in German and English

Requirements:
- Bachelor's degree in Computer Science or equivalent
- 5+ years of professional experience
- Experience with agile methodologies

=== APPLICATION CONTEXT ===
Application Type: Full-time position
Candidate Status: Currently employed
Education Type: Master's degree`,
    color: "green"
  },

  // === LANGUAGE SETTINGS ===
  {
    name: "{language}",
    description: "Zielsprache für das Dokument",
    source: "user",
    sourceDescription: "Basiert auf Template.language_source → holt Sprache aus Benutzerprofil",
    editable: "admin_ui",
    editLocation: "Admin UI → Documents → Template → 'Sprachquelle' Dropdown",
    example: `// Je nach language_source Einstellung:

// Wenn language_source = "documentation_language":
"German - Write all content in German language"

// Wenn language_source = "preferred_language":
"English"

// Wenn language_source = "mother_tongue":
"Swiss German (Schweizerdeutsch) - CRITICAL: Use 'ss' instead of 'ß'"

// Die Sprachquelle bestimmt, WELCHES Sprachfeld des Users verwendet wird!`,
    color: "orange"
  },
  {
    name: "{documentation_language}",
    description: "Dokumentationssprache aus Benutzerprofil",
    source: "user",
    sourceDescription: "Direkt aus User.documentation_language",
    editable: "no",
    editLocation: "Benutzer → Einstellungen → Dokumentationssprache",
    example: `German (Standard German / Hochdeutsch) - Use standard German orthography including 'ß' where appropriate.

// Oder für Schweizerdeutsch:
Swiss German (Schweizerdeutsch) - CRITICAL: Use 'ss' instead of 'ß'`,
    color: "orange"
  },
  {
    name: "{company_profile_language}",
    description: "Sprache für Firmenprofil-Dokumente",
    source: "job",
    sourceDescription: "Aus Application.company_profile_language (pro Bewerbung einstellbar)",
    editable: "no",
    editLocation: "Benutzer wählt bei Bewerbungserstellung die Firmenprofilsprache",
    example: `English

// Wird hauptsächlich für company_intelligence_briefing verwendet,
// damit das Firmenprofil in der gewünschten Sprache erstellt wird`,
    color: "orange"
  }
];

export default function PlaceholderExplorer() {
  const [expandedPlaceholder, setExpandedPlaceholder] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<PlaceholderSource | "all">("all");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredPlaceholders = filterSource === "all"
    ? placeholders
    : placeholders.filter(p => p.source === filterSource);

  const groupedPlaceholders = {
    document_config: filteredPlaceholders.filter(p => p.source === "document_config"),
    user: filteredPlaceholders.filter(p => p.source === "user"),
    job: filteredPlaceholders.filter(p => p.source === "job"),
    template_admin: filteredPlaceholders.filter(p => p.source === "template_admin" || p.source === "system"),
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span>🔍</span> Platzhalter-Explorer
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Verstehe, woher jeder Platzhalter seine Daten bekommt und wie du sie anpassen kannst.
        </p>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setFilterSource("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterSource === "all"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Alle
          </button>
          {Object.entries(sourceLabels).map(([key, { label, color }]) => (
            <button
              key={key}
              onClick={() => setFilterSource(key as PlaceholderSource)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterSource === key
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${color}`}></span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Datenquellen:</p>
            <div className="space-y-1">
              {Object.entries(sourceLabels).map(([key, { label, color }]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${color}`}></span>
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Editierbarkeit:</p>
            <div className="space-y-1">
              {Object.entries(editableLabels).map(([key, { label, icon }]) => (
                <div key={key} className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Placeholders */}
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {/* Document Config Group */}
        {groupedPlaceholders.document_config.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
              <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                Pro Dokumenttyp konfigurierbar (document_prompts.json)
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Diese Werte sind für jeden Dokumenttyp unterschiedlich und werden in der JSON-Konfiguration definiert.
              </p>
            </div>
            {groupedPlaceholders.document_config.map((placeholder) => (
              <PlaceholderItem
                key={placeholder.name}
                placeholder={placeholder}
                expanded={expandedPlaceholder === placeholder.name}
                onToggle={() => setExpandedPlaceholder(expandedPlaceholder === placeholder.name ? null : placeholder.name)}
                onCopy={copyToClipboard}
                copied={copiedText}
              />
            ))}
          </div>
        )}

        {/* User Data Group */}
        {groupedPlaceholders.user.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Aus Benutzerprofil (automatisch)
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Diese Werte kommen automatisch aus den Daten des Benutzers (CV, Referenzen, Spracheinstellungen).
              </p>
            </div>
            {groupedPlaceholders.user.map((placeholder) => (
              <PlaceholderItem
                key={placeholder.name}
                placeholder={placeholder}
                expanded={expandedPlaceholder === placeholder.name}
                onToggle={() => setExpandedPlaceholder(expandedPlaceholder === placeholder.name ? null : placeholder.name)}
                onCopy={copyToClipboard}
                copied={copiedText}
              />
            ))}
          </div>
        )}

        {/* Job Data Group */}
        {groupedPlaceholders.job.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Aus Job-Angebot / Bewerbung (automatisch)
              </h4>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Diese Werte kommen aus der spezifischen Bewerbung (Stellenbeschreibung, Firmensprache).
              </p>
            </div>
            {groupedPlaceholders.job.map((placeholder) => (
              <PlaceholderItem
                key={placeholder.name}
                placeholder={placeholder}
                expanded={expandedPlaceholder === placeholder.name}
                onToggle={() => setExpandedPlaceholder(expandedPlaceholder === placeholder.name ? null : placeholder.name)}
                onCopy={copyToClipboard}
                copied={copiedText}
              />
            ))}
          </div>
        )}

        {/* System/Template Group */}
        {groupedPlaceholders.template_admin.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
              <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                System / Admin Template
              </h4>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                Automatisch generiert oder im Admin UI konfigurierbar.
              </p>
            </div>
            {groupedPlaceholders.template_admin.map((placeholder) => (
              <PlaceholderItem
                key={placeholder.name}
                placeholder={placeholder}
                expanded={expandedPlaceholder === placeholder.name}
                onToggle={() => setExpandedPlaceholder(expandedPlaceholder === placeholder.name ? null : placeholder.name)}
                onCopy={copyToClipboard}
                copied={copiedText}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
        <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          📝 Wie passe ich Platzhalter an?
        </h4>
        <div className="text-xs text-yellow-800 dark:text-yellow-200 space-y-2">
          <p>
            <strong>Für {"{role}"}, {"{task}"}, {"{instructions}"}:</strong><br/>
            Bearbeite <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">backend/app/document_prompts.json</code><br/>
            Jeder Dokumenttyp hat seine eigene Konfiguration.
          </p>
          <p>
            <strong>Für {"{language}"} (Sprachquelle):</strong><br/>
            Admin UI → Documents → Template bearbeiten → &quot;Sprachquelle&quot; Dropdown<br/>
            Wähle zwischen: preferred_language, mother_tongue, documentation_language
          </p>
          <p>
            <strong>Für {"{doc_type_display}"}:</strong><br/>
            Automatisch mehrsprachig! Wird basierend auf <code>documentation_language</code> des Benutzers/Bewerbung übersetzt.
            Neue Dokumenttypen können in <code>backend/app/tasks.py → DOC_TYPE_TRANSLATIONS</code> hinzugefügt werden.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlaceholderItem({
  placeholder,
  expanded,
  onToggle,
  onCopy,
  copied
}: {
  placeholder: PlaceholderInfo;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  copied: string | null;
}) {
  const editable = editableLabels[placeholder.editable];
  const source = sourceLabels[placeholder.source];

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <code className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-0.5 rounded font-mono text-sm font-bold">
                {placeholder.name}
              </code>
              <span className={`px-2 py-0.5 rounded-full text-xs ${source.color} text-white`}>
                {source.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {editable.icon} {editable.label}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(placeholder.name);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs ml-1"
                title="Platzhalter kopieren"
              >
                {copied === placeholder.name ? "✓" : "📋"}
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {placeholder.description}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
              {placeholder.sourceDescription}
            </p>
          </div>
          <span className="text-gray-400 text-lg flex-shrink-0">
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mx-4 mb-4 space-y-3">
          {/* Edit Location */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
              📍 Wo kann ich das ändern?
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 font-mono">
              {placeholder.editLocation}
            </p>
          </div>

          {/* Example */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Beispiel-Inhalt:
              </span>
              <button
                onClick={() => onCopy(placeholder.example)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
              >
                {copied === placeholder.example ? "✓ Kopiert" : "📋 Kopieren"}
              </button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 max-h-80 overflow-auto">
              {placeholder.example}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

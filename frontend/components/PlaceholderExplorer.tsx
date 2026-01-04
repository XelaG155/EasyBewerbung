"use client";

import { useState } from "react";

interface PlaceholderInfo {
  name: string;
  description: string;
  example: string;
  color: string;
}

const placeholders: PlaceholderInfo[] = [
  {
    name: "{role}",
    description: "KI-Rolle/Persona - Definiert, als wer die KI agieren soll",
    example: `professional career consultant and CV/resume expert`,
    color: "blue"
  },
  {
    name: "{task}",
    description: "Hauptaufgabe - Was die KI tun soll (variiert je nach Dokumenttyp)",
    example: `Create an ATS-friendly tailored CV that maximizes the candidate's chances of passing Applicant Tracking System filters while maintaining complete honesty`,
    color: "blue"
  },
  {
    name: "{doc_type}",
    description: "Technischer Dokumenttyp - Interner Schlüssel des Dokuments",
    example: `cover_letter`,
    color: "red"
  },
  {
    name: "{doc_type_display}",
    description: "Anzeigename - Benutzerfreundlicher Name des Dokuments",
    example: `Anschreiben / Cover Letter`,
    color: "red"
  },
  {
    name: "{job_description}",
    description: "Stellenbeschreibung + Bewerbungskontext - Enthält Job-Details und Bewerbungstyp",
    example: `=== JOB DETAILS ===
Position: Senior Software Engineer
Company: TechCorp AG
Location: Zürich, Switzerland

=== JOB DESCRIPTION ===
We are looking for an experienced software engineer with 5+ years of experience in Python and web development. The ideal candidate should have:
- Strong problem-solving skills
- Experience with modern frameworks (Django, FastAPI, React)
- Team leadership experience
- Fluent in German and English

=== APPLICATION CONTEXT ===
Application Type: Full-time position
Candidate Status: Currently employed, looking for new challenges
Education Type: Master's degree in Computer Science`,
    color: "green"
  },
  {
    name: "{cv_text}",
    description: "Vollständiger CV-Text - Gesamter Inhalt des hochgeladenen Lebenslaufs",
    example: `JOHN DOE
Senior Software Engineer
john.doe@email.com | +41 79 123 45 67 | Zürich, Switzerland

PROFESSIONAL SUMMARY
Experienced software engineer with 6+ years of expertise in Python development, specializing in Django and FastAPI frameworks. Proven track record of leading development teams and delivering high-quality solutions.

WORK EXPERIENCE

Senior Software Engineer | TechStartup AG | 2021 - Present
- Led a team of 4 developers in building microservices architecture
- Reduced API response time by 40% through optimization
- Implemented CI/CD pipelines using GitLab CI
- Mentored junior developers

Software Engineer | WebAgency GmbH | 2018 - 2021
- Developed RESTful APIs using Django REST Framework
- Built responsive web applications with React
- Managed PostgreSQL databases with complex queries
- Collaborated with cross-functional teams

EDUCATION
M.Sc. Computer Science | ETH Zürich | 2016 - 2018
B.Sc. Informatik | Universität Zürich | 2013 - 2016

SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks: Django, FastAPI, React, Next.js
Tools: Docker, Kubernetes, Git, PostgreSQL, Redis
Languages: German (native), English (fluent), French (basic)

CERTIFICATIONS
- AWS Certified Solutions Architect
- Google Cloud Professional Developer`,
    color: "green"
  },
  {
    name: "{cv_summary}",
    description: "CV-Kurzfassung (2000 Zeichen) - Kompakte Übersicht der Qualifikationen",
    example: `JOHN DOE
Senior Software Engineer
john.doe@email.com | +41 79 123 45 67 | Zürich, Switzerland

PROFESSIONAL SUMMARY
Experienced software engineer with 6+ years of expertise in Python development, specializing in Django and FastAPI frameworks. Proven track record of leading development teams and delivering high-quality solutions.

WORK EXPERIENCE

Senior Software Engineer | TechStartup AG | 2021 - Present
- Led a team of 4 developers in building microservices architecture
- Reduced API response time by 40% through optimization
- Implemented CI/CD pipelines using GitLab CI

Software Engineer | WebAgency GmbH | 2018 - 2021
- Developed RESTful APIs using Django REST Framework
- Built responsive web applications with React

EDUCATION
M.Sc. Computer Science | ETH Zürich | 2016 - 2018
B.Sc. Informatik | Universität Zürich | 2013 - 2016

SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks: Django, FastAPI, React, Next.js...`,
    color: "green"
  },
  {
    name: "{language}",
    description: "Zielsprache - Sprache, in der das Dokument erstellt werden soll",
    example: `Swiss German (Schweizerdeutsch) - CRITICAL: Use 'ss' instead of 'ß' (e.g., 'Strasse' not 'Straße', 'Grüsse' not 'Grüße', 'dass' not 'daß'). This is Swiss Standard German orthography.`,
    color: "purple"
  },
  {
    name: "{documentation_language}",
    description: "Dokumentationssprache - Gleich wie {language}, basierend auf User-Einstellung",
    example: `German (Standard German / Hochdeutsch) - Use standard German orthography including 'ß' where appropriate.`,
    color: "purple"
  },
  {
    name: "{company_profile_language}",
    description: "Firmenprofilsprache - Für Company Intelligence Dokumente",
    example: `English`,
    color: "purple"
  },
  {
    name: "{instructions}",
    description: "Formatierte Anweisungsliste - Nummerierte Regeln aus der Prompt-Konfiguration",
    example: `1. Output ONLY the tailored CV content - NO conversational text, NO introductions like 'Here is...' or 'Gerne...'
2. Start directly with the CV content (e.g., candidate name or professional profile)
3. === ABSOLUTE HONESTY REQUIREMENTS (CRITICAL) ===
4. The CV text provided is a compilation of the candidate's verifiable documents (references, diplomas, certificates) and actual work history
5. ONLY use skills, experiences, and qualifications that can be verified in these uploaded documents
6. NEVER invent, fabricate, or add skills not documented in the candidate's references, certificates, or diplomas
7. NEVER create fictional experiences, qualifications, or achievements beyond what is verifiable
8. NEVER claim competencies the candidate does not possess - background checks will verify against original documents
9. ONLY reorder, emphasize, and rephrase information from the candidate's verifiable documents and work history
10. If a required skill is missing from the candidate's actual documents, DO NOT add it - leave it absent
11. === ATS OPTIMIZATION STRATEGY ===
12. Extract must-have skills and keywords from the job description
13. Use EXACT phrasing from job description for skills`,
    color: "orange"
  },
  {
    name: "{reference_letters}",
    description: "Referenzschreiben - Inhalt aller hochgeladenen Referenzen",
    example: `--- Reference Letter 1 ---
To Whom It May Concern,

I am pleased to recommend John Doe, who worked under my supervision as a Software Engineer at WebAgency GmbH from 2018 to 2021.

During his time with us, John consistently demonstrated exceptional technical skills and a strong work ethic. He was instrumental in developing our main product's API infrastructure and showed great initiative in improving our development processes.

John is a team player who communicates effectively and is always willing to help colleagues. His problem-solving abilities and attention to detail made him a valuable asset to our team.

I highly recommend John for any senior engineering position.

Best regards,
Dr. Maria Schmidt
CTO, WebAgency GmbH

--- Reference Letter 2 ---
Reference for John Doe

John has been an outstanding Senior Software Engineer at TechStartup AG since 2021. He leads our backend team with professionalism and has successfully delivered multiple critical projects.

His technical expertise in Python and modern web frameworks is excellent, and he has a talent for mentoring junior developers.

I recommend him without reservation.

Thomas Müller
Engineering Director, TechStartup AG`,
    color: "orange"
  }
];

export default function PlaceholderExplorer() {
  const [expandedPlaceholder, setExpandedPlaceholder] = useState<string | null>(null);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(null);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-200",
        border: "border-blue-200 dark:border-blue-800"
      },
      green: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-200",
        border: "border-green-200 dark:border-green-800"
      },
      purple: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-800 dark:text-purple-200",
        border: "border-purple-200 dark:border-purple-800"
      },
      orange: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-800 dark:text-orange-200",
        border: "border-orange-200 dark:border-orange-800"
      },
      red: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-200",
        border: "border-red-200 dark:border-red-800"
      }
    };
    return colors[color] || colors.blue;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPlaceholder(text);
    setTimeout(() => setCopiedPlaceholder(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span>🔍</span> Platzhalter-Explorer
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Klicke auf einen Platzhalter, um zu sehen, wie die echten Daten aussehen werden.
        </p>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {placeholders.map((placeholder) => {
          const colors = getColorClasses(placeholder.color);
          const isExpanded = expandedPlaceholder === placeholder.name;

          return (
            <div key={placeholder.name} className="group">
              <button
                onClick={() => setExpandedPlaceholder(isExpanded ? null : placeholder.name)}
                className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className={`px-2 py-0.5 rounded font-mono text-sm ${colors.bg} ${colors.text}`}>
                        {placeholder.name}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(placeholder.name);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                        title="Kopieren"
                      >
                        {copiedPlaceholder === placeholder.name ? "✓" : "📋"}
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {placeholder.description}
                    </p>
                  </div>
                  <span className="text-gray-400 text-lg">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className={`mx-4 mb-4 p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Beispiel-Inhalt:
                    </span>
                    <button
                      onClick={() => copyToClipboard(placeholder.example)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      {copiedPlaceholder === placeholder.example ? "✓ Kopiert" : "📋 Beispiel kopieren"}
                    </button>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700 max-h-96 overflow-auto">
                    {placeholder.example}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Tipp:</strong> Du kannst diese Platzhalter in deinen Prompt-Templates verwenden.
          Sie werden bei der Dokumentgenerierung automatisch mit den echten Daten des Benutzers ersetzt.
        </p>
      </div>
    </div>
  );
}

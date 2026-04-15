# Socrateez — Infrastructure & Architecture

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | SPA with component-based UI |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS framework |
| **Charts** | Recharts 2 | Data visualization (bar, pie, line) |
| **Icons** | Lucide React | Consistent icon library |
| **Build** | Vite 5 | Dev server + production bundler |
| **Backend** | Node.js + Express 4 | REST API server |
| **Database** | MongoDB (Mongoose 8) | Document store for job data |
| **AI** | Google Gemini (`@google/generative-ai`) | Natural-language assistant |
| **NLP** | compromise | Text compression for assistant |

---

## Project Layout

```
Socrateez/
├── Server/                        # Backend (Express + MongoDB)
│   ├── index.js                   # Entry — Express app, Mongo connection
│   ├── routes/
│   │   ├── index.js               # /api router hub
│   │   ├── dashboard.js           # GET  /api/dashboard
│   │   ├── jobs.js                # GET  /api/jobs/search, /facets, /facets/search
│   │   ├── cleanedJobs.js         # POST /api/cleaned-jobs/sync, /reset-and-sync
│   │   ├── rawJobs.js             # CRUD on raw imports
│   │   ├── employers.js           # Employer roll-ups
│   │   ├── etlAudit.js            # GET  /api/etl-audit/runs, /runs/:id
│   │   └── assistant.js           # POST /api/assistant/chat (Gemini)
│   ├── services/
│   │   ├── rawToCleanedService.js # Full ETL pipeline orchestrator
│   │   ├── jobSearchService.js    # Search & facet aggregation logic
│   │   └── dashboardService.js    # Dashboard aggregation queries
│   ├── lib/                       # ETL rule modules
│   │   ├── salaryNormalization.js
│   │   ├── jobTypeClassification.js
│   │   ├── roleDetection.js
│   │   ├── jobTitleNormalization.js
│   │   ├── dateNormalization.js
│   │   ├── locationNormalization.js
│   │   ├── companyNormalization.js
│   │   ├── skillsExtraction.js
│   │   ├── duplicateDetection.js
│   │   ├── etlRuleTracker.js      # Audit log accumulator
│   │   ├── schemaContext.js        # Schema text for Gemini
│   │   └── nlpCompressor.js       # NLP text compression
│   ├── models/
│   │   ├── RawJobData.js          # raw_job_data collection
│   │   ├── CleanedJobData.js      # cleaned_job_data collection
│   │   ├── EmployerData.js        # employer_data collection
│   │   ├── EtlAuditLog.js        # etl_audit_logs collection
│   │   └── jobDataFields.js       # Shared field-name constants
│   └── docs/
│       ├── new-etl-rules.md       # ETL rule specification
│       └── infrastructure.md      # This file
│
└── SocrateezAI/                   # Frontend (React + Vite)
    └── src/
        ├── App.tsx                # Root — page routing via useState
        ├── pages/
        │   ├── DashboardPage.tsx  # Summary stats, charts, top jobs
        │   ├── JobSearchPage.tsx  # Search with filters, analytics
        │   ├── AIAssistantPage.tsx# Chat with Gemini assistant
        │   └── EtlAuditPage.tsx   # ETL processing history viewer
        ├── components/
        │   ├── layout/Navbar.tsx  # Top navigation bar
        │   ├── jobs/              # Job search sub-components
        │   │   ├── SearchBar.tsx      (debounced keyword + location)
        │   │   ├── FiltersPanel.tsx   (searchable facets, job type, remote)
        │   │   ├── JobResultsTable.tsx(paginated table with badges)
        │   │   ├── SearchAnalytics.tsx(salary charts per city/state)
        │   │   ├── CompanyInsights.tsx(company drill-down card)
        │   │   └── CandidatesList.tsx (placeholder)
        │   └── (UI primitives: Card, Badge, Button, Input, Table, etc.)
        └── lib/
            ├── api.ts             # All fetch() calls to backend
            ├── utils.ts           # formatSalary, formatNumber, cn()
            └── mockData.ts        # Candidate type stubs
```

---

## Data Flow — End to End

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA PIPELINE                               │
│                                                                     │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────────┐       │
│  │  CSV /    │     │  raw_job_data │     │ cleaned_job_data │       │
│  │  Import   │────▶│  (2M docs)    │────▶│  (~1.2M docs)    │      │
│  │  Source   │     │  MongoDB      │ ETL │  MongoDB         │      │
│  └──────────┘     └───────────────┘     └──────────────────┘       │
│                          │                       │                  │
│                          │              ┌────────┴────────┐         │
│                          │              │ etl_audit_logs   │         │
│                          │              │ (audit trail)    │         │
│                          │              └─────────────────┘         │
│                          │                       │                  │
│                          │              ┌────────┴────────┐         │
│                          │              │ employer_data    │         │
│                          │              │ (rollups)        │         │
│                          │              └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
          │                                        │
          ▼                                        ▼
┌─────────────────┐                    ┌─────────────────────────┐
│  Express API    │                    │  React Frontend         │
│  localhost:3000 │◀───── REST ───────▶│  localhost:5173 (Vite)  │
│                 │                    │                         │
│  /api/dashboard │ ◀── GET ──────────│  DashboardPage          │
│  /api/jobs/*    │ ◀── GET ──────────│  JobSearchPage          │
│  /api/assistant │ ◀── POST ─────────│  AIAssistantPage        │
│  /api/etl-audit │ ◀── GET ──────────│  EtlAuditPage           │
│  /api/cleaned-  │                    │                         │
│   jobs/sync     │ ◀── POST ─────────│  (admin trigger)        │
└─────────────────┘                    └─────────────────────────┘
```

---

## ETL Pipeline — Detailed Flow

The ETL runs when `POST /api/cleaned-jobs/sync` or `/reset-and-sync` is called.
`reset-and-sync` drops all cleaned data first (use after rule changes).

```
raw_job_data (all documents)
        │
        ▼
┌───────────────────────────────────────────┐
│  PHASE 1 — Eligibility Filter             │
│  Records in: total raw docs               │
│                                           │
│  ELG-01  Both salary + job title present  │
│  ELG-02  Salary missing → skip            │
│  ELG-03  Job title missing → skip         │
│  ELG-04  Both missing → skip              │
│  ELG-05  Listing title missing → tracked  │
│                                           │
│  Records out: eligible docs               │
└───────────────────┬───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│  PHASE 2 — Salary Normalization           │
│  Records in: eligible from Phase 1        │
│                                           │
│  SAL-01  Hourly → annual conversion       │
│  SAL-02  Annual explicit keyword           │
│  SAL-03  Plain annual / K-suffix          │
│  SAL-04  Hourly heuristic                 │
│  SAL-05  Deflate inflated values          │
│  SAL-06  Unparseable → REJECT             │
│  SAL-07  Below $20K → REJECT              │
│  SAL-08  Above $500K → REJECT             │
│  SAL-09  Trainee salary cap → REJECT      │
│                                           │
│  Records out: salary-valid docs           │
└───────────────────┬───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│  PHASE 3 — Job Type Classification        │
│  Records in: salary-valid from Phase 2    │
│  Checks BOTH filter title & listing title │
│                                           │
│  JTP-01  Internship keyword               │
│  JTP-02  Contract keyword                 │
│  JTP-03  Part-time keyword                │
│  JTP-04  Freelance keyword                │
│  JTP-05  No keyword → default full_time   │
│  JTP-06  Intern + high salary → REJECT    │
│                                           │
│  Records out: type-classified docs        │
└───────────────────┬───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│  PHASE 4 — Role Detection                 │
│  Records in: type-classified from Phase 3 │
│  Examines BOTH cleaned titles             │
│                                           │
│  ROL-01  Filter title → canonical match   │
│  ROL-02  Listing title → canonical match  │
│  ROL-03  Both valid, prefer filter title  │
│  ROL-04  Only one valid → use it          │
│  ROL-05  Neither valid → REJECT           │
│                                           │
│  Records out: role-assigned docs          │
│  Output: normalizedTitle, roleSource      │
└───────────────────┬───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│  PHASE 5–9 — Enrichment (no rejections)   │
│  Records in = Records out (pass-through)  │
│                                           │
│  5. Title Normalization (TTL-01..06)      │
│     Lowercase, expand abbrevs, canonical  │
│                                           │
│  6. Remote Detection (RMT-01..04)         │
│     All 4 location fields present?        │
│                                           │
│  7. Date Parsing (DTE-01..05)             │
│     ISO, slash, relative → postedAt       │
│                                           │
│  8. Location Normalization (LOC-01..04)   │
│     State codes, city casing, geocoords   │
│                                           │
│  9. Company Deduplication (CMP-01..05)    │
│     Strip suffixes, resolve aliases       │
│                                           │
│  10. Skills Extraction (SKL-01..02)       │
│      Scan titles + job family for tech    │
│      keywords from dictionary             │
└───────────────────┬───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│  PHASE 11 — Duplicate Detection           │
│  Records in: all cleaned docs             │
│                                           │
│  DUP-01  Hash(title+company+location+type)│
│  DUP-02  Among duplicates, keep newest    │
│  DUP-03  Flag older ones isDuplicate=true │
│                                           │
│  Records out: unique docs (dupes flagged) │
└───────────────────┬───────────────────────┘
                    ▼
           cleaned_job_data
          + etl_audit_logs saved
```

### Cascading Funnel

Each phase's **Records out** becomes the next phase's **Records in**.
Only Salary, Job Type (JTP-06), and Role Detection can reject documents.
Enrichment phases (5–10) always pass everything through.
Duplicate Detection flags but does not delete — dupes are excluded at query time.

---

## MongoDB Collections

| Collection | ~Size | Purpose |
|-----------|-------|---------|
| `raw_job_data` | 2M docs | Imported CSV data, untouched |
| `cleaned_job_data` | ~1.2M docs | ETL-processed, normalized, enriched |
| `employer_data` | ~20K docs | Pre-computed employer roll-ups |
| `etl_audit_logs` | ~50 per run | Rule-by-rule audit trail for each sync |

### Key Fields Added by ETL

| Field | Type | Source Phase |
|-------|------|-------------|
| `normalizedTitle` | string | Role Detection |
| `roleSource` | `"filter_title"` \| `"listing_title"` | Role Detection |
| `jobType` | enum | Job Type Classification |
| `isRemote` | boolean | Remote Detection |
| `postedAt` | Date | Date Parsing |
| `daysSincePosted` | number | Date Parsing |
| `normalizedState` | string | Location Normalization |
| `normalizedCity` | string | Location Normalization |
| `normalizedCountry` | string | Location Normalization |
| `latitude`, `longitude` | number | Location Normalization |
| `canonicalCompany` | string | Company Deduplication |
| `skills` | string[] | Skills Extraction |
| `isDuplicate` | boolean | Duplicate Detection |
| `duplicateHash` | string | Duplicate Detection |
| `etlSalaryFlags` | string[] | Salary Normalization |
| `etlRulesApplied` | string[] | All phases |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Aggregated dashboard stats + charts |
| GET | `/api/jobs/search` | Filtered job search with pagination |
| GET | `/api/jobs/facets` | Top 30 cities, companies, job types, skills |
| GET | `/api/jobs/facets/search` | Typeahead search for a facet type |
| POST | `/api/cleaned-jobs/sync` | Run ETL on new/changed raw docs |
| POST | `/api/cleaned-jobs/reset-and-sync` | Drop cleaned + full re-ETL |
| GET | `/api/etl-audit/runs` | List all ETL sync runs |
| GET | `/api/etl-audit/runs/:id` | Detailed phase breakdown for a run |
| GET | `/api/etl-audit/category/:cat` | Audit entries by category |
| GET | `/api/etl-audit/rule/:ruleId` | Audit entries by sub-rule |
| POST | `/api/assistant/chat` | Gemini-powered natural language Q&A |
| GET | `/api/raw-jobs` | Browse raw imported data |
| GET | `/api/employers` | Browse employer roll-ups |

---

## Frontend Pages

| Page | Route Key | What It Shows |
|------|----------|---------------|
| **Dashboard** | `dashboard` | Summary cards (total jobs, avg salary, remote %, top skill), salary/role/city charts, job type pie, top skills bar, salary by job type, top listings table |
| **Job Search** | `jobs` | Debounced keyword + location search, filterable by company/city/job type/skills/remote (all from DB with typeahead), paginated results with salary analytics charts |
| **AI Assistant** | `ai` | Chat interface powered by Gemini; understands the schema and runs Mongo aggregations |
| **ETL Audit** | `etl-audit` | Timeline view of processing runs, step-by-step phase breakdown with records in/out, sub-rule details, expandable before/after JSON samples |

---

## Dev Commands

```bash
# Backend
cd Server
npm run dev          # node --watch index.js (auto-restarts)

# Frontend
cd SocrateezAI
npm run dev          # Vite dev server with proxy → localhost:3000

# ETL (via API)
curl -X POST http://localhost:3000/api/cleaned-jobs/sync           # incremental
curl -X POST http://localhost:3000/api/cleaned-jobs/reset-and-sync # destructive full re-run
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Express server port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/socrateez` | MongoDB connection string |
| `GEMINI_API_KEY` | — | Google Generative AI API key |
| `ETL_FETCH_BATCH` | `1500` | Raw docs fetched per batch during ETL |
| `ETL_BULK_CHUNK` | `250` | Bulk write chunk size |

<div align="center">

# 🧠 Quizzer

### AI-Powered Assessment Platform for Modern Educators

**Turn any document, URL, or topic into a fully structured exam — in seconds.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend: Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://postgresql.org/)
[![Queue: Celery + Redis](https://img.shields.io/badge/Queue-Celery%20%2B%20Redis-red?logo=redis)](https://docs.celeryq.dev/)
[![AI: LangGraph](https://img.shields.io/badge/AI-LangGraph-orange)](https://langchain-ai.github.io/langgraph/)
[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-brightgreen)]()

---

**Quizzer** is a backend-authoritative, AI-native exam platform built for educators, institutions, and assessment teams. It combines intelligent quiz generation from diverse sources with real-time exam proctoring, automated grading, and rich analytics — all in one cohesive system.

---

✨ **AI quiz generation** from text, URLs, PDFs, DOCX, PPTX, images, and Excel  
🔒 **Secure exam environment** with fullscreen enforcement, tab-switch detection, and session locking  
📡 **Real-time monitoring** of live exams with violation tracking  
📊 **Automated grading** — objective scoring + AI-powered short answer evaluation  
🧩 **Flexible question types**: MCQ, True/False, Short Answer, Long Answer  
👤 **Role-based access** for Admins, Staff, and Students  

</div>

---

## 📋 Table of Contents

- [Product Overview](#product-overview)
- [What's New](#-whats-new)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Core Workflows](#core-workflows)
- [UI/UX Highlights](#uiux-highlights)
- [Performance & Scalability](#performance--scalability)
- [Security Considerations](#security-considerations)
- [Deployment Guide](#deployment-guide)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Product Overview

Quizzer is designed for **educators, professors, and training teams** who need to create, deploy, and evaluate assessments efficiently. It removes the bottleneck of manual question writing by letting AI generate complete, structured quizzes from any source material — while keeping the educator in full control of content quality through a review and approval workflow.

### Who is it for?

| Role | Use Cases |
|------|-----------|
| **Professors / Teachers** | Generate quizzes from lecture notes, textbooks, or slides |
| **Training Teams** | Create onboarding assessments from policy documents |
| **Administrators** | Monitor live exams, review results, manage integrity flags |
| **Students** | Take timed, proctored exams in a secure browser environment |

### Key Use Cases

- 📄 Upload a PDF syllabus → Get a 30-question MCQ quiz in under a minute
- 🌐 Paste a URL → Generate comprehension questions automatically
- 🔍 Monitor 50+ simultaneous exam attempts in real time
- 🤖 Auto-grade short answers using AI, flag suspicious results

---

## 🆕 What's New

- ⚡ **Faster AI generation experience** with stream-capable quiz generation and live progress updates
- 🧪 **Upgraded review workspace** with focus mode, bulk actions, filters, and high-density review lists
- 🔐 **Google OAuth sign-in** support in addition to email/password authentication
- 🧭 **Smoother creation flow** from source ingestion to approval and publishing

---

## ✨ Key Features

### 🤖 AI-Powered Quiz Generation

- Generate quizzes from **text input, URLs, uploaded documents** (PDF, DOCX, PPTX, images, Excel)
- **Fast generation modes**: standard async jobs plus stream-capable generation for lower perceived latency
- OCR support for **scanned PDFs** and image-based documents
- LangGraph-orchestrated multi-step pipeline: Summarize → Enhance Prompt → Generate Questions → Fill Answer Keys
- **Blueprint-based generation**: specify sections, question types, difficulty, and count
- Per-question **regeneration** — rewrite individual questions without regenerating the entire quiz
- **Streaming support** for real-time quiz generation progress

### 🔒 Secure Exam Environment

- **Fullscreen enforcement** — exam exits trigger violations
- **Tab-switch detection** — each switch is logged and counted
- **Copy-paste blocking** — prevents answer sharing
- **Session locking** — prevents multi-device or multi-tab attempts
- **Server-authoritative timer** via Redis — client clock cannot be tampered
- Configurable **violation limits** with automatic exam termination

### 📡 Real-Time Monitoring

- Live exam dashboard showing all active attempts
- Per-student violation counts and integrity flags
- Heartbeat tracking to detect disconnected clients
- Attempt status tracking: `IN_PROGRESS`, `SUBMITTED`

### 📊 Analytics & Results

- Automatic scoring for MCQ and True/False questions
- **AI-powered short answer evaluation** via LLM
- Result export to **CSV / PDF**
- Score aggregation, question difficulty analysis, attempt distribution
- Integrity flagging for high-violation attempts

### 🔐 Authentication & Security

- JWT-based authentication with **Argon2 password hashing**
- **Google OAuth 2.0 / OIDC login** with secure callback validation
- Cookie-based session management (HTTPOnly, Secure, SameSite)
- **Role-based access control**: `ADMIN`, `STAFF`, `USER`
- Email verification flow
- Configurable CORS with regex origin support

---

## 🏗️ System Architecture

Quizzer follows a **clean separation of concerns** across four layers: frontend, API, workers, and external services.

```mermaid
flowchart LR
    subgraph Client
        A[Next.js Frontend]
    end

    subgraph API Layer
        B[FastAPI Backend]
    end

    subgraph Data Layer
        C[(PostgreSQL)]
        D[(Redis Cache)]
    end

    subgraph Background Processing
        E[Celery Workers]
    end

    subgraph AI & External Services
        F[LLM Provider\nOpenRouter / OpenAI]
        G[Cloud Storage\nGCS / S3]
    end

    A -->|REST API + Cookies| B
    B -->|SQLAlchemy ORM| C
    B -->|Exam Timer / Cache| D
    B -->|Enqueue Tasks| E
    E -->|LangGraph Workflows| F
    E -->|Store Exports| G
    D -->|Task Broker / Backend| E
```

### Request Flow

1. **Client** sends authenticated HTTP requests to FastAPI (JWT via cookie)
2. **FastAPI** validates the request, applies RBAC, and processes business logic
3. **Synchronous operations** (quiz CRUD, settings, user profile) resolve immediately
4. **Async operations** (AI generation, result processing, document extraction) are enqueued as Celery tasks
5. **Celery Workers** pick up tasks from Redis, execute LangGraph AI pipelines, and write results back to PostgreSQL
6. **Client polls** the `/ai/jobs/{job_id}` endpoint to track async task progress
7. **Exam sessions** use Redis for real-time state: timer, heartbeat, violations, and session locks

### Background Jobs

| Task | Trigger | Description |
|------|---------|-------------|
| `document_task` | File upload | Extract text via OCR / parsers |
| `quiz_creation_task` | AI generate request | Run full LangGraph generation pipeline |
| `result_processing_task` | Exam submission | Score answers, run AI evaluation |
| `export_task` | Export request | Generate CSV / PDF report |

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|-----------|---------|
| **Next.js 14** (App Router) | React framework with SSR/SSG |
| **TypeScript 5** | Type-safe development |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn/ui + Radix UI** | Accessible component library |
| **Zustand** | Lightweight global state management |
| **TanStack Query v5** | Server state, caching, and async data fetching |
| **React Hook Form + Zod** | Form handling and schema validation |
| **Axios** | HTTP client |
| **Socket.io-client** | Real-time communication |
| **Framer Motion** | UI animations |
| **Recharts** | Data visualization and analytics charts |
| **next-themes** | Dark / light mode support |

### Backend

| Technology | Purpose |
|-----------|---------|
| **FastAPI** | High-performance async Python API framework |
| **SQLAlchemy (async)** | ORM with asyncpg driver |
| **Alembic** | Database schema migrations |
| **python-jose** | JWT token signing and verification |
| **Argon2** (passlib) | Secure password hashing |
| **structlog** | Structured JSON logging |
| **httpx** | Async HTTP client for external calls |

### AI / LLM

| Technology | Purpose |
|-----------|---------|
| **LangChain Core + OpenAI** | LLM abstractions and OpenAI-compatible clients |
| **LangGraph** | Multi-step AI workflow orchestration (state machines) |
| **OpenRouter** | Default LLM gateway (supports many models) |
| **tiktoken** | Token counting for prompt management |
| **tenacity** | Retry logic for LLM API calls |

### File Processing

| Technology | Purpose |
|-----------|---------|
| **pdfplumber / PyMuPDF** | PDF text extraction |
| **python-docx** | Word document parsing |
| **python-pptx** | PowerPoint slide extraction |
| **pytesseract + Pillow** | OCR for scanned documents and images |
| **openpyxl** | Excel file parsing |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary relational database |
| **Redis** | Task broker, result backend, exam state cache |
| **Celery** | Distributed background task queue |
| **Docker** | Frontend containerization |
| **GCS / S3 (boto3)** | Optional cloud file storage |

---

## 📁 Folder Structure

```
Quizzer/
├── backend/                    # Python FastAPI application
│   ├── ai/                     # AI orchestration layer
│   │   ├── agents/             # Specialized LLM agents (summarize, generate, evaluate)
│   │   ├── graphs/             # LangGraph state machine workflows
│   │   └── schemas/            # Pydantic schemas for AI input/output
│   ├── alembic/                # Database migration scripts
│   │   └── versions/           # Auto-generated migration files
│   ├── api/                    # FastAPI route handlers (one file per resource)
│   ├── core/                   # App configuration, DB engine, Redis client, LLM factory
│   ├── integrations/           # Third-party service integrations (OCR, cloud storage)
│   ├── models/                 # SQLAlchemy ORM models
│   ├── schemas/                # Pydantic request/response schemas
│   ├── services/               # Business logic services (quiz, attempt, result, etc.)
│   ├── utils/                  # Shared utility functions
│   ├── workers/                # Celery task definitions
│   ├── tests/                  # Backend test suite
│   └── main.py                 # FastAPI app entry point and router registration
│
├── frontend/                   # Next.js 14 TypeScript application
│   └── src/
│       ├── app/                # Next.js App Router pages and layouts
│       ├── api/                # Axios-based API client functions (per feature)
│       ├── components/         # Shared reusable React components
│       ├── features/           # Feature modules (quiz, dashboard, account, AI, etc.)
│       ├── hooks/              # Custom React hooks (timer, heartbeat, autosave)
│       ├── lib/                # Utility functions and helpers
│       ├── security/           # Client-side security utilities (violation detection)
│       ├── stores/             # Zustand global state stores
│       └── types/              # TypeScript type definitions
│
├── uploads/                    # Local file storage for uploaded documents
├── pyproject.toml              # Python project metadata and dependencies
├── requirements.txt            # pip-compatible dependency list
└── alembic.ini                 # Alembic migration configuration
```

---

## 🚀 Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- (Optional) Tesseract OCR for scanned document support

### 1. Clone the Repository

```bash
git clone https://github.com/dipanshuchoudhary-data/Quizzer.git
cd Quizzer
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Run database migrations
alembic upgrade head
```

### 3. Frontend Setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Copy and configure frontend environment
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL
```

### 4. Start the Backend API

```bash
# From the project root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start the Celery Worker

```bash
# From the project root
celery -A backend.workers.celery_app worker --loglevel=info
```

### 6. Start the Frontend

```bash
cd frontend
npm run dev
```

The application will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 🔧 Environment Variables

Create a `.env` file in the project root with the following variables:

### Required

```bash
# ── Database ──────────────────────────────────────────────────────────
POSTGRES_DSN=postgresql+asyncpg://user:password@localhost:5432/quizzer
# Full async-compatible PostgreSQL connection string

REDIS_URL=redis://localhost:6379
# Redis connection URL used for task broker, result backend, and exam state

# ── Security ──────────────────────────────────────────────────────────
JWT_SECRET_KEY=your-secret-key-minimum-32-chars
# Secret used to sign and verify JWT access tokens

# ── LLM / AI ──────────────────────────────────────────────────────────
LLM_MODEL=openai/gpt-4-turbo
# LLM model identifier (OpenRouter format: "provider/model")

LLM_API_KEY=your-llm-api-key
# API key for your LLM provider (OpenRouter or OpenAI)
```

### Optional

```bash
# ── App Configuration ─────────────────────────────────────────────────
APP_ENV=local                           # local | dev | production
APP_URL=http://localhost:8000           # Public backend URL
FRONTEND_URL=http://localhost:3000      # Public frontend URL
CORS_ALLOW_ORIGINS=http://localhost:3000  # Comma-separated CORS origins
DEMO_MODE=false                         # Enable demo mode (restricts certain operations)

# ── JWT ───────────────────────────────────────────────────────────────
JWT_ALGORITHM=HS256                     # JWT signing algorithm
JWT_EXPIRE_MINUTES=1440                 # Token expiry (default: 24 hours)

# ── Cookies ───────────────────────────────────────────────────────────
COOKIE_SECURE=false                     # Set to true in production (HTTPS required)
COOKIE_SAMESITE=lax                     # lax | strict | none
COOKIE_DOMAIN=                          # Set for cross-subdomain cookie sharing

# ── LLM Provider ─────────────────────────────────────────────────────
LLM_PROVIDER=openrouter                 # LLM gateway provider
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
QUIZ_STREAM_TIMEOUT_SECONDS=300         # Streaming generation timeout

# ── Email ─────────────────────────────────────────────────────────────
EMAIL_FROM=Quizzer <no-reply@quizzer.app>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=user@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_USE_TLS=true

# ── Google OAuth (optional) ───────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Vercel proxy option:
# GOOGLE_REDIRECT_URI=https://your-frontend.vercel.app/backend/auth/google/callback
# Add the same URI in Google Cloud Console > Authorized redirect URIs.

# ── Cloud Storage (pick one or leave blank for local) ─────────────────
GCS_BUCKET_NAME=your-gcs-bucket        # Google Cloud Storage bucket name
GCP_PROJECT_ID=your-gcp-project        # GCP project ID
```

### Frontend Environment (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
# Backend API base URL used by the Next.js client

NEXT_PUBLIC_GOOGLE_AUTH_URL=http://localhost:8000/login/google
# Optional Google OAuth start URL. On Vercel proxy deployments, use /backend/login/google.
```

---

## 🔌 API Overview

The API is organized by resource domain. All protected routes require a valid JWT sent via HTTP-only cookie.

| Domain | Base Path | Description |
|--------|-----------|-------------|
| **Auth** | `/auth` | Register, login, logout, token refresh, password management |
| **Google Auth** | `/login/google`, `/auth/google/callback` | OAuth sign-in with Google and secure callback flow |
| **Users** | `/users` | User profile read and update |
| **Quizzes** | `/quizzes` | Quiz CRUD, publish/unpublish/archive lifecycle |
| **Sections** | `/quizzes/{id}/sections` | Section management within a quiz |
| **Questions** | `/questions` | Question CRUD, duplication, and AI regeneration |
| **AI Generation** | `/ai/quiz` | Source ingestion (text, URL, files) and quiz generation |
| **AI Jobs** | `/ai/jobs` | Async job status polling |
| **Documents** | `/documents` | Document upload, listing, and deletion |
| **Attempts** | `/attempts` | Start, heartbeat, and submit exam attempts |
| **Answers** | `/answers` | Save individual question answers |
| **Violations** | `/violations` | Log and retrieve exam violations |
| **Results** | `/results` | View and export quiz results |
| **Review** | `/review` | Approve/reject AI-generated questions |
| **Monitoring** | `/monitoring` | Live attempt monitoring for educators |
| **Dashboard** | `/dashboard` | Summary stats, live exams, analytics |
| **Exports** | `/exports` | Generate downloadable CSV/PDF result exports |
| **Health** | `/health` | API health check |

Interactive API documentation is available at `/docs` (Swagger UI) and `/redoc` when the backend is running.

---

## 🔄 Core Workflows

### A. Quiz Creation (Manual)

1. Educator creates a new quiz via `POST /quizzes`
2. Sections are added via `POST /quizzes/{id}/sections`
3. Questions are created individually via `POST /questions`
4. Educator configures settings (duration, attempts, security) via `PATCH /quizzes/{id}/settings`
5. Quiz is published via `POST /quizzes/{id}/publish`

### B. AI Quiz Generation

1. Educator creates a quiz and uploads source material:
   - Plain text via `POST /ai/quiz/source/text`
   - Website URL via `POST /ai/quiz/source/url`
   - Files (PDF, DOCX, PPTX, images) via `POST /ai/quiz/source/files`
2. Files are processed asynchronously — Celery runs OCR/text extraction
3. Educator triggers generation via `POST /ai/quiz/generate` with a blueprint (sections, question types, difficulty)
4. LangGraph pipeline runs: **Summarize → Enhance Prompt → Generate Questions → Fill Answer Keys**
5. Client polls `GET /ai/jobs/{job_id}` for status updates
6. Generated questions enter **REVIEW** status for educator approval
7. Educator approves via `POST /review/bulk/approve` and publishes the quiz

### C. Publishing an Exam

1. All questions must be in `APPROVED` status
2. Quiz settings are configured (duration, violation limits, security flags)
3. `POST /quizzes/{id}/publish` generates a unique `public_id`
4. Students access the exam at `/exam/{public_id}`

### D. Student Attempt Flow

1. Student opens exam URL and submits their profile (name, enrollment, course)
2. `POST /attempts/{quiz_id}/start` — Server locks the session in Redis and starts the authoritative countdown timer
3. Questions are served from a snapshot stored at attempt start (prevents mid-exam edits)
4. Student answers are saved in real time via `POST /answers/{attempt_id}`
5. Violations (tab switch, fullscreen exit, copy-paste) are reported via `POST /violations/{attempt_id}`
6. Exam auto-submits when the Redis timer expires or student clicks submit
7. `POST /attempts/{attempt_id}/submit` finalizes the attempt

### E. Result Evaluation

1. Submission triggers a Celery `result_processing_task`
2. MCQ and True/False answers are scored deterministically against the answer key
3. Short answer responses are evaluated by the LLM via `evaluate_short_answers()` agent
4. Final score, violation count, and integrity flag are written to the `Result` table
5. Results are available via `GET /results/{quiz_id}`

---

## 🖥️ UI/UX Highlights

### Dashboard

The educator dashboard provides a bird's-eye view of all quizzes, active exams, and recent results. Summary cards show total quizzes, active attempts, and flagged results at a glance.

### Quiz Editor

A structured editor allows educators to manage quiz sections, reorder questions, adjust marks, and toggle individual question settings — all with instant autosave.

### AI Generation Interface

A guided multi-step workflow walks educators through source input → blueprint configuration → generation → review. Progress is streamed in real time.

### Exam Interface (Student)

A distraction-free, full-screen exam UI presents questions one at a time or all at once, with a live countdown timer. Answers are auto-saved to prevent data loss.

### Live Monitoring Dashboard

Educators can observe all concurrent exam attempts in real time, viewing each student's progress, time remaining, and any detected violations.

### Anti-Cheating Features

- Browser fullscreen is enforced at exam start
- Tab/window switching triggers logged violations
- Copy-paste actions are intercepted and reported
- Exceeding the violation threshold triggers automatic exam termination

---

## ⚡ Performance & Scalability

### Async Architecture

The FastAPI backend is fully async using `asyncpg` for database access and `httpx` for external HTTP calls, enabling high-throughput request handling without thread-blocking.

### Background Processing

All computationally expensive operations — document parsing, AI generation, result processing, and exports — are offloaded to **Celery workers**. This keeps API response times fast and allows horizontal scaling of the worker pool independently from the API layer.

### Worker Configuration

```
worker_concurrency = max(2, cpu_count)  # Dynamic per-machine concurrency
worker_prefetch_multiplier = 1           # Fair task distribution
task_acks_late = True                    # Re-queue tasks on worker crash
```

### Caching Strategy

Redis is used for:

- **Exam timer state** — authoritative countdown isolated from the API
- **Violation counters** — atomic increments without database writes per violation
- **Session locks** — prevent concurrent attempt creation
- **AI job results** — short-term caching (TTL: 1 hour)

---

## 🔐 Security Considerations

### Authentication

- Passwords are hashed with **Argon2** (memory-hard, resistant to GPU brute-force)
- Google OAuth follows the authorization-code OIDC flow with token/claim validation and nonce checks
- JWT tokens are signed with a configurable secret and stored in **HTTPOnly cookies** (inaccessible to JavaScript)
- Cookie flags: `Secure` (HTTPS-only in production), `SameSite=lax` (CSRF protection)

### Authorization

- Role-based access control: `ADMIN`, `STAFF`, `USER`
- All quiz and attempt endpoints validate ownership — users cannot access other users' resources

### Exam Integrity

| Control | Mechanism |
|---------|-----------|
| Timer tampering | Server-authoritative timer in Redis; client cannot extend time |
| Answer injection | Questions snapshot taken at attempt start; edits after publish don't affect live attempts |
| Multi-session attempts | Session lock in Redis prevents same enrollment from having two active attempts |
| Violation tracking | Each violation type is logged with a timestamp; configurable auto-terminate threshold |

### Network Security

- CORS is configured with explicit origin allowlists
- All sensitive configuration is loaded from environment variables, never hardcoded

---

## 🚢 Deployment Guide

### Backend

```bash
# Production startup with Gunicorn + Uvicorn workers
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Run migrations before deployment
alembic upgrade head
```

### Celery Worker

```bash
celery -A backend.workers.celery_app worker \
  --loglevel=info \
  --concurrency=4 \
  --queues=celery
```

### Frontend (Docker)

```bash
cd frontend

# Build production image
docker build -t quizzer-frontend .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  quizzer-frontend
```

### Production Environment Checklist

- [ ] `POSTGRES_DSN` points to production database
- [ ] `REDIS_URL` points to production Redis instance
- [ ] `JWT_SECRET_KEY` is a strong, randomly generated secret (32+ chars)
- [ ] `COOKIE_SECURE=true` (requires HTTPS)
- [ ] `CORS_ALLOW_ORIGINS` is set to your production frontend domain
- [ ] Google OAuth redirect URI is registered in Google Cloud Console. For Vercel proxy deployments, use `https://your-frontend.vercel.app/backend/auth/google/callback` and set `NEXT_PUBLIC_GOOGLE_AUTH_URL=/backend/login/google`.
- [ ] `LLM_API_KEY` is set with appropriate rate limits
- [ ] `APP_ENV=production`

---

## 📸 Screenshots

> _Screenshots will be added as the product UI stabilizes._

| Screen | Preview |
|--------|---------|
| Dashboard | <img src="https://via.placeholder.com/800x450?text=Dashboard" alt="Dashboard" width="800"/> |
| Quiz Editor | <img src="https://via.placeholder.com/800x450?text=Quiz+Editor" alt="Quiz Editor" width="800"/> |
| AI Generation | <img src="https://via.placeholder.com/800x450?text=AI+Quiz+Generation" alt="AI Generation" width="800"/> |
| Exam Interface | <img src="https://via.placeholder.com/800x450?text=Exam+Interface" alt="Exam Interface" width="800"/> |
| Live Monitoring | <img src="https://via.placeholder.com/800x450?text=Live+Monitoring" alt="Live Monitoring" width="800"/> |
| Results & Analytics | <img src="https://via.placeholder.com/800x450?text=Results+%26+Analytics" alt="Results" width="800"/> |

---

## 🔮 Future Improvements

- [ ] **Email verification flow** — full SMTP-based verification with resend support
- [ ] **Mobile-responsive exam interface** — optimized for tablet and phone exam taking
- [ ] **Advanced analytics** — per-question difficulty curves, cohort comparisons
- [ ] **Question bank** — reusable question library across quizzes
- [ ] **Collaborative editing** — multi-educator quiz co-authoring
- [ ] **LMS integrations** — Canvas, Moodle, Google Classroom exports
- [ ] **Enhanced proctoring** — webcam monitoring, screen recording hooks
- [ ] **Scheduled exams** — open/close windows with timezone support
- [ ] **Localization** — multi-language UI and question support
- [ ] **WebSocket-based real-time updates** — replace polling for AI job status

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

### 1. Fork the Repository

```bash
# Fork via GitHub UI, then clone your fork
git clone https://github.com/your-username/Quizzer.git
cd Quizzer
```

### 2. Set Up Locally

Follow the [Setup Instructions](#setup-instructions) above to get the full stack running locally.

### 3. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 4. Make Your Changes

- Follow existing code conventions (async FastAPI patterns, Pydantic schemas, Zustand stores)
- Add or update tests for any new functionality
- Keep commits focused and descriptive

### 5. Submit a Pull Request

```bash
git push origin feature/your-feature-name
# Open a PR on GitHub with a clear description of the change
```

### Guidelines

- **Backend**: Follow async-first patterns; use dependency injection for DB sessions and current user
- **Frontend**: Keep feature logic inside `features/`, shared components in `components/`
- **AI changes**: Test LangGraph workflows with mock LLM responses before integrating
- **Database changes**: Always create an Alembic migration for schema changes

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ using FastAPI, Next.js, and LangGraph

</div>

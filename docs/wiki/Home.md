# 🧠 Quizzer — Wiki Home

> **AI-Powered Assessment Platform for Modern Educators**  
> *Turn any document, URL, or topic into a fully structured exam — in seconds.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/dipanshuchoudhary-data/Quizzer/blob/main/LICENSE)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend: Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://postgresql.org/)
[![AI: LangGraph](https://img.shields.io/badge/AI-LangGraph-orange)](https://langchain-ai.github.io/langgraph/)
[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-brightgreen)]()

---

## 📖 What is Quizzer?

**Quizzer** is a backend-authoritative, AI-native exam platform built for educators, institutions, and assessment teams. It combines intelligent quiz generation from diverse content sources with real-time exam proctoring, automated grading, and rich analytics — all in one cohesive system.

Whether you're a professor turning lecture notes into a structured exam, a training manager creating onboarding assessments, or an administrator monitoring dozens of live test sessions simultaneously — Quizzer is designed to make it fast, reliable, and intelligent.

---

## 🗂️ Wiki Navigation

| Section | Description |
|---------|-------------|
| **[[Home]]** | ← You are here — project overview & quick start |
| **[[Installation & Setup]]** | Step-by-step setup for local development |
| **[[Architecture]]** | System design, data flow, and component overview |
| **[[API Reference]]** | REST API endpoints and WebSocket events |
| **[[AI & Quiz Generation]]** | How the AI pipeline generates quizzes |
| **[[Exam & Proctoring]]** | Secure exam environment and integrity enforcement |
| **[[Grading & Results]]** | Automated grading, AI short-answer evaluation |
| **[[Role & Permissions]]** | Admin, Staff, and Student role capabilities |
| **[[Deployment Guide]]** | Production deployment with Docker & cloud storage |
| **[[Contributing]]** | How to contribute to the project |
| **[[Changelog]]** | Version history and release notes |

---

## ✨ Core Features at a Glance

### 🤖 AI-Powered Quiz Generation
- Generate quizzes from **text, URLs, PDFs, DOCX, PPTX, images (OCR), and Excel**
- Multi-step **LangGraph pipeline**: Summarize → Enhance Prompt → Generate Questions → Fill Answer Keys
- **Blueprint-based generation** — specify sections, question types, difficulty, and count
- Per-question **regeneration** without rewriting the entire quiz
- **Educator review & approval** workflow before quizzes go live

### 🔒 Secure Exam Environment
- **Fullscreen enforcement** — exits trigger violation logs
- **Tab-switch detection** — each switch is tracked and counted
- **Copy-paste blocking** — prevents answer sharing
- **Session locking** — prevents multi-device or multi-tab attempts
- **Server-authoritative timer** via Redis — immune to client clock manipulation
- Configurable **violation thresholds** with automatic exam termination

### 📡 Real-Time Monitoring
- Live dashboard displaying all active exam attempts
- Per-student violation counts and integrity status
- **Heartbeat tracking** for disconnected clients
- WebSocket-powered live updates via Socket.IO

### 📊 Automated Grading & Analytics
- Instant scoring for **MCQ** and **True/False** questions
- **AI-powered short answer evaluation** using LLM
- Result export to **CSV / PDF**
- Question difficulty analysis and attempt distribution charts
- Integrity flag summaries

### 🧩 Flexible Question Types
| Type | Description |
|------|-------------|
| **MCQ** | Multiple-choice with one correct option |
| **True/False** | Binary answer questions |
| **Short Answer** | AI-graded free-text responses (brief) |
| **Long Answer** | Extended free-text responses |

---

## 🏗️ System Architecture (Overview)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│                  Next.js 14 (App Router / React 18)             │
│         Auth • Quiz Creator • Exam Interface • Dashboard        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                      FastAPI Backend                            │
│              REST API + WebSocket (Socket.IO)                   │
│   /auth  /quizzes  /questions  /attempts  /results  /monitor    │
└──────┬──────────────┬───────────────────┬───────────────────────┘
       │              │                   │
       ▼              ▼                   ▼
 PostgreSQL        Redis             Celery Workers
 (ORM via       (Session cache,    (Background tasks)
 SQLAlchemy)     job queues)
                                          │
                               ┌──────────▼──────────┐
                               │   LangGraph / LLM   │
                               │  Quiz Generation,   │
                               │  Answer Keys,       │
                               │  Short Answer Eval  │
                               └─────────────────────┘
```

> For detailed architecture documentation, see the **[[Architecture]]** wiki page or [`/docs/architecture.md`](https://github.com/dipanshuchoudhary-data/Quizzer/blob/main/docs/architecture.md).

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 14** (App Router) | UI framework with server-side rendering |
| **React 18** + **TypeScript 5** | Component model and type safety |
| **Tailwind CSS 4** + **shadcn/ui** | Styling and accessible UI components |
| **TanStack Query v5** | Data fetching and server state management |
| **Zustand** | Client-side global state |
| **Socket.io-client** | Real-time WebSocket communication |
| **React Hook Form** + **Zod** | Form handling and validation |
| **Framer Motion** | Animations and transitions |
| **Recharts** | Result analytics charts |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** + **FastAPI** | Async REST API and WebSocket server |
| **PostgreSQL** + **SQLAlchemy 2.0** | Relational database and ORM |
| **Alembic** | Database schema migrations |
| **Celery** + **Redis** | Background task queue |
| **JWT** (python-jose) + **Argon2** | Authentication and password hashing |
| **structlog** | Structured JSON logging |

### AI / LLM
| Technology | Purpose |
|-----------|---------|
| **LangChain Core** + **LangGraph** | AI workflow orchestration |
| **OpenAI / OpenRouter** | LLM provider for quiz generation and grading |
| **Tiktoken** | Token counting for context management |
| **Tenacity** | Retry logic for LLM calls |

### File Processing
| Technology | Purpose |
|-----------|---------|
| **pdfplumber** + **PyMuPDF** | PDF text extraction |
| **pytesseract** + **Pillow** | OCR for scanned documents and images |
| **python-docx**, **python-pptx**, **openpyxl** | Office document parsing |

---

## 👤 Who Uses Quizzer?

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access — manage users, monitor all exams, configure platform settings |
| **Staff / Teacher** | Create & publish quizzes, monitor their exams, view results and analytics |
| **Student** | Take assigned exams in a secure, proctored environment |

---

## ⚡ Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- An OpenAI API key (or OpenRouter API key)

### 1. Clone the Repository

```bash
git clone https://github.com/dipanshuchoudhary-data/Quizzer.git
cd Quizzer
```

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database, Redis, and API key configuration

# Run database migrations
alembic upgrade head

# Start the backend API
python run_api.py
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with the API base URL

# Start the development server
npm run dev
```

### 4. Start Background Workers

```bash
# In a separate terminal, from the project root
celery -A backend.workers.celery_app worker --loglevel=info
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs

> For full environment variable documentation and production deployment, see **[[Installation & Setup]]** and **[[Deployment Guide]]**.

---

## 🔄 Core Workflows

### Quiz Generation Flow (AI)
```
User uploads source → Backend enqueues Celery task → Worker extracts text
  → LangGraph: Summarize → Enhance Prompt → Generate Questions → Fill Keys
    → Questions saved to DB → Educator reviews & approves → Quiz published
```

### Exam Session Flow
```
Student starts attempt → Redis timer armed → Security guards activated
  → Student answers questions (auto-saved) → Timer enforces deadline
    → Student submits → Celery scores answers → Results stored → Analytics updated
```

### Real-Time Monitoring Flow
```
Admin opens monitor dashboard → Subscribes via Socket.IO
  → Backend pushes live events: attempt status, violations, time remaining
    → Admin can observe all active attempts simultaneously
```

---

## 📁 Repository Structure

```
Quizzer/
├── backend/              # Python FastAPI backend
│   ├── ai/               # LangGraph graphs & LLM agents
│   ├── api/              # FastAPI route handlers
│   ├── core/             # Config, DB, Redis, security utilities
│   ├── models/           # SQLAlchemy ORM models
│   ├── schemas/          # Pydantic request/response schemas
│   ├── services/         # Business logic (grading, export, email)
│   ├── workers/          # Celery background tasks
│   ├── alembic/          # Database migrations
│   └── main.py           # FastAPI app entry point
│
├── frontend/             # Next.js 14 TypeScript application
│   └── src/
│       ├── app/          # App Router pages & layouts
│       ├── features/     # Feature modules (quiz, dashboard, account)
│       ├── components/   # Shared UI components (shadcn/ui)
│       ├── security/     # Client-side exam integrity guards
│       ├── stores/       # Zustand global state
│       └── hooks/        # Custom React hooks
│
├── docs/                 # Documentation
│   ├── architecture.md   # System architecture overview
│   └── wiki/             # Wiki source files (synced to GitHub Wiki)
│       └── Home.md       # Wiki home page
├── uploads/              # Local file storage (dev only)
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Python project metadata
└── README.md             # Main project README
```

---

## 🔐 Security Highlights

- **JWT authentication** with HTTPOnly, Secure, SameSite cookies
- **Argon2** password hashing (industry best practice)
- **Server-authoritative exam timers** — no client-side trust
- **Resource ownership validation** on every API endpoint
- **Violation tracking** with configurable thresholds
- **Email verification** for new accounts

---

## 🚀 Roadmap & Future Improvements

- [ ] Mobile-responsive exam interface
- [ ] Configurable AI model per quiz
- [ ] LMS integrations (Canvas, Moodle, Google Classroom)
- [ ] Multi-language quiz generation
- [ ] Webcam proctoring integration
- [ ] Advanced analytics and reporting dashboards
- [ ] Batch student enrollment and result distribution

---

## 🤝 Contributing

We welcome contributions! Please read our **[[Contributing]]** guide for:
- Code style and conventions
- How to run tests
- Branch naming and PR workflow
- Reporting bugs and requesting features

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](https://github.com/dipanshuchoudhary-data/Quizzer/blob/main/LICENSE) for details.

---

<div align="center">

Made with ❤️ for modern educators

[GitHub Repository](https://github.com/dipanshuchoudhary-data/Quizzer) · [Report a Bug](https://github.com/dipanshuchoudhary-data/Quizzer/issues/new?template=bug_report.md) · [Request a Feature](https://github.com/dipanshuchoudhary-data/Quizzer/issues/new?template=feature_request.md)

</div>

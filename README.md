<div align="center">

# 🧠 Quizzer

### **AI-native assessment infrastructure for educators who need speed, control, and exam integrity**

<p>
  <a href="https://quizzer-two-sandy.vercel.app"><img src="https://img.shields.io/badge/🌐_Live_App-quizzer--two--sandy.vercel.app-0ea5e9?style=for-the-badge" alt="Live App"/></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Frontend-Next.js_14-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Queue-Celery_+_Redis-dc2626?style=flat-square&logo=redis" />
  <img src="https://img.shields.io/badge/AI-LangGraph_+_LLM-f59e0b?style=flat-square" />
  <img src="https://img.shields.io/badge/Auth-JWT_+_Google_OAuth-2563eb?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square" />
</p>

</div>

---

## ✨ Product Overview

**Quizzer** is a **backend-authoritative, AI-powered quiz and exam platform** built for real-world academic and training environments.  
It turns raw source material (text, URLs, documents, scanned files) into publishable assessments, then enforces secure exam workflows with integrity monitoring, autosave, and analytics.

### Why Quizzer stands out

- **Source-to-assessment in one workflow** (ingest → generate → review → publish → monitor → evaluate)
- **Human-in-the-loop quality control** with sectioned review and approval gates
- **Security-first exam runtime** with Redis-backed authoritative timers + violation tracking
- **Production-oriented architecture** (FastAPI + async DB + Redis + Celery + LangGraph)
- **Built for scale and operator control**, not toy demo generation

---

## 🚀 Feature Showcase

### Core Features

- **AI Quiz Generation** from:
  - Direct text
  - Website URLs
  - Files: PDF, DOCX, PPTX, TXT, PNG/JPG (OCR supported)
- **Blueprint-driven generation** with per-section structure (count, type, marks)
- **Question lifecycle control**: draft → review → approved → publish
- **Exam publishing with public links** and student attempt flow
- **Result processing** for objective and free-text answers

### Advanced Features

- **Streaming AI generation path (SSE)** for lower perceived latency and live progress
- **Multiple authoring modes** (Source-first Auto, Guided, Custom structure)
- **Per-question regeneration** + bulk review actions (approve, move, marks, regenerate)
- **Review Focus Mode** + virtualized question list for high-volume moderation
- **Dashboard intelligence**:
  - Summary metrics
  - Live exam board
  - Analytics with deltas, trends, distribution, and insights
- **Notification inbox + staff broadcast updates**
- **Course/cluster organization support**
- **Account control center** (profile, avatar upload, sessions, workspace defaults)

### Security Features

- **JWT auth in HTTPOnly cookies**
- **Argon2 password hashing**
- **Google OAuth 2.0 / OIDC login**
- **Role-aware access controls**
- **Exam integrity guards**:
  - Fullscreen exit detection
  - Tab switch detection
  - Paste blocking + large text insert detection
  - Violation counting and integrity flagging
- **Session lock + heartbeat + server-authoritative Redis timer**

---

## 🆕 Newly Added / Highlighted Updates

- ✅ **Google OAuth sign-in flow** with secure callback handling  
- ✅ **AI streaming generation endpoints** (`generate-stream/init` + SSE stream)  
- ✅ **Source-first + Guided generation controls** with richer blueprint normalization  
- ✅ **Upgraded review workspace** (focus mode, filters, virtual list, bulk tools)  
- ✅ **Notification inbox + broadcast system**  
- ✅ **Account settings workspace** with session management and avatar pipeline  
- ✅ **Cache-backed dashboard endpoints** for faster analytics and live views  
- ✅ **Hybrid task execution mode** (`USE_CELERY`) for worker and non-worker deployments

---

## 🎬 Visual Walkthrough (Placeholders)

### 1) Dashboard Experience
<p align="center">
  <img src="https://via.placeholder.com/1280x720?text=Dashboard+Walkthrough+GIF" alt="Dashboard Walkthrough Placeholder" width="92%"/>
</p>

### 2) AI Quiz Creation + Review Flow
<p align="center">
  <img src="https://via.placeholder.com/1280x720?text=Quiz+Flow+Animation+Placeholder" alt="Quiz Flow Placeholder" width="92%"/>
</p>

### 3) Results + Analytics Journey
<p align="center">
  <img src="https://via.placeholder.com/1280x720?text=Results+and+Analytics+GIF+Placeholder" alt="Results Placeholder" width="92%"/>
</p>

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend                           │
│  Auth • Quiz Creation • Review • Monitoring • Results • Analytics    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS (cookie auth)
┌───────────────────────────────▼───────────────────────────────────────┐
│                            FastAPI Backend                            │
│  Auth, Quizzes, AI Source Ingestion, Attempts, Answers, Results,     │
│  Dashboard, Notifications, Monitoring                                 │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │                               │
        ┌───────▼────────┐               ┌──────▼────────┐
        │   PostgreSQL   │               │     Redis     │
        │  core records  │               │ timer/cache/  │
        │ + audit state  │               │ locks/queues  │
        └───────┬────────┘               └──────┬────────┘
                │                               │
                └──────────────┬────────────────┘
                               ▼
                     ┌─────────────────────┐
                     │ Celery / Inline Task│
                     │ Execution Dispatcher │
                     └──────────┬──────────┘
                                ▼
                   ┌───────────────────────────┐
                   │ LangGraph + LLM Providers │
                   │ generation + evaluation   │
                   └───────────────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14, React 18, TypeScript 5 | App Router UI and typed client logic |
| UI/UX | Tailwind CSS 4, shadcn/ui, Radix, Framer Motion | Modern, accessible, animated interface |
| State/Data | TanStack Query, Zustand, Axios | Server-state + client-state orchestration |
| Backend API | FastAPI, Pydantic v2, SQLAlchemy 2 (async) | High-performance typed API layer |
| Database | PostgreSQL + Alembic | Relational storage + migrations |
| Queue/Cache | Redis + Celery | Task brokering, caching, timers, locks |
| AI | LangChain Core, LangGraph, OpenAI/OpenRouter | Generation and evaluation pipelines |
| Parsing/OCR | pdfplumber, PyMuPDF, python-docx, python-pptx, pytesseract, Pillow | Multi-format content extraction |
| Auth/Security | python-jose, passlib(argon2), Authlib | JWT + OAuth + secure password handling |
| Observability | structlog, response timing headers, Vercel Analytics/Speed Insights | Runtime visibility and performance tracking |
| Media | Cloudinary | Avatar storage and transformation |

---

## ⚙️ Installation & Setup

### Prerequisites

- Python **3.11+**
- Node.js **20+**
- PostgreSQL **15+**
- Redis **7+**
- (Optional) Tesseract OCR binary for scanned documents/images

### 1) Clone

```bash
git clone https://github.com/dipanshuchoudhary-data/Quizzer.git
cd Quizzer
```

### 2) Backend setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp backend/.env.example .env
# edit .env

alembic upgrade head
```

### 3) Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
# edit .env.local
cd ..
```

### 4) Run services

```bash
# Backend API (from repo root)
python -m backend.run_api
# or: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Frontend (from repo root)
npm --prefix frontend run dev
```

```bash
# Worker (optional when USE_CELERY=true)
celery -A backend.workers.celery_app worker --loglevel=info
```

### 5) Environment configuration

#### Root `.env` (backend)

```bash
APP_ENV=local
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
CORS_ALLOW_ORIGINS=http://localhost:3000

POSTGRES_DSN=******localhost:5432/quizzer
REDIS_URL=redis://localhost:6379

JWT_SECRET_KEY=change-me
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

LLM_PROVIDER=openrouter
LLM_MODEL=openai/gpt-4o-mini
LLM_API_KEY=your-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

USE_CELERY=false
```

#### `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_AUTH_URL=http://localhost:8000/login/google
```

---

## 🔄 End-to-End Usage Flow

1. **Create quiz shell** (title/description, optional cluster assignment)  
2. **Ingest source content** (paste, links, or files)  
3. **Configure generation strategy** (auto/guided/custom blueprint)  
4. **Run AI generation** (async job or stream mode)  
5. **Review + approve** questions (filters, bulk actions, focus mode)  
6. **Publish** and distribute the public exam link  
7. **Students attempt exam** with guarded runtime + autosave + heartbeat  
8. **Submit + grade** (objective scoring + AI short-answer evaluation)  
9. **Analyze** outcomes in dashboard/results and export reports

---

## ⚡ Performance & Optimization Highlights

| Optimization Lever | Implementation | Operational Benefit |
|---|---|---|
| Async-first API | FastAPI + async SQLAlchemy | Better concurrent request handling |
| Background processing | Celery task pipeline | Keeps API responsive under heavy generation/evaluation load |
| Redis timer authority | TTL-based countdown | Prevents client-side timer tampering |
| Redis cache on dashboard | Summary/live/analytics endpoint caching | Faster repeated dashboard loads |
| Virtualized review list | `@tanstack/react-virtual` | Smooth moderation at large question counts |
| Progressive ingestion/generation status | job metadata + polling/streaming | Higher UX confidence during long-running tasks |
| Debounced autosave + periodic flush | client hooks + answer endpoints | Reduced data-loss risk during exam attempts |

---

## 🛣️ Roadmap

- [x] Google OAuth onboarding/login
- [x] Streaming AI generation pathway
- [x] Notification inbox + broadcast system
- [x] Advanced review UX (focus mode + virtualization + bulk actions)
- [ ] Real-time push transport for monitoring/events (beyond polling)
- [ ] LMS integrations (Canvas, Moodle, Classroom)
- [ ] Scheduled exam windows and richer proctoring integrations
- [ ] Expanded analytics benchmarking across cohorts
- [ ] Mobile-first exam UI optimization

---

## 🤝 Contribution Guidelines

1. Fork the repository
2. Create a feature branch: `feature/<name>`
3. Keep changes scoped and production-quality
4. Run relevant checks before PR:
   - `npm --prefix frontend run lint`
   - backend tests (`pytest`) where applicable
5. Open a clear PR with:
   - problem addressed
   - implementation summary
   - screenshots/GIFs for UI changes
   - migration/env notes if needed

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <strong>Quizzer</strong> — built for high-trust, AI-accelerated assessments at scale.
</div>

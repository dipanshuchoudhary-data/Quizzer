# Architecture Overview

## System Components

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

## Request Flow

### Quiz Generation (async)

1. Client uploads document or submits text/URL via `/api/quizzes`.
2. FastAPI enqueues a **Celery task** and returns a job ID immediately.
3. The Celery worker:
   - Extracts text (OCR for images/scanned PDFs via Tesseract; direct parsing for DOCX/PPTX/Excel).
   - Runs the **LangGraph pipeline**: Summarize → Enhance Prompt → Generate Questions → Fill Answer Keys.
   - Persists questions to PostgreSQL.
   - Updates `AIJob` status in the DB.
4. Client polls the job status endpoint or receives a WebSocket push when the quiz is ready.

### Exam Session

1. Student starts an attempt → FastAPI creates an `Attempt` record and arms a server-side Redis timer.
2. Security guards (fullscreen, tab-switch, paste detection) run entirely in the browser and report violations to the backend via WebSocket.
3. Answers are auto-saved; the server-authoritative timer enforces the deadline.
4. On submission, a Celery task scores objective questions and evaluates short answers using the LLM.

### Real-Time Monitoring

- Administrators subscribe to a room via Socket.IO.
- The backend pushes live attempt state (status, violations, remaining time) to the room as events occur.

## Key Directories

| Path | Responsibility |
|------|---------------|
| `backend/api/` | FastAPI route handlers |
| `backend/services/` | Business logic (grading, export, email) |
| `backend/workers/` | Celery tasks + LangGraph orchestration |
| `backend/ai/` | LangGraph graphs, LLM agent definitions, AI schemas |
| `backend/models/` | SQLAlchemy ORM models |
| `backend/core/` | Settings, DB session, Redis, LLM client, security utils |
| `backend/alembic/` | Database migrations |
| `frontend/src/app/` | Next.js App Router pages and layouts |
| `frontend/src/features/` | Feature modules (quiz, dashboard, account) |
| `frontend/src/components/` | Shared UI components (shadcn/ui based) |
| `frontend/src/security/` | Client-side exam integrity guards |
| `frontend/src/store/` | Zustand state management |

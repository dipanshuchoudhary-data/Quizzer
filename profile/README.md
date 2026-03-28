<div align="center">

# Dipanshu Choudhary

### AI/ML Engineer · Agentic AI Builder · Full-Stack Developer

I build AI systems that go beyond demos — production-grade pipelines, multi-agent workflows, and LLM applications that solve real problems at scale.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/your-linkedin)
[![Email](https://img.shields.io/badge/Email-EA4335?style=flat&logo=gmail&logoColor=white)](mailto:your-email@example.com)
[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=flat&logo=vercel&logoColor=white)](https://your-portfolio.dev)

</div>

---

## About Me

I specialize in building AI-native applications — from LangGraph-orchestrated agentic pipelines to RAG systems that make large knowledge bases actually useful. My work sits at the intersection of software engineering discipline and applied ML: I care as much about system reliability and clean architecture as I do about model quality.

Currently focused on:

- **Agentic AI systems** — multi-agent architectures, tool-calling, and autonomous task execution
- **LLM applications** — RAG, structured output, prompt engineering, and LLM evaluation
- **Production AI backends** — async APIs, background job pipelines, and scalable inference infrastructure

---

## Tech Stack

**Languages**

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![SQL](https://img.shields.io/badge/SQL-4479A1?style=flat&logo=postgresql&logoColor=white)

**AI / LLM**

![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat&logo=chainlink&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-FF6B35?style=flat)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21F?style=flat&logo=huggingface&logoColor=black)
![RAG](https://img.shields.io/badge/RAG-Retrieval_Augmented_Generation-6366f1?style=flat)

**Frameworks & Backend**

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=flat&logo=celery&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat)

**Infrastructure & Data**

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat&logo=amazon-aws&logoColor=white)

---

## Featured Projects

### [Quizzer](https://github.com/dipanshuchoudhary-data/Quizzer) — AI-Powered Assessment Platform

**Problem:** Educators spend hours writing structured assessments. Quizzer eliminates that bottleneck by generating complete, multi-type exams from any source material in under a minute.

**How it works:**
- LangGraph state machine runs a 4-agent pipeline: Summarize → Enhance Prompt → Generate Questions → Fill Answer Keys
- Supports PDF, DOCX, PPTX, Excel, images (OCR), and plain URLs as input
- Secure exam environment with server-authoritative timer, tab-switch detection, and session locking
- AI-powered short answer evaluation at submission time
- Real-time exam monitoring dashboard for administrators

**Stack:** FastAPI · LangGraph · LangChain · Next.js 14 · PostgreSQL · Redis · Celery · Tailwind CSS  
**Impact:** End-to-end assessment workflow — from AI generation to proctored delivery to auto-graded results

---

### AgentOS — Autonomous Multi-Agent Task Runner *(In Progress)*

**Problem:** LLM assistants are stateless and single-turn. Real work requires agents that plan, use tools, delegate subtasks, and self-correct across multiple steps.

**How it works:**
- Supervisor agent breaks down high-level goals into subtasks and routes them to specialized sub-agents (researcher, coder, critic, writer)
- Tool-calling layer integrates web search, code execution, and file I/O
- Persistent memory store so agents retain context across sessions
- Human-in-the-loop checkpoints for validation at critical decision nodes

**Stack:** LangGraph · LangChain · OpenAI · FastAPI · Redis · PostgreSQL  
**Impact:** Reduces manual orchestration overhead for complex, multi-step AI workflows

---

### DocuMind — Enterprise RAG System

**Problem:** Organizations have thousands of internal documents but no reliable way to query them. Generic chatbots hallucinate; keyword search misses context.

**How it works:**
- Ingestion pipeline chunks, embeds, and indexes documents with metadata-aware filtering
- Hybrid retrieval: dense vector search + BM25 keyword search, re-ranked by a cross-encoder
- Query rewriting and hypothetical document embedding (HyDE) improve recall on vague queries
- Citations with source attribution on every answer — no hallucination without accountability
- REST API with streaming responses and conversation history

**Stack:** LangChain · OpenAI · FAISS / Pinecone · FastAPI · PostgreSQL · Celery  
**Impact:** Accurate, auditable Q&A over private knowledge bases — deployable on-premise or cloud

---

### LLM Eval Bench — Automated LLM Evaluation Framework

**Problem:** Prompts break silently. Model updates change behavior. There is no reliable way to catch regressions in LLM-based features without manual review.

**How it works:**
- Define test cases as YAML: input, expected output, evaluation criteria
- Evaluators: exact match, semantic similarity (embedding cosine), LLM-as-judge, regex
- CI-compatible — run as part of GitHub Actions on every model or prompt change
- Aggregated metrics dashboard: pass rate, latency, token cost per test suite

**Stack:** Python · LangChain · OpenAI · pytest · YAML · GitHub Actions  
**Impact:** Catches prompt regressions before they reach production; enables confident model upgrades

---

## GitHub Stats

<div align="center">

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=dipanshuchoudhary-data&show_icons=true&theme=github_dark&hide_border=true&count_private=true)

![GitHub Streak](https://streak-stats.demolab.com?user=dipanshuchoudhary-data&theme=github-dark-blue&hide_border=true)

![Top Languages](https://github-readme-stats.vercel.app/api/top-langs/?username=dipanshuchoudhary-data&layout=compact&theme=github_dark&hide_border=true&langs_count=8)

</div>

---

## Contact

I am open to discussing AI/ML engineering roles, technical collaborations, and interesting problem spaces.

- **LinkedIn:** [linkedin.com/in/your-linkedin](https://linkedin.com/in/your-linkedin)
- **Email:** [your-email@example.com](mailto:your-email@example.com)
- **Portfolio:** [your-portfolio.dev](https://your-portfolio.dev)

---

<div align="center">
<sub>Always building. Always iterating.</sub>
</div>

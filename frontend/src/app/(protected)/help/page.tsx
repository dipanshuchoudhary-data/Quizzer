"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import axios from "axios"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { feedbackApi } from "@/lib/api/feedback"
import { useAuthStore } from "@/stores/useAuthStore"

const generalQuestions = [
  {
    question: "Why does Auto mode sometimes generate fewer questions than my source file?",
    answer:
      "In Source-first Auto mode, the system tries to preserve valid, parseable questions from extracted content. If some source items are incomplete, duplicated, or ambiguous, they can be excluded to keep output quality and review safety high.",
  },
  {
    question: "What is the practical difference between Source-first, Guided, and Custom Structure?",
    answer:
      "Source-first prioritizes source fidelity and detected type mix. Guided lets you set target count and allowed types quickly. Custom Structure gives section-level control (counts, marks, and types) for strict exam design.",
  },
  {
    question: "When should I use Guided instead of Source-first?",
    answer:
      "Use Guided when you need predictable output size (for example exactly 30 questions) or want to force only specific types regardless of source diversity.",
  },
  {
    question: "Why does the workflow resume after refresh instead of restarting?",
    answer:
      "The create flow persists in-progress state so refreshes do not lose work during ingestion, processing, or review. This includes the active step and job context while generation is running.",
  },
  {
    question: "How do I start a truly fresh quiz if an older draft is still remembered?",
    answer:
      "Use Create Quiz from the top bar. It opens a fresh flow and clears prior create-draft state for a new authoring session.",
  },
  {
    question: "What exactly counts as a violation during an exam attempt?",
    answer:
      "Violations can include tab switch, window blur, fullscreen exit, paste attempt, large text insert, and other guarded actions depending on quiz security settings.",
  },
  {
    question: "How are violation events measured and prevented from overcounting?",
    answer:
      "Violation reporting is throttled per violation type (2.5 seconds) before sending to backend. This avoids inflated counts from rapid repeated events (for example multiple blur events in a moment).",
  },
  {
    question: "What does Violation Limit do in quiz settings?",
    answer:
      "Violation Limit sets the maximum integrity threshold for that quiz before escalation behavior. Students also see this threshold at exam start so rules are transparent.",
  },
  {
    question: "How does autosave work during an exam?",
    answer:
      "Answers are continuously queued and synced while you attempt questions. The UI also shows pending sync count so students and invigilators can detect temporary network instability.",
  },
  {
    question: "Why can’t I publish immediately after AI generation in some cases?",
    answer:
      "Publishing depends on review readiness: generated questions must pass validation and approval flow. Workspace-level strict publishing checks can enforce stronger publish gates.",
  },
]

export default function HelpPage() {
  const accountEmail = useAuthStore((state) => state.user?.email?.trim().toLowerCase() ?? "")
  const needsContactEmail = !accountEmail
  const [contactEmail, setContactEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [contactError, setContactError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const quickLinks = [
    { label: "Create AI Quiz", href: "/quizzes/create", description: "Start a new AI quiz workflow with source ingestion and review." },
    { label: "Exam Settings", href: "/settings", description: "Configure security, attempt policy, and scoring behavior." },
    { label: "Monitoring", href: "/monitoring", description: "Track live attempts and integrity events in one place." },
    { label: "Results", href: "/results", description: "Review attempt outcomes and student performance trends." },
  ]
  const contactWords = useMemo(
    () =>
      message
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [message]
  )

  const handleContactSend = async () => {
    const normalizedEmail = contactEmail.trim().toLowerCase()
    const normalizedSubject = subject.trim()
    const normalizedMessage = message.trim()
    const contactAddress = normalizedEmail || accountEmail

    if (!contactAddress || !contactAddress.includes("@")) {
      setContactError("Please enter a valid email.")
      return
    }
    if (needsContactEmail && !normalizedEmail) {
      setContactError("Please enter your email before sending.")
      return
    }
    if (!normalizedSubject) {
      setContactError("Please add a subject.")
      return
    }
    if (!normalizedMessage) {
      setContactError("Please enter your message.")
      return
    }
    if (contactWords > 500) {
      setContactError("Message must be 500 words or fewer.")
      return
    }

    setContactError("")
    setIsSending(true)
    try {
      const payload = {
        subject: normalizedSubject,
        message: normalizedMessage,
        ...(normalizedEmail ? { contact_email: normalizedEmail } : {}),
      }
      await feedbackApi.submit({
        ...payload,
      })
      toast.success("Your message was sent successfully. You will receive a response in very short time.")
      setContactEmail("")
      setSubject("")
      setMessage("")
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error)
        ? ((error.response?.data as { detail?: string } | undefined)?.detail ?? "Unable to send message right now.")
        : "Unable to send message right now."
      setContactError(detail)
      toast.error(detail)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Help & Documentation</h1>
        <p className="text-sm text-muted-foreground">Guides and support resources for quiz authoring and operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Create quizzes, review generated questions, and publish exams.</p>
            <Link href="/dashboard">
              <Button variant="outline">Open Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account & Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Manage profile, notifications, and workspace defaults.</p>
            <Link href="/account/settings">
              <Button variant="outline">Open Account Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send your query directly to support. Messages are routed to <span className="font-medium text-foreground">dipanshuchoudhary109@gmail.com</span>.
          </p>
          {needsContactEmail ? (
            <p className="text-xs text-muted-foreground">Your account has no saved email, so email is required before sending.</p>
          ) : (
            <p className="text-xs text-muted-foreground">We will use your account email: <span className="font-medium text-foreground">{accountEmail}</span></p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">Prefer your own email app?</p>
            <a
              href="mailto:dipanshuchoudhary109@gmail.com?subject=Quizzer%20Support%20Request"
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Email directly
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {needsContactEmail ? (
              <Input
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="Your email"
                type="email"
              />
            ) : null}
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          </div>
          <Textarea
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your issue or request in detail."
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={contactError ? "text-destructive" : "text-muted-foreground"}>
              {contactError || `Required fields: ${needsContactEmail ? "email, " : ""}subject, message (max 500 words).`}
            </span>
            <span className={contactWords > 500 ? "font-medium text-destructive" : "text-muted-foreground"}>{contactWords}/500 words</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleContactSend} disabled={isSending}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational Guides</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">AI Workflow Reliability</p>
            <p className="mt-1 text-xs text-muted-foreground">Use Source-first for source fidelity, Guided for fixed count/types, and Custom for strict section plans.</p>
          </div>
          <div className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">Security Enforcement</p>
            <p className="mt-1 text-xs text-muted-foreground">Violation limit, fullscreen, tab switching, and paste controls are per-quiz and visible to students before start.</p>
          </div>
          <div className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">Publish Readiness</p>
            <p className="mt-1 text-xs text-muted-foreground">Review and approval status affect publish eligibility, especially when strict publish checks are enabled.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border bg-background/70 p-4 transition-colors hover:bg-muted/40">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {generalQuestions.map((item, index) => (
            <details key={item.question} className="rounded-xl border bg-background/70 px-4 py-3">
              <summary className="cursor-pointer list-none pr-3 text-sm font-semibold text-foreground">
                {index + 1}. {item.question}
              </summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

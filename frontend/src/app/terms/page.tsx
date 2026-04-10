import Link from "next/link"

const sections = [
  {
    title: "Acceptance of terms",
    body:
      "By accessing or using Quizzer, you agree to these Terms of Service and to the platform rules, policies, and operational notices that apply to your use of the service.",
  },
  {
    title: "Accounts and access",
    body:
      "You are responsible for maintaining accurate account details, protecting your login credentials, and ensuring your use of the service complies with applicable laws, school or organizational policies, and these terms.",
  },
  {
    title: "Permitted use",
    body:
      "Quizzer may be used to create, manage, publish, and complete quizzes, assessments, and related educational workflows. You may not misuse the platform, interfere with security features, scrape restricted data, or attempt unauthorized access to other users or systems.",
  },
  {
    title: "User content",
    body:
      "You retain responsibility for the content you upload, author, or distribute through Quizzer, including quiz material, documents, responses, and feedback. You represent that you have the rights needed to use that content with the platform.",
  },
  {
    title: "Service availability",
    body:
      "We work to keep Quizzer available and reliable, but the service may change, be interrupted, or be updated without notice. Features may be added, modified, limited, or discontinued to improve safety, compliance, or product quality.",
  },
  {
    title: "Limitation of liability",
    body:
      "To the extent permitted by law, Quizzer is provided on an as-available basis and we are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.",
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(15,23,42,0.08),transparent_30%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_100%)] px-6 py-12 text-slate-900 dark:bg-[radial-gradient(circle_at_top_right,_rgba(148,163,184,0.12),transparent_30%),linear-gradient(180deg,#101827_0%,#081018_100%)] dark:text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="rounded-[32px] border border-slate-200/80 bg-white/90 px-8 py-10 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700 dark:text-amber-300">
            Quizzer Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-[var(--text-secondary)]">
            These terms govern access to Quizzer and describe the basic rules for accounts, platform use, content, and
            service operation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-[var(--text-secondary)]">
            <span>Effective date: April 8, 2026</span>
            <span>Last updated: April 8, 2026</span>
          </div>
        </header>

        <section className="grid gap-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-3xl border border-slate-200/80 bg-white/95 px-7 py-6 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]"
            >
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-[var(--text-secondary)]">{section.body}</p>
            </article>
          ))}
        </section>

        <footer className="rounded-3xl border border-slate-200/80 bg-white/90 px-7 py-6 text-sm text-slate-600 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)] dark:text-[var(--text-secondary)]">
          <p>
            Continued use of Quizzer means you agree to these terms and any future updates published on this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/privacy" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 dark:text-slate-100">
              Privacy Policy
            </Link>
            <Link href="/login" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 dark:text-slate-100">
              Back to login
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}

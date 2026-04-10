import Link from "next/link"

const sections = [
  {
    title: "Information we collect",
    body:
      "Quizzer collects the information needed to create accounts, deliver quizzes, authenticate users, and support the platform. This can include profile details, email addresses, course and quiz content, submission data, device and browser metadata, and support communications.",
  },
  {
    title: "How we use information",
    body:
      "We use information to operate the product, secure accounts, personalize the experience, process quiz attempts, generate analytics, respond to support requests, and improve system reliability and performance.",
  },
  {
    title: "Authentication and integrations",
    body:
      "If you sign in with Google, Quizzer receives the identity data required to authenticate your account, such as your name, email address, and profile metadata permitted by Google. We use that data only to sign you in, create or link your account, and maintain session security.",
  },
  {
    title: "Cookies and sessions",
    body:
      "Quizzer uses secure cookies and session technologies to keep you signed in, protect authentication flows, remember security state, and support essential product features. These are used for platform operation rather than third-party advertising.",
  },
  {
    title: "Data sharing",
    body:
      "Quizzer does not sell personal information. We may share data with infrastructure, analytics, storage, email, and authentication providers only as needed to run the service, comply with law, protect users, or enforce platform integrity.",
  },
  {
    title: "Data retention and security",
    body:
      "We retain information for as long as it is reasonably needed to provide the service, satisfy legal obligations, resolve disputes, and enforce our agreements. We use technical and organizational safeguards to reduce unauthorized access, disclosure, or misuse.",
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef6f0_100%)] px-6 py-12 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.12),transparent_35%),linear-gradient(180deg,#07130c_0%,#0b1720_100%)] dark:text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="rounded-[32px] border border-slate-200/80 bg-white/90 px-8 py-10 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-[var(--brand-accent)]">
            Quizzer Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-[var(--text-secondary)]">
            This policy explains what information Quizzer collects, how it is used, and how we handle data when you
            use the platform, including Google sign-in and assessment workflows.
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
            Questions about this policy can be directed through the Quizzer support channels made available inside the
            product.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/terms" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 dark:text-slate-100">
              Terms of Service
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

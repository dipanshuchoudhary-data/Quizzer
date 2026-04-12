"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { UseFormRegister } from "react-hook-form"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Mail } from "lucide-react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiErrorMessage } from "@/lib/api/error"
import { getPostAuthRoute } from "@/lib/auth"
import { env } from "@/lib/env"
import { useAuthStore } from "@/stores/useAuthStore"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_oauth_failed: "Google sign-in failed. Please try again.",
  google_oauth_session_missing: "Session expired during Google sign-in. Please try again.",
  google_token_invalid: "Google token was invalid or expired. Please try again.",
  google_token_issuer_invalid: "Google sign-in response was invalid. Please try again.",
  google_token_audience_invalid: "Google sign-in is not configured for this app yet. Please contact support.",
  google_token_nonce_mismatch: "Google sign-in session mismatch. Clear browser cookies and try again.",
  google_token_expired: "Google sign-in token expired. Please try again.",
  google_token_signature_invalid: "Google token signature was invalid. Please try again.",
  google_email_missing: "Google account email is missing. Please choose a different account.",
  google_email_unverified: "Your Google email is not verified. Verify it in Google account settings and try again.",
  google_account_invalid: "Google account details could not be verified. Please try again.",
}

type LoginValues = z.infer<typeof loginSchema>

interface LoginFieldProps {
  label: string
  name: keyof LoginValues
  type?: string
  placeholder: string
  error?: string
  register: UseFormRegister<LoginValues>
  rightElement?: ReactNode
}

function LoginField({ label, name, type = "text", placeholder, error, register, rightElement }: LoginFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      <div className="relative">
        <Input
          type={type}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="h-12 rounded-2xl border-border bg-background/80 px-4 text-[15px] shadow-inner shadow-slate-200/30 placeholder:text-muted-foreground focus-visible:border-[var(--brand-accent)] focus-visible:ring-[var(--brand-accent)]/25 dark:shadow-black/20"
          {...register(name)}
        />
        {rightElement}
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </label>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    const errorCode = searchParams.get("error")
    if (!errorCode) return
    const message = GOOGLE_AUTH_ERROR_MESSAGES[errorCode] ?? "Google sign-in could not be completed. Please try again."
    toast.error(message)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("error")
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/login?${nextQuery}` : "/login")
  }, [router, searchParams])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const handleEmailLogin = useCallback(
    async (values: LoginValues) => {
      try {
        const user = await login(values.email, values.password)
        router.replace(getPostAuthRoute(user))
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Login failed"))
      }
    },
    [login, router]
  )

  const handleGoogleLogin = useCallback(() => {
    setIsGoogleLoading(true)
    window.location.href = `${env.backendOrigin}/login/google`
  }, [])

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in and pick up where you left off."
      description="Open your quiz workspace, manage live exams, and keep every assessment moving."
      footer={
        <>
          New to Quizzer?{" "}
          <Link href="/signup" className="font-bold text-[var(--brand-accent)] underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(handleEmailLogin)} className="space-y-5">
        <LoginField
          label="Email address"
          name="email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          register={register}
        />

        <LoginField
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          error={errors.password?.message}
          register={register}
          rightElement={
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/30"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <Button
          className="h-12 w-full rounded-2xl bg-[var(--brand-accent)] text-base font-bold text-white shadow-[0_16px_35px_rgba(34,197,94,0.28)] hover:bg-green-600 dark:text-black dark:hover:bg-green-300"
          type="submit"
          disabled={isSubmitting || isGoogleLoading}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              Signing in...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Sign in with email
            </>
          )}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-2xl border-border bg-background/80 text-base font-bold text-foreground hover:bg-muted"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading || isSubmitting}
      >
        {isGoogleLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Redirecting...
          </>
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </Button>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

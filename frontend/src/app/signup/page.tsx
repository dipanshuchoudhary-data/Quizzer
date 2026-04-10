"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import type { UseFormRegister } from "react-hook-form"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiErrorMessage } from "@/lib/api/error"
import { userApi } from "@/lib/api/user"
import { env } from "@/lib/env"

const signupSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  institution: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
})

type SignupValues = z.infer<typeof signupSchema>

interface SignupFieldProps {
  label: string
  name: keyof SignupValues
  type?: string
  placeholder: string
  error?: string
  register: UseFormRegister<SignupValues>
  rightElement?: ReactNode
}

function signupStrength(password: string): { label: "Weak" | "Medium" | "Strong"; className: string; width: string } {
  if (password.length < 8) return { label: "Weak", className: "bg-[#d45d45]", width: "33%" }
  const checks = [/[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
  const score = checks.filter(Boolean).length
  if (score >= 3 && password.length >= 10) return { label: "Strong", className: "bg-[#2f7a52]", width: "100%" }
  return { label: "Medium", className: "bg-[#d89135]", width: "66%" }
}

function SignupField({ label, name, type = "text", placeholder, error, register, rightElement }: SignupFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[#28382d]">{label}</span>
      <div className="relative">
        <Input
          type={type}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="h-12 rounded-2xl border-[#d8cfbd] bg-white/80 px-4 text-[15px] shadow-inner shadow-[#cabfaa]/20 placeholder:text-[#8c887d] focus-visible:border-[#214b3b] focus-visible:ring-[#214b3b]/20"
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

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      institution: "",
      country: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    },
  })

  const password = watch("password")
  const strength = useMemo(() => signupStrength(password || ""), [password])

  const onSubmit = async (values: SignupValues) => {
    try {
      const result = await userApi.register({
        ...values,
        institution: values.institution || undefined,
        country: values.country || undefined,
        timezone: values.timezone || undefined,
      })

      toast.success(result.message || "Account created")
      router.replace("/login")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Sign up failed"))
    }
  }

  const handleGoogleSignup = () => {
    setIsGoogleLoading(true)
    window.location.href = `${env.backendOrigin}/login/google`
  }

  return (
    <AuthShell
      eyebrow="Start teaching faster"
      title="Create your Quizzer account."
      description="Set up your teacher workspace and generate polished assessments from your own materials."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#214b3b] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <SignupField label="Full name" name="full_name" placeholder="Dr. Aisha Patel" error={errors.full_name?.message} register={register} />
        <SignupField label="Email address" name="email" type="email" placeholder="you@example.com" error={errors.email?.message} register={register} />

        <div className="space-y-2">
          <SignupField
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a secure password"
            error={errors.password?.message}
            register={register}
            rightElement={
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#667267] transition hover:bg-[#efe7d8] hover:text-[#214b3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#214b3b]/30"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5dccb]">
              <div className={`h-full rounded-full transition-all duration-300 ${strength.className}`} style={{ width: strength.width }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b746b]">{strength.label}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SignupField label="Institution" name="institution" placeholder="School or college" register={register} />
          <SignupField label="Country" name="country" placeholder="India" register={register} />
        </div>

        <SignupField label="Timezone" name="timezone" placeholder="Asia/Calcutta" register={register} />

        <Button
          className="h-12 w-full rounded-2xl bg-[#214b3b] text-base font-bold text-[#fffaf1] shadow-[0_16px_35px_rgba(33,75,59,0.28)] hover:bg-[#17382b]"
          type="submit"
          disabled={isSubmitting || isGoogleLoading}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create account
            </>
          )}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#d8cfbd]" />
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#7c7467]">or</span>
        <div className="h-px flex-1 bg-[#d8cfbd]" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-2xl border-[#d8cfbd] bg-white/70 text-base font-bold text-[#25342a] hover:bg-white"
        onClick={handleGoogleSignup}
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

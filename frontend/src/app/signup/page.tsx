"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { userApi } from "@/lib/api/user"
import { getApiErrorMessage } from "@/lib/api/error"
import { env } from "@/lib/env"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const signupSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  institution: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
})

type SignupValues = z.infer<typeof signupSchema>

function passwordStrength(password: string): "Weak" | "Medium" | "Strong" {
  if (password.length < 8) return "Weak"
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (score >= 3 && password.length >= 10) return "Strong"
  if (score >= 2) return "Medium"
  return "Weak"
}

export default function SignupPage() {
  const router = useRouter()
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
  const strength = useMemo(() => passwordStrength(password || ""), [password])

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-6 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create your Quizzer account</CardTitle>
          <CardDescription>Sign up as a professor to start building assessments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Input placeholder="Full name" {...register("full_name")} />
              {errors.full_name ? <p className="text-xs text-destructive">{errors.full_name.message}</p> : null}
            </div>

            <div className="space-y-1">
              <Input type="email" placeholder="Email" {...register("email")} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1">
              <Input type="password" placeholder="Password" {...register("password")} />
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
              <p className="text-xs text-muted-foreground">Strength: {strength}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Institution / school (optional)" {...register("institution")} />
              <Input placeholder="Country (optional)" {...register("country")} />
              <Input placeholder="Timezone (optional)" {...register("timezone")} />
            </div>

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <>
                <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                Redirecting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </>
            )}
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

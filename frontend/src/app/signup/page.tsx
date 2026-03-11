"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { userApi } from "@/lib/api/user"
import { getApiErrorMessage } from "@/lib/api/error"
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

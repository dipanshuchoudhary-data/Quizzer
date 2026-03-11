"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/useAuthStore"
import { getApiErrorMessage } from "@/lib/api/error"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const login = useAuthStore((state) => state.login)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onEmailLogin = async (values: LoginValues) => {
    try {
      const me = await login(values.email, values.password)
      router.replace(me.onboarding_completed ? "/dashboard" : "/onboarding")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Login failed"))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in with your email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onEmailLogin)} className="space-y-4">
            <div className="space-y-1">
              <Input placeholder="Email" type="email" {...register("email")} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            </div>

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Quizzer?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign up instead
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

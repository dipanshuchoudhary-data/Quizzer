"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { getPostAuthRoute } from "@/lib/auth"
import { useAuthStore } from "@/stores/useAuthStore"
import { getApiErrorMessage } from "@/lib/api/error"
import { env } from "@/lib/env"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginValues = z.infer<typeof loginSchema>

// Animated Question Mark Components
const FloatingQuestion = ({ delay, position }: { delay: number; position: "left" | "right" }) => (
  <div
    className={`absolute opacity-5 pointer-events-none text-6xl font-bold text-foreground animate-bounce
      ${position === "left" ? "left-8 top-1/4" : "right-8 bottom-1/4"}
    `}
    style={{ animationDelay: `${delay}s` }}
  >
    ?
  </div>
)

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

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
      router.replace(getPostAuthRoute(me))
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Login failed"))
    }
  }

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true)
    window.location.href = `${env.backendOrigin}/login/google`
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-tr from-background via-background to-background opacity-90" />

      {/* Floating Question Marks */}
      <FloatingQuestion delay={0} position="left" />
      <FloatingQuestion delay={0.5} position="right" />
      <FloatingQuestion delay={1} position="left" />
      <FloatingQuestion delay={1.5} position="right" />

      {/* Decorative Circles */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Main Card Container */}
      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="border border-foreground/10 shadow-2xl backdrop-blur-sm bg-card/90 hover:shadow-2xl transition-shadow duration-300">
          {/* Header with Icon */}
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Welcome back
                </CardTitle>
              </div>
            </div>
            <CardDescription className="text-sm sm:text-base">
              Sign in with your email and password to continue your quiz journey.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Email and Password Form */}
            <form onSubmit={handleSubmit(onEmailLogin)} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-100">
                <div className="relative">
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    className={`transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500
                      ${focusedField === "email" ? "ring-2 ring-blue-500 border-transparent" : ""}
                      ${errors.email ? "border-destructive" : ""}
                    `}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive font-medium animate-in fade-in">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-150">
                <div className="relative group">
                  <Input
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    className={`pr-10 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500
                      ${focusedField === "password" ? "ring-2 ring-blue-500 border-transparent" : ""}
                      ${errors.password ? "border-destructive" : ""}
                    `}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive font-medium animate-in fade-in">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Login Button */}
              <Button
                className="w-full h-11 mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8 animate-in fade-in duration-500 delay-300">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-foreground/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border border-foreground/20 hover:border-blue-600/50 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 transition-all duration-300 group shadow-md hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500 delay-400"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"></span>
                  <span>Redirecting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span>Google</span>
                </div>
              )}
            </Button>

            {/* Sign Up Link */}
            <p className="mt-6 text-center text-sm text-muted-foreground animate-in fade-in duration-500 delay-500">
              New to Quizzer?{" "}
              <Link
                href="/signup"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline-offset-4 hover:underline transition-colors duration-200"
              >
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Bottom decorative element */}
        <div className="mt-8 text-center text-xs text-muted-foreground/50 animate-in fade-in duration-700 delay-700">
          <p>Your secure quiz platform</p>
        </div>
      </div>

      {/* Additional decorative elements for larger screens */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.2); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

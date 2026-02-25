import "./globals.css"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { ToastProvider } from "@/components/providers/ToastProvider"
import { AuthProvider } from "@/components/providers/AuthProvider"
import { ThemeProvider } from "@/components/providers/ThemeProvider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <ToastProvider />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

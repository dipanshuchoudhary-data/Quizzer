import { CommandPalette } from "@/components/navigation/command-palette"
import { Sidebar } from "@/components/navigation/sidebar"
import { Topbar } from "@/components/navigation/topbar"
import { PageShell } from "@/components/navigation/page-shell"
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-app-shell className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_hsl(var(--muted))_0,_transparent_50%)] lg:flex-row">
      <div data-app-sidebar className="lg:shrink-0">
        <Sidebar />
      </div>
      <div data-app-content className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div data-app-topbar>
          <Topbar />
        </div>
        <main data-app-main className="flex-1">
          <PageShell>{children}</PageShell>
        </main>
      </div>
      <CommandPalette />
      <FeedbackWidget />
    </div>
  )
}


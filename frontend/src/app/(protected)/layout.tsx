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
    <div
      data-app-shell
      className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(245,158,11,0.1),transparent_38%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_100%)] lg:flex-row"
    >
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


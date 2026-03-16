import { CommandPalette } from "@/components/navigation/command-palette"
import { Sidebar } from "@/components/navigation/sidebar"
import { Topbar } from "@/components/navigation/topbar"
import { PageShell } from "@/components/navigation/page-shell"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--muted))_0,_transparent_50%)]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6">
          <PageShell>{children}</PageShell>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}


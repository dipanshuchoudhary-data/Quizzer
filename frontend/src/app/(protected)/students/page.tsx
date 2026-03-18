import Link from "next/link"
import { GraduationCap, ListChecks, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function StudentsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-sm text-muted-foreground">Manage learner activity and performance insights.</p>
      </div>
      <Card className="rounded-2xl border bg-card/80">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Users className="size-4" />
          </span>
          <CardTitle className="text-base">Student management is coming soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We are building learner-level analytics, cohort tracking, and detailed engagement views. In the meantime,
            use the workflows below to review activity.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/exams" className="rounded-2xl border bg-background/80 p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3">
                <GraduationCap className="size-4" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Open results</p>
                  <p className="text-xs text-muted-foreground">Choose an exam to review scores</p>
                </div>
              </div>
            </Link>
            <Link href="/exams" className="rounded-2xl border bg-background/80 p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3">
                <ListChecks className="size-4" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Monitor exams</p>
                  <p className="text-xs text-muted-foreground">Select a quiz to view live activity</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

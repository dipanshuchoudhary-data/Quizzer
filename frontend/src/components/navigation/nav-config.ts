import type { LucideIcon } from "lucide-react"
import { BarChart3, GraduationCap, LayoutDashboard, Settings, Users } from "lucide-react"

export type NavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  description?: string
  keywords?: string[]
}

export type NavSection = {
  id: string
  title: string
  items: NavItem[]
}

export type NavAction = {
  id: string
  label: string
  href?: string
  event?: string
  shortcut?: string
  description?: string
  keywords?: string[]
  icon: LucideIcon
  group: string
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    title: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Overview of activity and performance.",
        keywords: ["home", "overview", "summary"],
      },
      {
        id: "exams",
        label: "Exams",
        href: "/exams",
        icon: GraduationCap,
        description: "All quiz workspaces in one view.",
        keywords: ["exams", "workspace", "overview", "exam"],
      },
      {
        id: "students",
        label: "Students",
        href: "/students",
        icon: Users,
        description: "Learner rosters and insights.",
        keywords: ["roster", "learners", "class"],
      },
      {
        id: "analytics",
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Score trends and performance.",
        keywords: ["scores", "performance", "insights"],
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Workspace preferences.",
        keywords: ["preferences", "workspace"],
      },
    ],
  },
]

export const NAV_ACTIONS: NavAction[] = [
  {
    id: "create-quiz",
    label: "Create Quiz",
    href: "/quizzes/create",
    icon: GraduationCap,
    group: "Quick Actions",
    description: "Start a new quiz workspace.",
    keywords: ["create", "new", "quiz", "exam"],
    shortcut: "N",
  },
]

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

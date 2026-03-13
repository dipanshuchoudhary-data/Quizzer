"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FolderTree, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  CourseDefinition,
  loadCourseLibrary,
  saveCourseLibrary,
} from "@/features/quiz/organization/storage"

export default function CourseManagerPage() {
  const [courses, setCourses] = useState<CourseDefinition[]>([])
  const [newCourse, setNewCourse] = useState("")
  const [unitDrafts, setUnitDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setCourses(loadCourseLibrary())
  }, [])

  const totalUnits = useMemo(
    () => courses.reduce((sum, course) => sum + course.units.length, 0),
    [courses]
  )

  const persist = (next: CourseDefinition[]) => {
    setCourses(next)
    saveCourseLibrary(next)
  }

  const addCourse = () => {
    const name = newCourse.trim()
    if (!name) return
    if (courses.some((course) => course.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Course already exists")
      return
    }
    persist([...courses, { name, units: [] }])
    setNewCourse("")
    toast.success("Course created")
  }

  const removeCourse = (courseName: string) => {
    persist(courses.filter((course) => course.name !== courseName))
    toast.success("Course removed")
  }

  const addUnit = (courseName: string) => {
    const draft = (unitDrafts[courseName] ?? "").trim()
    if (!draft) return

    const next = courses.map((course) => {
      if (course.name !== courseName) return course
      if (course.units.some((unit) => unit.toLowerCase() === draft.toLowerCase())) return course
      return { ...course, units: [...course.units, draft] }
    })
    persist(next)
    setUnitDrafts((prev) => ({ ...prev, [courseName]: "" }))
    toast.success("Unit added")
  }

  const removeUnit = (courseName: string, unitName: string) => {
    const next = courses.map((course) => {
      if (course.name !== courseName) return course
      return { ...course, units: course.units.filter((unit) => unit !== unitName) }
    })
    persist(next)
  }

  return (
    <div className="space-y-5 pb-4">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-emerald-50 to-background p-5 shadow-sm dark:from-emerald-950/30 dark:to-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <FolderTree className="size-3.5" />
              Course Manager
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Courses and Units</h1>
            <p className="text-sm text-muted-foreground">Build your own structure for any discipline.</p>
          </div>
          <Link href="/quizzes">
            <Button variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              Back to Quizzes
            </Button>
          </Link>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Create Course</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Course name (e.g. Data Structures)"
            value={newCourse}
            onChange={(e) => setNewCourse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCourse()
              }
            }}
            className="max-w-md"
          />
          <Button onClick={addCourse}>
            <Plus className="mr-2 size-4" />
            Add Course
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">{courses.length} courses</span>
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">{totalUnits} units</span>
      </div>

      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-8 text-center">
            <p className="text-lg font-semibold">No courses yet</p>
            <p className="text-sm text-muted-foreground">Create your first course to start organizing quizzes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.name} className="border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">{course.name}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => removeCourse(course.name)} aria-label={`Delete ${course.name}`}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {course.units.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No units yet</span>
                  ) : (
                    course.units.map((unit) => (
                      <Badge key={unit} className="rounded-full border bg-background px-2.5 py-1 text-xs">
                        {unit}
                        <button
                          type="button"
                          className="ml-2 text-muted-foreground hover:text-foreground"
                          onClick={() => removeUnit(course.name, unit)}
                          aria-label={`Remove ${unit}`}
                        >
                          x
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add unit"
                    value={unitDrafts[course.name] ?? ""}
                    onChange={(e) => setUnitDrafts((prev) => ({ ...prev, [course.name]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addUnit(course.name)
                      }
                    }}
                  />
                  <Button variant="outline" onClick={() => addUnit(course.name)}>Add</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

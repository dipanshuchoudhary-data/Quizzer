"use client"

export interface QuizOrganization {
  course_name?: string
  unit_name?: string
  tags: string[]
}

export type QuizOrganizationMap = Record<string, QuizOrganization>

export interface CourseDefinition {
  name: string
  units: string[]
}

const QUIZ_ORG_KEY = "quizzer_quiz_organization_v1"
const COURSE_LIBRARY_KEY = "quizzer_course_library_v1"
const TAG_LIBRARY_KEY = "quizzer_tag_library_v1"

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function readFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  return safeParse(window.localStorage.getItem(key), fallback)
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function cleanToken(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  values.forEach((value) => {
    const token = cleanToken(value)
    if (!token) return
    const key = token.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(token)
  })
  return out
}

export function loadQuizOrganizationMap(): QuizOrganizationMap {
  return readFromStorage<QuizOrganizationMap>(QUIZ_ORG_KEY, {})
}

export function saveQuizOrganizationMap(value: QuizOrganizationMap) {
  const normalized: QuizOrganizationMap = {}
  Object.entries(value).forEach(([quizId, item]) => {
    const course = cleanToken(item.course_name ?? "")
    const unit = cleanToken(item.unit_name ?? "")
    normalized[quizId] = {
      course_name: course || undefined,
      unit_name: unit || undefined,
      tags: dedupeCaseInsensitive(item.tags ?? []),
    }
  })
  saveToStorage(QUIZ_ORG_KEY, normalized)
}

export function loadCourseLibrary(): CourseDefinition[] {
  const raw = readFromStorage<CourseDefinition[]>(COURSE_LIBRARY_KEY, [])
  return raw
    .map((course) => ({
      name: cleanToken(course.name),
      units: dedupeCaseInsensitive(course.units ?? []),
    }))
    .filter((course) => course.name.length > 0)
}

export function saveCourseLibrary(value: CourseDefinition[]) {
  const normalized = value
    .map((course) => ({
      name: cleanToken(course.name),
      units: dedupeCaseInsensitive(course.units ?? []),
    }))
    .filter((course) => course.name.length > 0)
  saveToStorage(COURSE_LIBRARY_KEY, normalized)
}

export function loadTagLibrary(): string[] {
  return dedupeCaseInsensitive(readFromStorage<string[]>(TAG_LIBRARY_KEY, []))
}

export function saveTagLibrary(value: string[]) {
  saveToStorage(TAG_LIBRARY_KEY, dedupeCaseInsensitive(value))
}

export function mergeCourseFromAssignment(
  existing: CourseDefinition[],
  courseName: string | undefined,
  unitName: string | undefined
): CourseDefinition[] {
  const next = [...existing]
  const course = cleanToken(courseName ?? "")
  const unit = cleanToken(unitName ?? "")
  if (!course) return next

  const index = next.findIndex((item) => item.name.toLowerCase() === course.toLowerCase())
  if (index === -1) {
    next.push({ name: course, units: unit ? [unit] : [] })
    return next
  }

  const mergedUnits = dedupeCaseInsensitive([...next[index].units, ...(unit ? [unit] : [])])
  next[index] = { ...next[index], name: next[index].name, units: mergedUnits }
  return next
}

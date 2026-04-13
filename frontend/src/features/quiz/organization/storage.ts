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

export interface CourseClusterOption {
  value: string
  label: string
  course_name: string
  unit_name?: string
}

const QUIZ_ORG_KEY = "quizzer_quiz_organization_v1"
const COURSE_LIBRARY_KEY = "quizzer_course_library_v1"
const TAG_LIBRARY_KEY = "quizzer_tag_library_v1"
const COURSE_CLUSTER_KEY_SEPARATOR = "__quizzer_cluster__"

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

export function makeCourseClusterValue(courseName: string, unitName?: string): string {
  const course = cleanToken(courseName)
  const unit = cleanToken(unitName ?? "")
  return `${course}${COURSE_CLUSTER_KEY_SEPARATOR}${unit}`
}

export function parseCourseClusterValue(value: string): { course_name: string; unit_name?: string } | null {
  if (!value) return null
  const [rawCourse, rawUnit = ""] = value.split(COURSE_CLUSTER_KEY_SEPARATOR)
  const course = cleanToken(rawCourse)
  const unit = cleanToken(rawUnit)
  if (!course) return null
  return {
    course_name: course,
    unit_name: unit || undefined,
  }
}

export function buildCourseClusterOptions(courses: CourseDefinition[]): CourseClusterOption[] {
  const options: CourseClusterOption[] = []
  courses.forEach((course) => {
    const courseName = cleanToken(course.name)
    if (!courseName) return
    if (!course.units.length) {
      options.push({
        value: makeCourseClusterValue(courseName),
        label: courseName,
        course_name: courseName,
      })
      return
    }
    course.units.forEach((unit) => {
      const unitName = cleanToken(unit)
      if (!unitName) return
      options.push({
        value: makeCourseClusterValue(courseName, unitName),
        label: `${courseName} • ${unitName}`,
        course_name: courseName,
        unit_name: unitName,
      })
    })
  })
  return options
}

export function assignQuizToCluster(quizId: string, cluster: { course_name: string; unit_name?: string } | null) {
  const current = loadQuizOrganizationMap()
  if (!cluster) {
    delete current[quizId]
    saveQuizOrganizationMap(current)
    return
  }
  current[quizId] = {
    ...current[quizId],
    course_name: cluster.course_name,
    unit_name: cluster.unit_name,
    tags: current[quizId]?.tags ?? [],
  }
  saveQuizOrganizationMap(current)
}

export function assignQuizzesToCluster(quizIds: string[], cluster: { course_name: string; unit_name?: string } | null) {
  const current = loadQuizOrganizationMap()
  quizIds.forEach((quizId) => {
    if (!cluster) {
      delete current[quizId]
      return
    }
    current[quizId] = {
      ...current[quizId],
      course_name: cluster.course_name,
      unit_name: cluster.unit_name,
      tags: current[quizId]?.tags ?? [],
    }
  })
  saveQuizOrganizationMap(current)
}

export interface User {
  id: string
  email: string
  full_name?: string
  display_name?: string
  username?: string
  phone_number?: string
  institution?: string
  country?: string
  timezone?: string
  subject_area?: string
  courses_taught?: string
  teaching_experience?: string
  avatar_url?: string
  avatar_thumbnail_url?: string
  is_verified?: boolean
  onboarding_completed?: boolean
  is_staff?: boolean
  is_active?: boolean
  role?: string
}

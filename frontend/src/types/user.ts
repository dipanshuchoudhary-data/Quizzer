export interface User {
  id: string
  email: string
  full_name?: string
  username?: string
  is_staff?: boolean
  is_active?: boolean
  role?: string
}

import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    accessToken?: string
    username?: string
    user_role?: string
    is_active?: boolean
    department_id?: string
    employee_id?: string
    department_name?: string
    department_code?: string
    edit_languages?: string[]
    review_languages?: string[]
    last_login_at?: string
    created_at?: string
    updated_at?: string
  }

  interface Session {
    user: {
      id: string
      username?: string
      email?: string
      user_role?: string
      is_active?: boolean
      department_id?: string
      employee_id?: string
      department_name?: string
      department_code?: string
      edit_languages?: string[]
      review_languages?: string[]
      last_login_at?: string
    } & DefaultSession["user"]
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    user?: {
      id: string
      username: string
      email: string
      user_role: string
      is_active: boolean
      department_id: string
      employee_id: string
      created_at: string
      updated_at: string
      last_login_at?: string
      department_name?: string
      department_code?: string
      edit_languages?: string[]
      review_languages?: string[]
    }
    authError?: string | null
  }
}
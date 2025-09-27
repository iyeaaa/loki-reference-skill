import { db } from '../db/index'
import {
  departments,
  users
} from '../db/schema/users'
import { eq, sql } from 'drizzle-orm'

// ====================================
// DEPARTMENT QUERIES
// ====================================

// GetDepartment :one
export async function getDepartment(id: string) {
  const result = await db
    .select()
    .from(departments)
    .where(eq(departments.id, id))
    .limit(1)

  return result[0]
}

// ListDepartments :many (Active departments only)
export async function listDepartments() {
  const result = await db
    .select()
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(sql`${departments.name} COLLATE "ko-KR-x-icu"`)

  return result
}

// ListAllDepartments :many (All departments)
export async function listAllDepartments() {
  const result = await db
    .select()
    .from(departments)
    .orderBy(sql`${departments.name} COLLATE "ko-KR-x-icu"`)

  return result
}

// CreateDepartment :one
export async function createDepartment(data: {
  name: string
  code: string
  description?: string
  isActive?: boolean
}) {
  const [newDepartment] = await db
    .insert(departments)
    .values({
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive ?? true
    })
    .returning()

  return newDepartment
}

// UpdateDepartment :one
export async function updateDepartment(
  id: string,
  data: {
    name: string
    code: string
    description?: string
    isActive: boolean
  }
) {
  const [updatedDepartment] = await db
    .update(departments)
    .set({
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive,
      updatedAt: new Date()
    })
    .where(eq(departments.id, id))
    .returning()

  return updatedDepartment
}

// DeleteDepartment :exec
export async function deleteDepartment(id: string) {
  await db.delete(departments).where(eq(departments.id, id))
}

// CountUsersByDepartment :one
export async function countUsersByDepartment(departmentId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.departmentId, departmentId))

  return result[0]?.count ?? 0
}
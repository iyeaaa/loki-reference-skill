import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { departments } from '../db/schema/users'

// List all departments
export async function listDepartments() {
  const result = await db.select().from(departments).orderBy(departments.name)
  return result
}

// Get department by ID
export async function getDepartment(id: string) {
  const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1)
  return result[0]
}

// Create department
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
      isActive: data.isActive ?? true,
    })
    .returning()
  return newDepartment
}

// Update department
export async function updateDepartment(
  id: string,
  data: {
    name: string
    code: string
    description?: string
    isActive?: boolean
  },
) {
  const [updatedDepartment] = await db
    .update(departments)
    .set({
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(departments.id, id))
    .returning()
  return updatedDepartment
}

// Delete department
export async function deleteDepartment(id: string) {
  const result = await db.delete(departments).where(eq(departments.id, id)).returning()
  return result.length > 0
}

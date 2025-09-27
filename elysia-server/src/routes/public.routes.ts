import { Elysia } from 'elysia'
import * as departmentService from '../services/departmentService'

export const publicRoutes = new Elysia({ prefix: '/api/v1/public' })
  // Get all active departments (no authentication required)
  .get('/departments', async () => {
    const departments = await departmentService.listDepartments()
    return {
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description
      }))
    }
  })
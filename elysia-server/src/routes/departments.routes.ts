import { Elysia, t } from 'elysia'
import * as departmentService from '../services/department.service'
import { errorResponse, ResponseCode } from '../types/response.types'

const departmentSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  code: t.String({ minLength: 1, maxLength: 20 }),
  description: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
})

export const departmentsRoutes = new Elysia({ prefix: '/api/v1/departments' })
  // List all departments
  .get('/', async () => {
    const departments = await departmentService.listDepartments()
    return departments
  })

  // Get department by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const department = await departmentService.getDepartment(id)
      if (!department) {
        set.status = 404
        return errorResponse('부서를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return department
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create new department
  .post(
    '/',
    async ({ body }) => {
      const department = await departmentService.createDepartment(body)
      return department
    },
    {
      body: departmentSchema,
    },
  )

  // Update department
  .put(
    '/:id',
    async ({ params: { id }, body, set }) => {
      const department = await departmentService.updateDepartment(id, body)
      if (!department) {
        set.status = 404
        return errorResponse('부서를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return department
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: departmentSchema,
    },
  )

  // Delete department
  .delete(
    '/:id',
    async ({ params: { id }, set }) => {
      const deleted = await departmentService.deleteDepartment(id)
      if (!deleted) {
        set.status = 404
        return errorResponse('부서를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return { success: true, message: '부서가 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

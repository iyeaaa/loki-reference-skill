import { Elysia, t } from 'elysia'
import * as userService from '../services/user.service'
import { errorResponse, ResponseCode } from '../types/response.types'

const userSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  email: t.String({ format: 'email', maxLength: 100 }),
  passwordHash: t.Optional(t.String({ maxLength: 255 })),
  userRole: t.Optional(t.Union([t.Literal('admin'), t.Literal('user')])),
  isActive: t.Optional(t.Boolean()),
  departmentId: t.String({ format: 'uuid' }),
  employeeId: t.String({ maxLength: 20 }),
})

const updateUserSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  email: t.String({ format: 'email', maxLength: 100 }),
  userRole: t.Union([t.Literal('admin'), t.Literal('user')]),
  isActive: t.Boolean(),
  departmentId: t.String({ format: 'uuid' }),
  employeeId: t.String({ maxLength: 20 }),
})

export const userRoutes = new Elysia({ prefix: '/api/v1/users' })
  // Search users with filters (must be before /:id route)
  .get(
    '/search',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      // Parse departmentIds from comma-separated string
      const departmentIds = query.departmentIds
        ? query.departmentIds.split(',').filter(Boolean)
        : undefined

      const filters = {
        role: query.role as any,
        isActive: query.isActive ? query.isActive === 'true' : undefined,
        search: query.search,
        departmentIds,
      }

      const users = await userService.listUsersWithFilters(limit, offset, filters)
      const total = await userService.countUsersWithFilters(filters)

      return {
        data: users,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        role: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String()),
        departmentIds: t.Optional(t.String()),
      }),
    },
  )

  // Get user by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const user = await userService.getUser(id)
      if (!user) {
        set.status = 404
        return errorResponse('사용자를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return user
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create new user
  .post(
    '/',
    async ({ body }) => {
      const user = await userService.createUser(body)
      return user
    },
    {
      body: userSchema,
    },
  )

  // Update user
  .put(
    '/:id',
    async ({ params: { id }, body, set }) => {
      const user = await userService.updateUser(id, body)
      if (!user) {
        set.status = 404
        return errorResponse('사용자를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return user
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: updateUserSchema,
    },
  )

  // Delete user
  .delete(
    '/:id',
    async ({ params: { id } }) => {
      await userService.deleteUser(id)
      return { success: true, message: '사용자가 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // List users with pagination
  .get(
    '/',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      const users = await userService.listUsers(limit, offset)
      const total = await userService.countUsers()

      return {
        data: users,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get user by email
  .get(
    '/email/:email',
    async ({ params: { email } }) => {
      const user = await userService.getUserByEmail(email)
      if (!user) {
        return { error: 'User not found' }
      }
      return user
    },
    {
      params: t.Object({
        email: t.String({ format: 'email' }),
      }),
    },
  )

  // Get assignable users (admin users only)
  .get('/assignable', async () => {
    const users = await userService.getAssignableUsers()
    return users
  })

  // Check if account exists
  .get(
    '/check/:email',
    async ({ params: { email } }) => {
      const exists = await userService.checkAccountExists(email)
      return { exists }
    },
    {
      params: t.Object({
        email: t.String({ format: 'email' }),
      }),
    },
  )

  // Update password
  .patch(
    '/:id/password',
    async ({ params: { id }, body, set }) => {
      const user = await userService.updateUserPassword(id, body.passwordHash)
      if (!user) {
        set.status = 404
        return errorResponse('사용자를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return user
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        passwordHash: t.String({ minLength: 1 }),
      }),
    },
  )

  // Create or update Google user
  .post(
    '/google',
    async ({ body }) => {
      const user = await userService.createOrUpdateGoogleUser(body)
      return user
    },
    {
      body: userSchema,
    },
  )

  // Update last login
  .patch(
    '/:id/login',
    async ({ params: { id } }) => {
      await userService.updateLastLogin(id)
      return { success: true }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

// Admin bulk update routes
export const adminUserRoutes = new Elysia({ prefix: '/api/v1/admin/users' })
  // Bulk update status
  .put(
    '/bulk/status',
    async ({ body }) => {
      const updatedCount = await userService.bulkUpdateStatus(body.userIds, body.isActive)
      return { updatedCount }
    },
    {
      body: t.Object({
        userIds: t.Array(t.String({ format: 'uuid' })),
        isActive: t.Boolean(),
      }),
    },
  )

  // Bulk update role
  .put(
    '/bulk/role',
    async ({ body }) => {
      const updatedCount = await userService.bulkUpdateRole(body.userIds, body.userRole)
      return { updatedCount }
    },
    {
      body: t.Object({
        userIds: t.Array(t.String({ format: 'uuid' })),
        userRole: t.Union([t.Literal('admin'), t.Literal('user')]),
      }),
    },
  )

  // Bulk update department
  .put(
    '/bulk/department',
    async ({ body }) => {
      const updatedCount = await userService.bulkUpdateDepartment(body.userIds, body.departmentId)
      return { updatedCount }
    },
    {
      body: t.Object({
        userIds: t.Array(t.String({ format: 'uuid' })),
        departmentId: t.String({ format: 'uuid' }),
      }),
    },
  )

import { Elysia, t } from 'elysia'
import * as userService from '../services/userService'
import * as departmentService from '../services/departmentService'

const userSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  email: t.String({ format: 'email', maxLength: 100 }),
  passwordHash: t.Optional(t.String({ maxLength: 255 })),
  userRole: t.Optional(t.Union([
    t.Literal('admin'),
    t.Literal('user')
  ])),
  isActive: t.Optional(t.Boolean()),
  departmentId: t.String({ format: 'uuid' }),
  employeeId: t.String({ maxLength: 20 })
})

const updateUserSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  email: t.String({ format: 'email', maxLength: 100 }),
  userRole: t.Union([
    t.Literal('admin'),
    t.Literal('user')
  ]),
  isActive: t.Boolean(),
  departmentId: t.String({ format: 'uuid' }),
  employeeId: t.String({ maxLength: 20 })
})

export const userRoutes = new Elysia({ prefix: '/users' })
  // Get user by ID
  .get('/:id', async ({ params: { id } }) => {
    const user = await userService.getUser(id)
    if (!user) {
      return { error: 'User not found' }
    }
    return user
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })

  // Create new user
  .post('/', async ({ body }) => {
    try {
      const user = await userService.createUser(body)
      return user
    } catch (error) {
      return { error: 'Failed to create user' }
    }
  }, {
    body: userSchema
  })

  // Update user
  .put('/:id', async ({ params: { id }, body }) => {
    try {
      const user = await userService.updateUser(id, body)
      if (!user) {
        return { error: 'User not found' }
      }
      return user
    } catch (error) {
      return { error: 'Failed to update user' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    }),
    body: updateUserSchema
  })

  // Delete user
  .delete('/:id', async ({ params: { id } }) => {
    try {
      await userService.deleteUser(id)
      return { success: true }
    } catch (error) {
      return { error: 'Failed to delete user' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })

  // List users with pagination
  .get('/', async ({ query }) => {
    const limit = parseInt(query.limit || '10')
    const offset = parseInt(query.offset || '0')

    const users = await userService.listUsers(limit, offset)
    const total = await userService.countUsers()

    return {
      data: users,
      total,
      limit,
      offset
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String())
    })
  })

  // Search users with filters
  .get('/search', async ({ query }) => {
    const limit = parseInt(query.limit || '10')
    const offset = parseInt(query.offset || '0')

    const filters = {
      role: query.role as any,
      isActive: query.isActive ? query.isActive === 'true' : undefined,
      search: query.search
    }

    const users = await userService.listUsersWithFilters(limit, offset, filters)
    const total = await userService.countUsersWithFilters(filters)

    return {
      data: users,
      total,
      limit,
      offset
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
      role: t.Optional(t.String()),
      isActive: t.Optional(t.String()),
      search: t.Optional(t.String())
    })
  })

  // Get user by email
  .get('/email/:email', async ({ params: { email } }) => {
    const user = await userService.getUserByEmail(email)
    if (!user) {
      return { error: 'User not found' }
    }
    return user
  }, {
    params: t.Object({
      email: t.String({ format: 'email' })
    })
  })

  // Get assignable users (admin users only)
  .get('/assignable', async () => {
    const users = await userService.getAssignableUsers()
    return users
  })

  // Check if account exists
  .get('/check/:email', async ({ params: { email } }) => {
    const exists = await userService.checkAccountExists(email)
    return { exists }
  }, {
    params: t.Object({
      email: t.String({ format: 'email' })
    })
  })

  // Update password
  .patch('/:id/password', async ({ params: { id }, body }) => {
    try {
      const user = await userService.updateUserPassword(id, body.passwordHash)
      if (!user) {
        return { error: 'User not found' }
      }
      return user
    } catch (error) {
      return { error: 'Failed to update password' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      passwordHash: t.String({ minLength: 1 })
    })
  })

  // Create or update Google user
  .post('/google', async ({ body }) => {
    try {
      const user = await userService.createOrUpdateGoogleUser(body)
      return user
    } catch (error) {
      return { error: 'Failed to create/update Google user' }
    }
  }, {
    body: userSchema
  })

  // Update last login
  .patch('/:id/login', async ({ params: { id } }) => {
    try {
      await userService.updateLastLogin(id)
      return { success: true }
    } catch (error) {
      return { error: 'Failed to update last login' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })

// Department routes
export const departmentRoutes = new Elysia({ prefix: '/departments' })
  // Get department by ID
  .get('/:id', async ({ params: { id } }) => {
    const department = await departmentService.getDepartment(id)
    if (!department) {
      return { error: 'Department not found' }
    }
    return department
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })

  // List active departments
  .get('/', async () => {
    const departments = await departmentService.listDepartments()
    return departments
  })

  // List all departments
  .get('/all', async () => {
    const departments = await departmentService.listAllDepartments()
    return departments
  })

  // Create department
  .post('/', async ({ body }) => {
    try {
      const department = await departmentService.createDepartment(body)
      return department
    } catch (error) {
      return { error: 'Failed to create department' }
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      code: t.String({ minLength: 1, maxLength: 20 }),
      description: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean())
    })
  })

  // Update department
  .put('/:id', async ({ params: { id }, body }) => {
    try {
      const department = await departmentService.updateDepartment(id, body)
      if (!department) {
        return { error: 'Department not found' }
      }
      return department
    } catch (error) {
      return { error: 'Failed to update department' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      code: t.String({ minLength: 1, maxLength: 20 }),
      description: t.Optional(t.String()),
      isActive: t.Boolean()
    })
  })

  // Delete department
  .delete('/:id', async ({ params: { id } }) => {
    try {
      await departmentService.deleteDepartment(id)
      return { success: true }
    } catch (error) {
      return { error: 'Failed to delete department' }
    }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })

  // Count users in department
  .get('/:id/users/count', async ({ params: { id } }) => {
    const count = await departmentService.countUsersByDepartment(id)
    return { count }
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  })
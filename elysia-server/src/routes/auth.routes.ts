import { Elysia, t } from 'elysia'
import * as userService from '../services/user.service'
import * as authService from '../services/auth.service'
import { UnauthorizedError, BadRequestError } from '../utils/errors'

const loginSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 })
})

const signupSchema = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 }),
  department_id: t.String({ format: 'uuid' }),
  employee_id: t.String({ minLength: 1, maxLength: 20 })
})

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  // Login endpoint
  .post('/login', async ({ body }) => {
    const { email, password } = body

    // Get user by email
    const user = await userService.getUserByEmail(email)
    if (!user) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('비활성화된 계정입니다. 관리자에게 문의하세요.')
    }

    // Verify password
    const isValidPassword = await authService.verifyPassword(password, user.passwordHash || '')
    if (!isValidPassword) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    // Update last login
    await userService.updateLastLogin(user.id)

    // Generate JWT token
    const token = await authService.generateToken({
      userId: user.id,
      email: user.email,
      userRole: user.userRole
    })

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        user_role: user.userRole,
        is_active: user.isActive,
        department_id: user.departmentId,
        employee_id: user.employeeId,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_login_at: user.lastLoginAt,
        department_name: user.departmentName,
        department_code: user.departmentCode
      }
    }
  }, {
    body: loginSchema
  })

  // Signup endpoint
  .post('/signup', async ({ body }) => {
    // Check if user already exists
    const existingUser = await userService.checkAccountExists(body.email)
    if (existingUser) {
      throw new BadRequestError('이미 등록된 이메일입니다.')
    }

    // Hash password
    const passwordHash = await authService.hashPassword(body.password)

    // Create user (default to inactive, needs admin approval)
    const newUser = await userService.createUser({
      username: body.username,
      email: body.email,
      passwordHash,
      userRole: 'user',
      isActive: false, // Needs admin approval
      departmentId: body.department_id,
      employeeId: body.employee_id
    })

    if (!newUser) {
      throw new BadRequestError('사용자 생성에 실패했습니다.')
    }

    return {
      message: '회원가입이 완료되었습니다. 관리자 승인 후 사용할 수 있습니다.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    }
  }, {
    body: signupSchema
  })

  // Verify token endpoint
  .post('/verify', async ({ headers }) => {
    const token = headers.authorization?.replace('Bearer ', '')
    if (!token) {
      throw new UnauthorizedError('인증 토큰이 없습니다.')
    }

    const payload = await authService.verifyToken(token)
    const user = await userService.getUser(payload.userId)

    if (!user) {
      throw new UnauthorizedError('유효하지 않은 토큰입니다.')
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        user_role: user.userRole,
        is_active: user.isActive,
        department_id: user.departmentId,
        employee_id: user.employeeId,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_login_at: user.lastLoginAt,
        department_name: user.departmentName,
        department_code: user.departmentCode
      }
    }
  })

  // Refresh token endpoint
  .post('/refresh', async ({ headers }) => {
    const token = headers.authorization?.replace('Bearer ', '')
    if (!token) {
      throw new UnauthorizedError('인증 토큰이 없습니다.')
    }

    const payload = await authService.verifyToken(token)
    const newToken = await authService.generateToken({
      userId: payload.userId,
      email: payload.email,
      userRole: payload.userRole
    })

    return {
      token: newToken
    }
  })

  // Admin check endpoint
  .get('/admin-check', async ({ headers }) => {
    const token = headers.authorization?.replace('Bearer ', '')
    if (!token) {
      throw new UnauthorizedError('인증 토큰이 없습니다.')
    }

    const payload = await authService.verifyToken(token)

    return {
      is_admin: payload.userRole === 'admin'
    }
  })
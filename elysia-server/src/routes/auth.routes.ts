import { Elysia, t } from "elysia"
import * as authService from "../services/auth.service"
import * as userService from "../services/user.service"
import { errorResponse, ResponseCode } from "../types/response.types"

const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
})

const signupSchema = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  departmentId: t.String({ format: "uuid" }),
  employeeId: t.String({ minLength: 1, maxLength: 20 }),
})

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  // Login endpoint
  .post(
    "/login",
    async ({ body, set }) => {
      const { email, password } = body

      // Get user by email
      const user = await userService.getUserByEmail(email)
      if (!user) {
        set.status = 401
        return errorResponse("이메일 또는 비밀번호가 올바르지 않습니다.", ResponseCode.UNAUTHORIZED)
      }

      // Check if user is active
      if (!user.isActive) {
        set.status = 401
        return errorResponse(
          "비활성화된 계정입니다. 관리자에게 문의하세요.",
          ResponseCode.UNAUTHORIZED,
        )
      }

      // Verify password
      const isValidPassword = await authService.verifyPassword(password, user.passwordHash || "")
      if (!isValidPassword) {
        set.status = 401
        return errorResponse("이메일 또는 비밀번호가 올바르지 않습니다.", ResponseCode.UNAUTHORIZED)
      }

      // Update last login
      await userService.updateLastLogin(user.id)

      // Generate JWT token
      const token = await authService.generateToken({
        userId: user.id,
        email: user.email,
        userRole: user.userRole,
      })

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          isActive: user.isActive,
          departmentId: user.departmentId,
          employeeId: user.employeeId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
          departmentName: user.departmentName,
          departmentCode: user.departmentCode,
        },
      }
    },
    {
      body: loginSchema,
    },
  )

  // Signup endpoint
  .post(
    "/signup",
    async ({ body, set }) => {
      try {
        // Check if user already exists
        const existingUser = await userService.checkAccountExists(body.email)
        if (existingUser) {
          set.status = 400
          return errorResponse("이미 등록된 이메일입니다.", ResponseCode.BAD_REQUEST)
        }

        // Hash password
        const passwordHash = await authService.hashPassword(body.password)

        // Create user (default to inactive, needs admin approval)
        const newUser = await userService.createUser({
          username: body.username,
          email: body.email,
          passwordHash,
          userRole: "user",
          isActive: false, // Needs admin approval
          departmentId: body.departmentId,
          employeeId: body.employeeId,
        })

        if (!newUser) {
          set.status = 400
          return errorResponse("사용자 생성에 실패했습니다.", ResponseCode.BAD_REQUEST)
        }

        return {
          message: "회원가입이 완료되었습니다. 관리자 승인 후 사용할 수 있습니다.",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
          },
        }
      } catch (error) {
        console.error("Signup error:", error)
        if (error instanceof Error) {
          // 더 구체적인 에러 메시지 제공
          if (error.message.includes("duplicate key value")) {
            set.status = 400
            if (error.message.includes("username")) {
              return errorResponse("이미 사용 중인 사용자명입니다.", ResponseCode.BAD_REQUEST)
            }
            if (error.message.includes("email")) {
              return errorResponse("이미 등록된 이메일입니다.", ResponseCode.BAD_REQUEST)
            }
            if (error.message.includes("employee_id")) {
              return errorResponse("이미 등록된 사원번호입니다.", ResponseCode.BAD_REQUEST)
            }
          }

          if (error.message.includes("foreign key constraint")) {
            set.status = 400
            return errorResponse("존재하지 않는 부서입니다.", ResponseCode.BAD_REQUEST)
          }
        }

        set.status = 500
        return errorResponse("회원가입 중 오류가 발생했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: signupSchema,
    },
  )

  // Verify token endpoint
  .post("/verify", async ({ headers, set }) => {
    const token = headers.authorization?.replace("Bearer ", "")
    if (!token) {
      set.status = 401
      return errorResponse("인증 토큰이 없습니다.", ResponseCode.UNAUTHORIZED)
    }

    const payload = await authService.verifyToken(token)
    const user = await userService.getUser(payload.userId)

    if (!user) {
      set.status = 401
      return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        isActive: user.isActive,
        departmentId: user.departmentId,
        employeeId: user.employeeId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        departmentName: user.departmentName,
        departmentCode: user.departmentCode,
      },
    }
  })

  // Refresh token endpoint
  .post("/refresh", async ({ headers, set }) => {
    const token = headers.authorization?.replace("Bearer ", "")
    if (!token) {
      set.status = 401
      return errorResponse("인증 토큰이 없습니다.", ResponseCode.UNAUTHORIZED)
    }

    const payload = await authService.verifyToken(token)
    const newToken = await authService.generateToken({
      userId: payload.userId,
      email: payload.email,
      userRole: payload.userRole,
    })

    return {
      token: newToken,
    }
  })

  // Admin check endpoint
  .get("/admin-check", async ({ headers, set }) => {
    const token = headers.authorization?.replace("Bearer ", "")
    if (!token) {
      set.status = 401
      return errorResponse("인증 토큰이 없습니다.", ResponseCode.UNAUTHORIZED)
    }

    const payload = await authService.verifyToken(token)

    return {
      is_admin: payload.userRole === "admin",
    }
  })

  // Update profile endpoint
  .patch(
    "/profile",
    async ({ headers, body, set }) => {
      const token = headers.authorization?.replace("Bearer ", "")
      if (!token) {
        set.status = 401
        return errorResponse("인증 토큰이 없습니다.", ResponseCode.UNAUTHORIZED)
      }

      const payload = await authService.verifyToken(token)

      // Get current user to preserve required fields
      const currentUser = await userService.getUser(payload.userId)
      if (!currentUser) {
        set.status = 404
        return errorResponse("사용자를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // Only allow updating username, email, and employeeId
      const updateData = {
        username: body.username,
        email: body.email,
        employeeId: body.employeeId,
        userRole: currentUser.userRole,
        isActive: currentUser.isActive,
        departmentId: currentUser.departmentId,
      }

      const user = await userService.updateUser(payload.userId, updateData)

      if (!user) {
        set.status = 404
        return errorResponse("사용자를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          isActive: user.isActive,
          departmentId: user.departmentId,
          employeeId: user.employeeId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 50 }),
        email: t.String({ format: "email", maxLength: 100 }),
        employeeId: t.String({ maxLength: 20 }),
      }),
    },
  )

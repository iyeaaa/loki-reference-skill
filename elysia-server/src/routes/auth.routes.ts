import { Elysia, t } from "elysia"
import * as authService from "../services/auth.service"
import * as oauthService from "../services/oauth.service"
import * as onboardingService from "../services/onboarding.service"
import * as userService from "../services/user.service"
import * as workspaceService from "../services/workspace.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Type for user objects returned by different user service functions
type AuthUser = {
  id: string
  username: string
  email: string
  userRole: "user" | "admin"
  isActive: boolean
  departmentId: string | null
  employeeId: string | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
  authProvider?: "local" | "google"
  oauthId?: string | null
  profilePicture?: string | null
  trialStartDate?: Date | null
  trialEndDate?: Date | null
  isTrialActive?: boolean | null
  departmentName?: string | null
  departmentCode?: string | null
}

const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
})

const signupSchema = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
})

const googleCallbackSchema = t.Object({
  code: t.String(),
  state: t.Optional(t.String()),
  // Onboarding params from trial signup
  industry: t.Optional(t.String()),
  target: t.Optional(t.String()),
  country: t.Optional(t.String()),
  experience: t.Optional(t.String()),
  lang: t.Optional(t.String()),
})

const googleTokenSchema = t.Object({
  idToken: t.String(),
})

const emailRegistrationSchema = t.Object({
  email: t.String({ format: "email" }),
  username: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
  // Onboarding params from trial signup
  industry: t.Optional(t.String()),
  target: t.Optional(t.String()),
  country: t.Optional(t.String()),
  experience: t.Optional(t.String()),
  lang: t.Optional(t.String()),
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
      const token = authService.generateToken({
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

  // Signup endpoint for admin
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

        // Create user (active by default)
        const newUser = await userService.createUser({
          username: body.username,
          email: body.email,
          passwordHash,
          userRole: "admin",
          isActive: true, // Active by default
        })

        if (!newUser) {
          set.status = 400
          return errorResponse("사용자 생성에 실패했습니다.", ResponseCode.BAD_REQUEST)
        }

        // Create default workspace for new users (same as trial signup)
        try {
          await workspaceService.createWorkspace({
            name: `${newUser.username}의 워크스페이스`,
            description: "기본 워크스페이스",
            ownerId: newUser.id,
            isActive: true,
          })
        } catch (wsError) {
          console.error("Failed to create default workspace for signup user:", wsError)
          // Don't throw error here to avoid breaking user registration
        }

        return {
          message: "회원가입이 완료되었습니다. 이제 로그인하실 수 있습니다.",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
          },
        }
      } catch (error) {
        logger.error({ err: error }, "Signup error")
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

  // Email registration endpoint (no password required)
  .post(
    "/register-email",
    async ({ body, set }) => {
      try {
        const { email, username, industry, target, country, experience, lang } = body

        // Log onboarding params for debugging
        console.log("[Auth] ========================================")
        console.log("[Auth] POST /register-email")
        console.log("[Auth] Request body:", JSON.stringify(body, null, 2))
        console.log("[Auth] Onboarding params:")
        console.log("[Auth]   - email:", email)
        console.log("[Auth]   - industry:", industry)
        console.log("[Auth]   - target:", target)
        console.log("[Auth]   - country:", country)
        console.log("[Auth]   - experience:", experience)
        console.log("[Auth]   - lang:", lang)

        // Check if user already exists
        const existingUser = await userService.checkAccountExists(email)
        if (existingUser) {
          console.log("[Auth] ❌ User already exists:", email)
          set.status = 400
          return errorResponse("이미 등록된 이메일입니다.", ResponseCode.BAD_REQUEST)
        }

        const finalUsername = (
          username && username.length >= 3 ? username : email.split("@")[0]
        ) as string

        console.log("[Auth] Creating new user:", finalUsername)
        const newUser = await userService.createUser({
          username: finalUsername,
          email: email,
          userRole: "user",
          isActive: true,
        })

        if (!newUser) {
          console.log("[Auth] ❌ Failed to create user")
          set.status = 400
          return errorResponse("사용자 생성에 실패했습니다.", ResponseCode.BAD_REQUEST)
        }

        console.log("[Auth] ✅ User created:", newUser.id)

        // Create workspace with onboarding params for trial users
        let workspace = null
        try {
          console.log("[Auth] Creating workspace for user...")
          workspace = await workspaceService.createWorkspace({
            name: `${newUser.username}의 워크스페이스`,
            description: "기본 워크스페이스",
            ownerId: newUser.id,
            isActive: true,
          })
          console.log("[Auth] ✅ Workspace created:", workspace?.id)

          // Link sales strategy and save survey data if all 4 fields are provided
          const hasAllOnboardingParams = !!(industry && target && country && experience)
          console.log("[Auth] Has all onboarding params:", hasAllOnboardingParams)

          if (workspace && hasAllOnboardingParams) {
            // 1. Save survey data to onboarding_progress
            try {
              console.log("[Auth] Saving survey data to onboarding_progress...")
              console.log("[Auth] workspaceId:", workspace.id)
              console.log(
                "[Auth] surveyData:",
                JSON.stringify({ industry, target, country, experience, lang }, null, 2),
              )

              await onboardingService.saveSurveyData(
                workspace.id,
                { industry, target, country, experience, lang },
                newUser.id,
              )
              console.log("[Auth] ✅ Survey data saved to onboarding_progress")
            } catch (surveyError) {
              console.error("[Auth] ❌ Failed to save survey data:", surveyError)
              // saveSurveyData already calls findOrCreateAndLinkSalesStrategy internally
              // so we skip the manual call below if this succeeds
            }
          } else {
            console.log("[Auth] ⚠️ Skipping survey data save - missing required fields")
            console.log("[Auth]   workspace:", !!workspace)
            console.log("[Auth]   industry:", industry)
            console.log("[Auth]   target:", target)
            console.log("[Auth]   country:", country)
            console.log("[Auth]   experience:", experience)
          }
        } catch (wsError) {
          console.error("[Auth] ❌ Failed to create workspace:", wsError)
          // Don't throw error here to avoid breaking user registration
        }

        // Generate JWT token for immediate login
        const token = authService.generateToken({
          userId: newUser.id,
          email: newUser.email,
          userRole: newUser.userRole,
        })

        // Get trial status
        const trialStatus = await userService.checkTrialStatus(newUser.id)

        console.log("[Auth] ✅ Registration complete")
        console.log("[Auth] ========================================")

        return {
          message: "이메일 등록이 완료되었습니다. 체험을 시작하세요!",
          token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            userRole: newUser.userRole,
            isActive: newUser.isActive,
            authProvider: "email",
            trialStatus,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt,
          },
        }
      } catch (error) {
        console.error("[Auth] ❌ Email registration error:", error)
        logger.error({ err: error }, "Email registration error")
        if (error instanceof Error) {
          if (error.message.includes("duplicate key value")) {
            set.status = 400
            if (error.message.includes("username")) {
              return errorResponse("이미 사용 중인 사용자명입니다.", ResponseCode.BAD_REQUEST)
            }
            if (error.message.includes("email")) {
              return errorResponse("이미 등록된 이메일입니다.", ResponseCode.BAD_REQUEST)
            }
          }
        }

        set.status = 500
        return errorResponse("이메일 등록 중 오류가 발생했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: emailRegistrationSchema,
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
    const newToken = authService.generateToken({
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

      // Only allow updating username, email, employeeId, and profilePicture
      const updateData = {
        username: body.username,
        email: body.email,
        employeeId: body.employeeId ?? currentUser.employeeId,
        userRole: currentUser.userRole,
        isActive: currentUser.isActive,
        departmentId: currentUser.departmentId,
        profilePicture: body.profilePicture,
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
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 50 }),
        email: t.String({ format: "email", maxLength: 100 }),
        employeeId: t.Optional(t.String({ maxLength: 20 })),
        profilePicture: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  // Google OAuth authorization URL
  .get("/google", async ({ set }) => {
    try {
      const authUrl = oauthService.getGoogleAuthUrl()
      return { authUrl }
    } catch (error) {
      logger.error({ error }, "Failed to generate Google auth URL")
      set.status = 500
      return errorResponse("Google 인증 URL 생성에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
    }
  })

  .post(
    "/google/callback",
    async ({ body, set }) => {
      try {
        const { code, industry, target, country, experience, lang } = body

        // Log onboarding params for debugging
        console.log("=== Google OAuth Callback - Onboarding Params ===")
        console.log({ industry, target, country, experience, lang })

        const googleUser = await oauthService.getGoogleUserInfo(code)

        const existingUser = await userService.getUserByEmail(googleUser.email)
        let user: AuthUser | undefined

        if (existingUser) {
          await userService.updateLastLogin(existingUser.id)
          user = (await userService.getUserByOAuthId(googleUser.id, "google")) || existingUser
        } else {
          user = await userService.createOrUpdateGoogleUser({
            username: googleUser.name ?? googleUser.email.split("@")[0],
            email: googleUser.email,
            oauthId: googleUser.id,
            profilePicture: googleUser.picture || undefined,
            onboardingParams: { industry, target, country, experience, lang },
          })
        }

        if (!user) {
          set.status = 500
          return errorResponse("사용자 생성에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
        }

        if (!user.isActive) {
          set.status = 401
          return errorResponse(
            "비활성화된 계정입니다. 관리자에게 문의하세요.",
            ResponseCode.UNAUTHORIZED,
          )
        }

        // Generate JWT token
        const token = authService.generateToken({
          userId: user.id,
          email: user.email,
          userRole: user.userRole,
        })

        // Get trial status
        const trialStatus = await userService.checkTrialStatus(user.id)

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
            authProvider: "authProvider" in user ? user.authProvider : "local",
            profilePicture: "profilePicture" in user ? user.profilePicture : null,
            trialStatus,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
            departmentName: "departmentName" in user ? user.departmentName : null,
            departmentCode: "departmentCode" in user ? user.departmentCode : null,
          },
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            code: `${body.code?.substring(0, 20)}...`,
          },
          "Google OAuth callback error",
        )
        set.status = 400
        return errorResponse(
          error instanceof Error ? error.message : "Google 인증에 실패했습니다.",
          ResponseCode.BAD_REQUEST,
        )
      }
    },
    {
      body: googleCallbackSchema,
    },
  )

  // Google ID Token verification (for client-side authentication)
  .post(
    "/google/verify",
    async ({ body, set }) => {
      try {
        const { idToken } = body

        // Verify Google ID token
        const googleUser = await oauthService.verifyGoogleIdToken(idToken)

        // Check if user already exists
        const existingUser = await userService.getUserByEmail(googleUser.email)
        let user: AuthUser | undefined

        if (existingUser) {
          // Update existing user's last login
          await userService.updateLastLogin(existingUser.id)
          // Get updated user with OAuth fields
          user = (await userService.getUserByOAuthId(googleUser.id, "google")) || existingUser
        } else {
          // Create new user with trial period
          user = await userService.createOrUpdateGoogleUser({
            username: googleUser.name ?? googleUser.email.split("@")[0],
            email: googleUser.email,
            oauthId: googleUser.id,
            profilePicture: googleUser.picture || undefined,
          })
        }

        if (!user) {
          set.status = 500
          return errorResponse("사용자 생성에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
        }

        // Check if user is active
        if (!user.isActive) {
          set.status = 401
          return errorResponse(
            "비활성화된 계정입니다. 관리자에게 문의하세요.",
            ResponseCode.UNAUTHORIZED,
          )
        }

        // Generate JWT token
        const token = authService.generateToken({
          userId: user.id,
          email: user.email,
          userRole: user.userRole,
        })

        // Get trial status
        const trialStatus = await userService.checkTrialStatus(user.id)

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
            authProvider: "authProvider" in user ? user.authProvider : "local",
            profilePicture: "profilePicture" in user ? user.profilePicture : null,
            trialStatus,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
            departmentName: "departmentName" in user ? user.departmentName : null,
            departmentCode: "departmentCode" in user ? user.departmentCode : null,
          },
        }
      } catch (error) {
        logger.error({ error }, "Google ID token verification error")
        set.status = 400
        return errorResponse(
          error instanceof Error ? error.message : "Google ID 토큰 검증에 실패했습니다.",
          ResponseCode.BAD_REQUEST,
        )
      }
    },
    {
      body: googleTokenSchema,
    },
  )

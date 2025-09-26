import { Elysia } from 'elysia'

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set, request }) => {
    const timestamp = new Date().toISOString()
    const path = request.url

    // 로그 출력
    console.error(`[${timestamp}] Error ${code} at ${path}:`, error)

    // 에러 타입별 처리
    switch (code) {
      case 'VALIDATION':
        set.status = 400
        return {
          success: false,
          error: 'Validation failed',
          details: error.message,
          timestamp,
          path
        }

      case 'NOT_FOUND':
        set.status = 404
        return {
          success: false,
          error: 'Resource not found',
          timestamp,
          path
        }

      case 'PARSE':
        set.status = 400
        return {
          success: false,
          error: 'Request parsing failed',
          details: error.message,
          timestamp,
          path
        }

      case 'INTERNAL_SERVER_ERROR':
        set.status = 500
        const errorMessage = error instanceof Error ? error.message : 'Internal server error'
        return {
          success: false,
          error: errorMessage,
          timestamp,
          path
        }

      default:
        // 커스텀 에러 처리
        if (error instanceof Error) {
          // AppError 등 커스텀 에러 클래스 처리
          if ('statusCode' in error && typeof error.statusCode === 'number') {
            set.status = error.statusCode
          } else {
            set.status = 500
          }

          return {
            success: false,
            error: error.message,
            code: 'code' in error ? error.code : undefined,
            timestamp,
            path
          }
        }

        // 알 수 없는 에러
        set.status = 500
        return {
          success: false,
          error: 'Unknown error occurred',
          timestamp,
          path
        }
    }
  })
  .onResponse(({ request, response, set }) => {
    // 응답 로깅 (선택적)
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${request.method} ${request.url} - ${set.status}`)
  })
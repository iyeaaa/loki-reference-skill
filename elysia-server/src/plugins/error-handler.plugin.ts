import { Elysia } from 'elysia'
import { errorResponse, getResponseCodeByStatus, ResponseCode } from '../types/response.types'

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set, request }) => {
    const path = request.url

    // 로그 출력
    console.error(`[${new Date().toISOString()}] Error ${code} at ${path}:`, error)

    // Content-Type을 JSON으로 명시적 설정
    set.headers['content-type'] = 'application/json'

    // 에러 타입별 처리
    switch (code) {
      case 'VALIDATION':
        set.status = 400
        return errorResponse(
          '유효성 검증에 실패했습니다.',
          ResponseCode.VALIDATION_ERROR,
          path
        )

      case 'NOT_FOUND':
        set.status = 404
        return errorResponse(
          '요청한 리소스를 찾을 수 없습니다.',
          ResponseCode.NOT_FOUND,
          path
        )

      case 'PARSE':
        set.status = 400
        return errorResponse(
          '요청 데이터 파싱에 실패했습니다.',
          ResponseCode.BAD_REQUEST,
          path
        )

      case 'INTERNAL_SERVER_ERROR':
        set.status = 500
        const errorMessage = error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.'
        return errorResponse(
          errorMessage,
          ResponseCode.INTERNAL_ERROR,
          path
        )

      default:
        // 커스텀 에러 처리
        if (error instanceof Error) {
          // AppError 등 커스텀 에러 클래스 처리
          let statusCode = 500
          let responseCode = ResponseCode.INTERNAL_ERROR
          let message = error.message

          if ('statusCode' in error && typeof error.statusCode === 'number') {
            statusCode = error.statusCode
            responseCode = getResponseCodeByStatus(statusCode)
          }

          // 커스텀 에러 코드가 있는 경우
          if ('code' in error && typeof error.code === 'string') {
            const customCode = error.code as keyof typeof ResponseCode
            if (ResponseCode[customCode]) {
              responseCode = ResponseCode[customCode]
            }
          }

          set.status = statusCode
          return errorResponse(message, responseCode, path)
        }

        // 알 수 없는 에러
        set.status = 500
        return errorResponse(
          '알 수 없는 오류가 발생했습니다.',
          ResponseCode.INTERNAL_ERROR,
          path
        )
    }
  })
  .onAfterResponse(({ request, set }) => {
    // 응답 로깅 (선택적)
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${request.method} ${request.url} - ${set.status}`)
  })
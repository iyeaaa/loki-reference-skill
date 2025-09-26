import { Elysia } from 'elysia'
import type { CommonResponse } from '../types/response.types'
import { successResponse } from '../types/response.types'

export const responseTransformer = new Elysia({ name: 'response-transformer' })
  .onBeforeHandle(({ set }) => {
    // 기본 성공 상태 코드 설정
    if (!set.status) {
      set.status = 200
    }
  })
  .onAfterHandle((context) => {
    const { set, request } = context
    // @ts-ignore - response는 deprecated지만 아직 사용 가능
    const response = context.response
    // 이미 CommonResponse 형식인 경우 그대로 반환
    if (isCommonResponse(response)) {
      return response
    }

    // 응답이 없는 경우 (204 No Content)
    if (response === undefined || response === null) {
      set.status = 204
      return successResponse(null, '처리가 완료되었습니다.', 'S204')
    }

    // 일반 응답을 CommonResponse로 변환
    // POST 요청의 경우 201 Created
    if (request.method === 'POST' && set.status === 200) {
      set.status = 201
      return successResponse(response, '생성되었습니다.', 'S201')
    }

    // PUT/PATCH 요청의 경우
    if ((request.method === 'PUT' || request.method === 'PATCH') && set.status === 200) {
      return successResponse(response, '수정되었습니다.', 'S200')
    }

    // DELETE 요청의 경우
    if (request.method === 'DELETE' && set.status === 200) {
      return successResponse(response, '삭제되었습니다.', 'S200')
    }

    // GET 요청 또는 기타
    return successResponse(response, '정상 처리되었습니다.', 'S200')
  })

// CommonResponse 타입 체크 함수
function isCommonResponse(response: any): response is CommonResponse {
  return (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'code' in response &&
    'message' in response
  )
}
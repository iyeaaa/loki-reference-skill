import type { Elysia } from "elysia"
import { getResponseCodeByStatus, ResponseCode, successResponse } from "../types/response.types"

export const responseTransformer = (app: Elysia) =>
  app.onAfterHandle(({ response, set, request }) => {
    // Skip transformation for lead-import upload endpoint (SSE endpoint)
    if (request.url.includes("/api/v1/admin/lead-import/upload")) {
      return response
    }

    // Skip transformation for leads search endpoint (returns CommonResponse directly)
    if (request.url.includes("/api/v1/leads/search")) {
      return response
    }

    // Skip transformation for filter-options endpoint (returns typed response)
    if (request.url.includes("/api/v1/admin/leads/filter-options/")) {
      return response
    }

    // Skip transformation for Server-Sent Events (SSE) streams
    if (response instanceof ReadableStream) {
      return response
    }

    // Skip transformation for responses with SSE content-type
    if (set.headers && set.headers["content-type"] === "text/event-stream") {
      return response
    }

    // 이미 CommonResponse 형식인 경우 중복 포맷 방지
    if (
      response &&
      typeof response === "object" &&
      "success" in response &&
      "code" in response &&
      "message" in response
    ) {
      return response
    }

    // 응답이 없는 경우 (204 No Content)
    if (response === undefined || response === null) {
      set.status = 204
      return successResponse(null, "처리가 완료되었습니다.", ResponseCode.NO_CONTENT)
    }

    // HTTP 메서드와 상태 코드에 따른 메시지 결정
    let message = "정상 처리되었습니다."
    const statusCode = typeof set.status === "number" ? set.status : 200
    let code = getResponseCodeByStatus(statusCode)

    // POST 요청의 경우 201 Created
    if (request.method === "POST" && (set.status === 200 || set.status === 201)) {
      set.status = 201
      message = "생성되었습니다."
      code = ResponseCode.CREATED
    }
    // PUT/PATCH 요청의 경우
    else if ((request.method === "PUT" || request.method === "PATCH") && set.status === 200) {
      message = "수정되었습니다."
      code = ResponseCode.SUCCESS
    }
    // DELETE 요청의 경우
    else if (request.method === "DELETE" && set.status === 200) {
      message = "삭제되었습니다."
      code = ResponseCode.SUCCESS
    }

    // 정상 응답을 CommonResponse로 변환
    return successResponse(response, message, code)
  })

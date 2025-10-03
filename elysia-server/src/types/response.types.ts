// 응답 코드 정의
export const ResponseCode = {
  // Success codes
  SUCCESS: "S200",
  CREATED: "S201",
  ACCEPTED: "S202",
  NO_CONTENT: "S204",

  // Client error codes
  BAD_REQUEST: "E400",
  UNAUTHORIZED: "E401",
  FORBIDDEN: "E403",
  NOT_FOUND: "E404",
  CONFLICT: "E409",
  VALIDATION_ERROR: "E422",
  TOO_MANY_REQUESTS: "E429",

  // Server error codes
  INTERNAL_ERROR: "E500",
  NOT_IMPLEMENTED: "E501",
  SERVICE_UNAVAILABLE: "E503",

  // Business logic codes
  DUPLICATE_EMAIL: "B001",
  INVALID_TOKEN: "B002",
  EXPIRED_TOKEN: "B003",
  INSUFFICIENT_PERMISSION: "B004",
} as const

export type ResponseCodeType = (typeof ResponseCode)[keyof typeof ResponseCode]

// 공통 응답 인터페이스
export interface CommonResponse<T = unknown> {
  success: boolean
  code: ResponseCodeType
  message: string
  data?: T
  timestamp?: string
  path?: string
}

// 성공 응답 생성 함수
export function successResponse<T>(
  data: T,
  message: string = "정상 처리되었습니다.",
  code: ResponseCodeType = ResponseCode.SUCCESS,
): CommonResponse<T> {
  return {
    success: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString(),
  }
}

// 에러 응답 생성 함수
export function errorResponse(
  message: string,
  code: ResponseCodeType = ResponseCode.INTERNAL_ERROR,
  path?: string,
): CommonResponse {
  return {
    success: false,
    code,
    message,
    timestamp: new Date().toISOString(),
    path,
  }
}

// HTTP 상태 코드와 응답 코드 매핑
export function getResponseCodeByStatus(status: number): ResponseCodeType {
  switch (status) {
    case 200:
      return ResponseCode.SUCCESS
    case 201:
      return ResponseCode.CREATED
    case 202:
      return ResponseCode.ACCEPTED
    case 204:
      return ResponseCode.NO_CONTENT
    case 400:
      return ResponseCode.BAD_REQUEST
    case 401:
      return ResponseCode.UNAUTHORIZED
    case 403:
      return ResponseCode.FORBIDDEN
    case 404:
      return ResponseCode.NOT_FOUND
    case 409:
      return ResponseCode.CONFLICT
    case 422:
      return ResponseCode.VALIDATION_ERROR
    case 429:
      return ResponseCode.TOO_MANY_REQUESTS
    case 500:
      return ResponseCode.INTERNAL_ERROR
    case 501:
      return ResponseCode.NOT_IMPLEMENTED
    case 503:
      return ResponseCode.SERVICE_UNAVAILABLE
    default:
      return ResponseCode.INTERNAL_ERROR
  }
}

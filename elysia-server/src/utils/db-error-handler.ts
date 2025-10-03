import type { ResponseCodeType } from "../types/response.types"
import { ResponseCode } from "../types/response.types"
import logger from "./logger"

export interface DatabaseError extends Error {
  code?: string
  detail?: string
  constraint?: string
  table?: string
  column?: string
}

export function handleDatabaseError(error: unknown): {
  message: string
  code: ResponseCodeType
  status: number
} {
  // PostgreSQL error codes
  const pgError = error as DatabaseError

  // Unique violation
  if (pgError.code === "23505") {
    const constraint = pgError.constraint || ""

    if (constraint.includes("email")) {
      return {
        message: "이미 사용 중인 이메일입니다.",
        code: ResponseCode.BAD_REQUEST,
        status: 400,
      }
    }

    if (constraint.includes("username")) {
      return {
        message: "이미 사용 중인 사용자명입니다.",
        code: ResponseCode.BAD_REQUEST,
        status: 400,
      }
    }

    if (constraint.includes("employee_id")) {
      return {
        message: "이미 등록된 사번입니다. 다른 사번을 입력하거나 관리자에게 문의하세요.",
        code: ResponseCode.BAD_REQUEST,
        status: 400,
      }
    }

    if (constraint.includes("department")) {
      return {
        message: "이미 존재하는 부서 코드입니다.",
        code: ResponseCode.BAD_REQUEST,
        status: 400,
      }
    }

    return {
      message: "중복된 데이터가 존재합니다.",
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // Foreign key violation
  if (pgError.code === "23503") {
    if (pgError.constraint?.includes("department")) {
      return {
        message: "존재하지 않는 부서입니다.",
        code: ResponseCode.BAD_REQUEST,
        status: 400,
      }
    }

    return {
      message: "참조하는 데이터가 존재하지 않습니다.",
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // Not null violation
  if (pgError.code === "23502") {
    const column = pgError.column || ""
    const fieldNames: Record<string, string> = {
      username: "사용자명",
      email: "이메일",
      password_hash: "비밀번호",
      department_id: "부서",
      employee_id: "사번",
      name: "이름",
      code: "코드",
    }

    const fieldName = fieldNames[column] || column
    return {
      message: `${fieldName}은(는) 필수 입력 항목입니다.`,
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // Check violation
  if (pgError.code === "23514") {
    return {
      message: "입력된 데이터가 유효하지 않습니다.",
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // String data right truncation
  if (pgError.code === "22001") {
    return {
      message: "입력된 데이터가 너무 깁니다.",
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // Invalid text representation
  if (pgError.code === "22P02") {
    return {
      message: "잘못된 데이터 형식입니다.",
      code: ResponseCode.BAD_REQUEST,
      status: 400,
    }
  }

  // Default database error
  if (pgError.code?.startsWith("23") || pgError.code?.startsWith("22")) {
    logger.error({ err: pgError, code: pgError.code }, "Database error occurred")
    return {
      message: "데이터베이스 오류가 발생했습니다.",
      code: ResponseCode.INTERNAL_ERROR,
      status: 500,
    }
  }

  // Unknown error
  logger.error({ err: error }, "Unknown error occurred")
  return {
    message: "서버 오류가 발생했습니다.",
    code: ResponseCode.INTERNAL_ERROR,
    status: 500,
  }
}

export function isDatabaseError(error: unknown): boolean {
  const pgError = error as DatabaseError
  return typeof pgError.code === "string" && /^\d{5}$/.test(pgError.code)
}

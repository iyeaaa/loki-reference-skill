// ========================================
// Centralized Type Definitions
// ========================================

// Re-export all types from individual files
export type * from "./auth"
export type {
  DepartmentCreateRequest,
  DepartmentsResponse,
  DepartmentUpdateRequest,
} from "./department"
export type * from "./user"

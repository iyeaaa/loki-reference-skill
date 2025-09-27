// ========================================
// TanStack Query Hooks & Types
// ========================================

// Token Management
export { getToken, removeToken, setToken } from "./client"
// Auth Hooks
export {
  authKeys,
  useCurrentUser,
  useLoginMutation,
  useLogoutMutation,
  useRefreshToken,
  useSignupMutation,
  useVerifyToken,
} from "./hooks/auth"
// Department Hooks
export {
  departmentKeys,
  useCreateDepartment,
  useDeleteDepartment,
  useDepartment,
  useDepartments,
  useToggleDepartmentStatus,
  useUpdateDepartment,
} from "./hooks/departments"
// User Hooks
export {
  useBulkUpdateDepartment,
  useBulkUpdateRole,
  useBulkUpdateStatus,
  useChangePassword,
  useCreateUser,
  useDeleteUser,
  userKeys,
  useUpdateUser,
  useUser,
  useUserStats,
  useUsers,
} from "./hooks/users"
// Re-export all types
export type * from "./types"

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
// Chatbot Hooks
export {
  chatbotKeys,
  useChatbot,
  useChatbotHistory,
  useChatbotMutation,
} from "./hooks/chatbot"
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
// Payment Hooks
export {
  PORTONE_ERROR_CODES,
  paymentKeys,
  useExchangeRate,
  usePayment,
  usePaymentCancel,
  usePaymentComplete,
  usePricingPlans,
} from "./hooks/payment"
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

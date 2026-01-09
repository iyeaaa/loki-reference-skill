import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import {
  iamAuditLogsApi,
  iamMemberApi,
  iamPoliciesApi,
  iamRolesApi,
  iamTierBoundariesApi,
} from "../services/iam"
import type {
  AttachPolicyToMemberRequest,
  AttachPolicyToRoleRequest,
  CreateIamPolicyRequest,
  CreateIamRoleRequest,
  CreatePolicyStatementRequest,
  GrantRoleToMemberRequest,
  IamAuditLogsParams,
  IamPoliciesParams,
  IamRolesParams,
  IamTierBoundariesParams,
  UpdateIamPolicyRequest,
  UpdateIamRoleRequest,
  UpdatePolicyStatementRequest,
} from "../types/iam"

// ============================================================================
// Query Keys
// ============================================================================

export const iamKeys = {
  all: ["iam"] as const,

  // Policies
  policies: () => [...iamKeys.all, "policies"] as const,
  policiesList: (params?: IamPoliciesParams) => [...iamKeys.policies(), "list", params] as const,
  policyDetail: (id: string) => [...iamKeys.policies(), "detail", id] as const,
  policyStatements: (id: string) => [...iamKeys.policies(), "statements", id] as const,

  // Roles
  roles: () => [...iamKeys.all, "roles"] as const,
  rolesList: (params?: IamRolesParams) => [...iamKeys.roles(), "list", params] as const,
  roleDetail: (id: string) => [...iamKeys.roles(), "detail", id] as const,
  rolePolicies: (id: string) => [...iamKeys.roles(), "policies", id] as const,
  roleMembers: (id: string) => [...iamKeys.roles(), "members", id] as const,

  // Members
  memberRoles: (memberId: string) => [...iamKeys.all, "members", memberId, "roles"] as const,
  memberPolicies: (memberId: string) => [...iamKeys.all, "members", memberId, "policies"] as const,

  // Tier Boundaries
  tierBoundaries: () => [...iamKeys.all, "tier-boundaries"] as const,
  tierBoundary: (tier: string) => [...iamKeys.tierBoundaries(), tier] as const,

  // Audit Logs
  auditLogs: () => [...iamKeys.all, "audit-logs"] as const,
  auditLogsList: (params?: IamAuditLogsParams) => [...iamKeys.auditLogs(), "list", params] as const,
  auditLogDetail: (id: string) => [...iamKeys.auditLogs(), "detail", id] as const,
}

// ============================================================================
// Policies Queries & Mutations
// ============================================================================

export function useIamPolicies(params?: IamPoliciesParams) {
  return useQuery({
    queryKey: iamKeys.policiesList(params),
    queryFn: () => iamPoliciesApi.list(params),
    staleTime: 0, // IAM 데이터는 즉시 반영 필요
    gcTime: 5 * 60 * 1000,
  })
}

export function useIamPolicy(policyId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.policyDetail(policyId),
    queryFn: () => iamPoliciesApi.get(policyId),
    enabled,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

export function useIamPolicyStatements(policyId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.policyStatements(policyId),
    queryFn: () => iamPoliciesApi.getStatements(policyId),
    enabled,
    staleTime: 0,
  })
}

export function useCreateIamPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIamPolicyRequest) => iamPoliciesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iamKeys.policies() })
      toast.success("정책이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 생성에 실패했습니다")
    },
  })
}

export function useUpdateIamPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ policyId, data }: { policyId: string; data: UpdateIamPolicyRequest }) =>
      iamPoliciesApi.update(policyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.policyDetail(variables.policyId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.policies() })
      toast.success("정책이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteIamPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (policyId: string) => iamPoliciesApi.delete(policyId),
    onSuccess: () => {
      // 정책 삭제 시 모든 연관 캐시 invalidate
      queryClient.invalidateQueries({ queryKey: iamKeys.policies() })
      queryClient.invalidateQueries({ queryKey: iamKeys.roles() }) // 역할에 연결된 정책 목록
      queryClient.invalidateQueries({ queryKey: iamKeys.all }) // 멤버 정책 등 모든 IAM 캐시
      toast.success("정책이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 삭제에 실패했습니다")
    },
  })
}

// Policy Statements Mutations
export function useAddPolicyStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ policyId, data }: { policyId: string; data: CreatePolicyStatementRequest }) =>
      iamPoliciesApi.addStatement(policyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.policyStatements(variables.policyId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.policyDetail(variables.policyId) })
      toast.success("명세가 추가되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "명세 추가에 실패했습니다")
    },
  })
}

export function useUpdatePolicyStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      policyId,
      statementId,
      data,
    }: {
      policyId: string
      statementId: string
      data: UpdatePolicyStatementRequest
    }) => iamPoliciesApi.updateStatement(policyId, statementId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.policyStatements(variables.policyId) })
      toast.success("명세가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "명세 업데이트에 실패했습니다")
    },
  })
}

export function useDeletePolicyStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ policyId, statementId }: { policyId: string; statementId: string }) =>
      iamPoliciesApi.deleteStatement(policyId, statementId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.policyStatements(variables.policyId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.policyDetail(variables.policyId) })
      toast.success("명세가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "명세 삭제에 실패했습니다")
    },
  })
}

// ============================================================================
// Roles Queries & Mutations
// ============================================================================

export function useIamRoles(params?: IamRolesParams) {
  return useQuery({
    queryKey: iamKeys.rolesList(params),
    queryFn: () => iamRolesApi.list(params),
    staleTime: 0, // IAM 데이터는 즉시 반영 필요
    gcTime: 5 * 60 * 1000,
  })
}

export function useIamRole(roleId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.roleDetail(roleId),
    queryFn: () => iamRolesApi.get(roleId),
    enabled,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

export function useIamRolePolicies(roleId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.rolePolicies(roleId),
    queryFn: () => iamRolesApi.getPolicies(roleId),
    enabled,
    staleTime: 0,
  })
}

export function useIamRoleMembers(roleId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.roleMembers(roleId),
    queryFn: () => iamRolesApi.getMembers(roleId),
    enabled,
    staleTime: 0,
  })
}

export function useCreateIamRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIamRoleRequest) => iamRolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iamKeys.roles() })
      toast.success("역할이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "역할 생성에 실패했습니다")
    },
  })
}

export function useUpdateIamRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: UpdateIamRoleRequest }) =>
      iamRolesApi.update(roleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.roleDetail(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.roles() })
      toast.success("역할이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "역할 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteIamRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (roleId: string) => iamRolesApi.delete(roleId),
    onSuccess: () => {
      // 역할 삭제 시 모든 연관 캐시 invalidate
      queryClient.invalidateQueries({ queryKey: iamKeys.roles() })
      queryClient.invalidateQueries({ queryKey: iamKeys.all }) // 멤버 역할 등 모든 IAM 캐시
      toast.success("역할이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "역할 삭제에 실패했습니다")
    },
  })
}

// Role Policies Mutations
export function useAttachPolicyToRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AttachPolicyToRoleRequest) => iamRolesApi.attachPolicy(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.rolePolicies(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.roleDetail(variables.roleId) })
      toast.success("정책이 역할에 연결되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 연결에 실패했습니다")
    },
  })
}

export function useDetachPolicyFromRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roleId, policyId }: { roleId: string; policyId: string }) =>
      iamRolesApi.detachPolicy(roleId, policyId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.rolePolicies(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.roleDetail(variables.roleId) })
      toast.success("정책이 역할에서 해제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 해제에 실패했습니다")
    },
  })
}

// ============================================================================
// Member Roles & Policies
// ============================================================================

export function useMemberRoles(memberId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.memberRoles(memberId),
    queryFn: () => iamMemberApi.getRoles(memberId),
    enabled,
    staleTime: 0, // 즉시 반영
  })
}

export function useMemberPolicies(memberId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.memberPolicies(memberId),
    queryFn: () => iamMemberApi.getPolicies(memberId),
    enabled,
    staleTime: 0, // 즉시 반영
  })
}

export function useGrantRoleToMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: GrantRoleToMemberRequest) => iamMemberApi.grantRole(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.memberRoles(variables.memberId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.roleMembers(variables.roleId) }) // 역할의 멤버 목록도 갱신
      toast.success("역할이 멤버에게 부여되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "역할 부여에 실패했습니다")
    },
  })
}

export function useRevokeRoleFromMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string }) =>
      iamMemberApi.revokeRole(memberId, roleId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.memberRoles(variables.memberId) })
      queryClient.invalidateQueries({ queryKey: iamKeys.roleMembers(variables.roleId) }) // 역할의 멤버 목록도 갱신
      toast.success("역할이 멤버에서 해제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "역할 해제에 실패했습니다")
    },
  })
}

export function useAttachPolicyToMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AttachPolicyToMemberRequest) => iamMemberApi.attachPolicy(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.memberPolicies(variables.memberId) })
      toast.success("정책이 멤버에 연결되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 연결에 실패했습니다")
    },
  })
}

export function useDetachPolicyFromMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, policyId }: { memberId: string; policyId: string }) =>
      iamMemberApi.detachPolicy(memberId, policyId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.memberPolicies(variables.memberId) })
      toast.success("정책이 멤버에서 해제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "정책 해제에 실패했습니다")
    },
  })
}

// ============================================================================
// Tier Boundaries
// ============================================================================

export function useIamTierBoundaries(params?: IamTierBoundariesParams) {
  return useQuery({
    queryKey: iamKeys.tierBoundaries(),
    queryFn: () => iamTierBoundariesApi.list(params),
    staleTime: 0, // 즉시 반영
  })
}

export function useIamTierBoundary(tier: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.tierBoundary(tier),
    queryFn: () => iamTierBoundariesApi.get(tier),
    enabled,
    staleTime: 0, // 즉시 반영
  })
}

export function useUpdateTierBoundary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tier, policyId }: { tier: string; policyId: string }) =>
      iamTierBoundariesApi.update(tier, policyId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: iamKeys.tierBoundary(variables.tier) })
      queryClient.invalidateQueries({ queryKey: iamKeys.tierBoundaries() })
      toast.success("등급 권한 경계가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "등급 권한 경계 업데이트에 실패했습니다")
    },
  })
}

// ============================================================================
// Audit Logs
// ============================================================================

export function useIamAuditLogs(params?: IamAuditLogsParams) {
  return useQuery({
    queryKey: iamKeys.auditLogsList(params),
    queryFn: () => iamAuditLogsApi.list(params),
    staleTime: 0, // 감사 로그는 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useIamAuditLog(logId: string, enabled = true) {
  return useQuery({
    queryKey: iamKeys.auditLogDetail(logId),
    queryFn: () => iamAuditLogsApi.get(logId),
    enabled,
    staleTime: 0,
  })
}

// ============================================================================
// My Permissions (현재 사용자 권한)
// ============================================================================

import { iamMyPermissionsApi } from "../services/iam"

export const myPermissionsKeys = {
  all: ["my-permissions"] as const,
  workspace: (workspaceId?: string) => [...myPermissionsKeys.all, workspaceId] as const,
}

/**
 * 현재 사용자의 권한 조회
 * - 워크스페이스 있으면: 워크스페이스 내 권한 조회
 * - 워크스페이스 없으면: 전역 Admin 여부만 조회
 * 캐시 없이 항상 최신 데이터 조회 (DB 변경 시 즉시 반영)
 */
export function useMyPermissions(workspaceId?: string, enabled = true) {
  return useQuery({
    queryKey: myPermissionsKeys.workspace(workspaceId),
    queryFn: () => iamMyPermissionsApi.getMyPermissions(workspaceId),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true, // 탭 전환 시 최신 데이터 조회
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 조회
    // 워크스페이스 전환 시 이전 데이터 유지 → 깜빡임 없는 부드러운 전환
    placeholderData: keepPreviousData,
  })
}

/**
 * 워크스페이스 내 Admin 권한 체크 (Owner/Admin 역할)
 */
export function useIsWorkspaceAdmin(workspaceId?: string) {
  const { data, isLoading } = useMyPermissions(workspaceId)
  return {
    isAdmin: data?.isAdmin ?? false,
    isLoading,
  }
}

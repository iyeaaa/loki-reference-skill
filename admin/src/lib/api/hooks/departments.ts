import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { departmentsApi } from "../services/departments"
import type { DepartmentCreateRequest, DepartmentUpdateRequest } from "../types"

// 1. Query Keys
export const departmentKeys = {
  all: ["departments"] as const,
  lists: () => [...departmentKeys.all, "list"] as const,
  list: (search?: string) => [...departmentKeys.lists(), search] as const,
  detail: (id: string) => [...departmentKeys.all, "detail", id] as const,
}

// 2. Queries
export function useDepartments(search?: string) {
  return useQuery({
    queryKey: departmentKeys.list(search),
    queryFn: () => departmentsApi.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useDepartment(id: string, enabled = true) {
  return useQuery({
    queryKey: departmentKeys.detail(id),
    queryFn: () => departmentsApi.get(id),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// 3. Mutations
export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DepartmentCreateRequest) => departmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() })
      toast.success("부서가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "부서 생성에 실패했습니다")
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DepartmentUpdateRequest }) =>
      departmentsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() })
      toast.success("부서 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "부서 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() })
      toast.success("부서가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "부서 삭제에 실패했습니다")
    },
  })
}

export function useToggleDepartmentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      departmentsApi.update(id, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() })
      toast.success(`부서가 ${variables.isActive ? "활성화" : "비활성화"}되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "부서 상태 변경에 실패했습니다")
    },
  })
}

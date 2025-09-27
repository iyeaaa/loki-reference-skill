import { apiFetch } from "@/lib/api/client"
import type { Department, DepartmentCreateRequest, DepartmentUpdateRequest } from "../types"
export const departmentApi = {
  list: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : ""
    return apiFetch<Department[]>(`/api/v1/departments${params}`)
  },

  get: (id: string) => {
    return apiFetch<Department>(`/api/v1/departments/${id}`)
  },

  create: (data: DepartmentCreateRequest) => {
    return apiFetch<Department>("/api/v1/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: DepartmentUpdateRequest) => {
    return apiFetch<Department>(`/api/v1/admin/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string) => {
    return apiFetch(`/api/v1/admin/departments/${id}`, {
      method: "DELETE",
    })
  },

  toggleStatus: (id: string, isActive: boolean) => {
    return apiFetch<Department>(`/api/v1/admin/departments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    })
  },
}

import { apiFetch } from "@/lib/api/client"
import type { DepartmentCreateRequest, DepartmentUpdateRequest } from "../types/department"
import type { Department } from "../types/user"

export const departmentsApi = {
  list: () => {
    return apiFetch<Department[]>("/api/v1/departments")
  },

  get: (id: string) => {
    return apiFetch<Department>(`/api/v1/departments/${id}`)
  },

  create: (data: DepartmentCreateRequest) => {
    return apiFetch<Department>("/api/v1/departments", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: DepartmentUpdateRequest) => {
    return apiFetch<Department>(`/api/v1/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string) => {
    return apiFetch(`/api/v1/departments/${id}`, {
      method: "DELETE",
    })
  },
}

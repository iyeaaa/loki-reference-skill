import { apiFetch } from "@/lib/api/client"

export type AddressBookGroup = {
  id: string
  name: string
  description?: string | null
  createdAt: string
  updatedAt: string
}

export type AddressBookContact = {
  id: string
  groupId: string
  company: string
  email: string
  createdAt: string
}

export const addressBookApi = {
  listGroups: async (params?: { page?: number; limit?: number; search?: string }) => {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams()
    searchParams.append("limit", String(limit))
    searchParams.append("offset", String(offset))
    if (params?.search) searchParams.append("search", params.search)
    const q = searchParams.toString()
    const res = await apiFetch<{ data: AddressBookGroup[]; total: number; limit: number; offset: number }>(
      `/api/v1/address-book/groups${q ? `?${q}` : ""}`,
    )
    return {
      groups: res.data,
      total: res.total,
      page,
      limit,
      totalPages: Math.ceil(res.total / limit),
    }
  },

  createGroup: (payload: { name: string; description?: string }) =>
    apiFetch<AddressBookGroup>(`/api/v1/address-book/groups`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateGroup: (groupId: string, payload: { name?: string; description?: string }) =>
    apiFetch<AddressBookGroup>(`/api/v1/address-book/groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteGroup: (groupId: string) =>
    apiFetch<{ success: true }>(`/api/v1/address-book/groups/${groupId}`, { method: "DELETE" }),

  listContacts: async (
    groupId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) => {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams()
    searchParams.append("limit", String(limit))
    searchParams.append("offset", String(offset))
    if (params?.search) searchParams.append("search", params.search)
    const q = searchParams.toString()
    const res = await apiFetch<{
      data: AddressBookContact[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/address-book/groups/${groupId}/contacts${q ? `?${q}` : ""}`)
    return {
      contacts: res.data,
      total: res.total,
      page,
      limit,
      totalPages: Math.ceil(res.total / limit),
    }
  },

  addContact: (groupId: string, payload: { company: string; email: string }) =>
    apiFetch<AddressBookContact>(`/api/v1/address-book/groups/${groupId}/contacts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteContact: (contactId: string) =>
    apiFetch<{ success: true }>(`/api/v1/address-book/contacts/${contactId}`, { method: "DELETE" }),
}



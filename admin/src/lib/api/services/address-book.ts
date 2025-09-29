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
  industryType?: string | null
  productCategory?: string | null
  description?: string | null
  websiteUrl?: string | null
  country?: string | null
  linkedinUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  createdAt: string
}

// 임시 하드코딩된 userId - 나중에 인증 시스템과 연동 필요
const TEMP_USER_ID = "f1243741-8a53-4375-9c1b-efdda29cf8f6"

export const addressBookApi = {
  listGroups: async (params?: { page?: number; limit?: number; search?: string }) => {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams()
    searchParams.append("userId", TEMP_USER_ID)
    searchParams.append("limit", String(limit))
    searchParams.append("offset", String(offset))
    if (params?.search) searchParams.append("search", params.search)
    const q = searchParams.toString()
    const res = await apiFetch<{ data: AddressBookGroup[]; total: number; limit: number; offset: number }>(
      `/api/v1/address-book/groups?${q}`,
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
      body: JSON.stringify({ ...payload, userId: TEMP_USER_ID }),
    }),

  updateGroup: (groupId: string, payload: { name?: string; description?: string }) =>
    apiFetch<AddressBookGroup>(`/api/v1/address-book/groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, userId: TEMP_USER_ID }),
    }),

  deleteGroup: (groupId: string) =>
    apiFetch<{ success: true }>(`/api/v1/address-book/groups/${groupId}?userId=${TEMP_USER_ID}`, { method: "DELETE" }),

  listContacts: async (
    groupId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) => {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams()
    searchParams.append("userId", TEMP_USER_ID)
    searchParams.append("limit", String(limit))
    searchParams.append("offset", String(offset))
    if (params?.search) searchParams.append("search", params.search)
    const q = searchParams.toString()
    const res = await apiFetch<{
      data: AddressBookContact[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/address-book/groups/${groupId}/contacts?${q}`)
    return {
      contacts: res.data,
      total: res.total,
      page,
      limit,
      totalPages: Math.ceil(res.total / limit),
    }
  },

  addContact: (groupId: string, payload: {
    company: string;
    email: string;
    industryType?: string;
    productCategory?: string;
    description?: string;
    websiteUrl?: string;
    country?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
  }) =>
    apiFetch<AddressBookContact>(`/api/v1/address-book/groups/${groupId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ ...payload, userId: TEMP_USER_ID }),
    }),

  deleteContact: (contactId: string) =>
    apiFetch<{ success: true }>(`/api/v1/address-book/contacts/${contactId}?userId=${TEMP_USER_ID}`, { method: "DELETE" }),
}



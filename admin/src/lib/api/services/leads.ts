import { apiFetch } from "@/lib/api/client"
import { client } from "@/lib/api/generated/client"
import type {
  BulkUpdateBusinessTypeRequest,
  BulkUpdateLeadStatusRequest,
  CreateLeadRequest,
  Lead,
  LeadsParams,
  UpdateLeadRequest,
} from "../types/lead"

export const leadsApi = {
  list: (params?: LeadsParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.searchType) searchParams.append("searchType", params.searchType)
    if (params?.leadStatus && params.leadStatus !== "all") {
      searchParams.append("leadStatus", params.leadStatus)
    }
    if (params?.businessType) searchParams.append("businessType", params.businessType)
    if (params?.country) searchParams.append("country", params.country)
    if (params?.city) searchParams.append("city", params.city)
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","))
    }
    if (params?.customerGroupId) {
      searchParams.append("customerGroupId", params.customerGroupId)
    }
    if (params?.sortField) searchParams.append("sortField", params.sortField)
    if (params?.sortOrder) searchParams.append("sortOrder", params.sortOrder)
    if (params?.filters) searchParams.append("filters", params.filters)

    const query = searchParams.toString()
    return apiFetch<{
      data: Lead[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/leads/search${query ? `?${query}` : ""}`).then((response) => ({
      leads: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (leadId: string) => {
    return apiFetch<Lead>(`/api/v1/leads/${leadId}`)
  },

  create: (data: CreateLeadRequest) => {
    return apiFetch<Lead>("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (leadId: string, data: UpdateLeadRequest) => {
    return apiFetch<Lead>(`/api/v1/leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (leadId: string) => {
    return apiFetch(`/api/v1/leads/${leadId}`, {
      method: "DELETE",
    })
  },

  bulkUpdateStatus: (data: BulkUpdateLeadStatusRequest) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/leads/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  bulkUpdateBusinessType: (data: BulkUpdateBusinessTypeRequest) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/leads/bulk/business-type", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  bulkDelete: (leadIds: string[]) => {
    return apiFetch<{ deletedCount: number }>("/api/v1/admin/leads/bulk", {
      method: "DELETE",
      body: JSON.stringify({ leadIds }),
    })
  },

  getByWorkspace: (workspaceId: string, page = 1, limit = 10) => {
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    return apiFetch<{
      data: Lead[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/leads/workspace/${workspaceId}?${searchParams.toString()}`).then((response) => ({
      leads: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  // CSV 데이터로 리드 일괄 생성
  createFromCSV: (data: {
    workspaceId: string
    leads: Array<{
      companyName: string
      foundCompanyName?: string
      contactName?: string
      businessType?: string
      websiteUrl?: string
      description?: string
      employeeCount?: string
      foundedYear?: number
      country?: string
      city?: string
      state?: string
      address?: string
      leadSource?: string
      leadStatus?: string
      leadScore?: number
      notes?: string
      primaryEmail?: string
      primaryPhone?: string
      secondaryEmail?: string
      secondaryPhone?: string
    }>
    customerGroupId?: string
    createdBy?: string
  }) => {
    return apiFetch<{ leads: Lead[] }>("/api/v1/leads/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // 필터 옵션 조회
  getFilterOptions: async (field: string, workspaceId?: string, customerGroupId?: string) => {
    // Build query object, only including defined values
    const query: { workspaceId?: string; customerGroupId?: string } = {}
    if (workspaceId !== undefined && workspaceId !== "") {
      query.workspaceId = workspaceId
    }
    if (customerGroupId !== undefined && customerGroupId !== "") {
      query.customerGroupId = customerGroupId
    }

    const { data, error } = await client.GET("/api/v1/admin/leads/filter-options/{field}", {
      params: {
        path: { field },
        query,
      },
    })

    if (error) {
      throw new Error("Failed to fetch filter options")
    }

    return data.data
  },

  // 선택된 리드들 CSV 다운로드
  downloadSelectedLeadsCSV: async (leadIds: string[], leadsData?: Lead[]) => {
    if (leadIds.length === 0) {
      throw new Error("다운로드할 리드가 선택되지 않았습니다.")
    }

    let validLeads: Lead[] = []

    if (leadsData) {
      // 이미 로드된 데이터에서 선택된 리드들만 필터링
      validLeads = leadsData.filter((lead) => leadIds.includes(lead.id))
    } else {
      // 개별적으로 리드 데이터를 가져옴
      const fetchedLeads = await Promise.all(
        leadIds.map(async (leadId) => {
          try {
            const lead = await apiFetch<Lead>(`/api/v1/leads/${leadId}`)
            return lead
          } catch (error) {
            console.error(`Failed to fetch lead ${leadId}:`, error)
            return null
          }
        }),
      )

      // null 값 제거
      validLeads = fetchedLeads.filter((lead): lead is Lead => lead !== null)
    }

    if (validLeads.length === 0) {
      throw new Error("다운로드할 수 있는 리드 데이터가 없습니다.")
    }

    // CSV 헤더 생성 (요청된 테이블 형식에 맞게)
    const headers = [
      "회사명",
      "웹사이트",
      "회사 설명",
      "상태",
      "업종",
      "국가",
      "도시",
      "설립년도",
      "직원수",
      "전화번호",
      "이메일",
      "Facebook",
      "Instagram",
      "Twitter",
      "LinkedIn",
      "제품",
      "산업 부문",
      "제품 카테고리",
      "산업 카테고리",
      "생성일",
    ]

    // CSV 데이터 생성
    const csvRows = validLeads.map((lead) => {
      // 연락처 정보 처리 (안전하게 처리)
      const emails = (lead.contacts || [])
        .filter((c) => c.contactType === "email")
        .map((c) => c.contactValue)
        .join("; ")

      const phones = (lead.contacts || [])
        .filter((c) => c.contactType === "phone")
        .map((c) => c.contactValue)
        .join("; ")

      // 소셜미디어 정보 처리 (안전하게 처리)
      const facebook = (lead.socialMedia || [])
        .filter((s) => s.platform === "facebook")
        .map((s) => s.url)
        .join("; ")

      const instagram = (lead.socialMedia || [])
        .filter((s) => s.platform === "instagram")
        .map((s) => s.url)
        .join("; ")

      const twitter = (lead.socialMedia || [])
        .filter((s) => s.platform === "twitter")
        .map((s) => s.url)
        .join("; ")

      const linkedin = (lead.socialMedia || [])
        .filter((s) => s.platform === "linkedin")
        .map((s) => s.url)
        .join("; ")

      // 제품 정보 처리 (안전하게 처리)
      const products = (lead.products || []).map((p) => p.productName).join(", ")

      // 산업 부문 정보 처리 (안전하게 처리)
      const businessSectors = (lead.businessSectors || []).map((s) => s.sectorName).join(", ")

      // 제품 카테고리 정보 처리 (안전하게 처리)
      const productCategories = (lead.productCategories || []).map((c) => c.categoryName).join(", ")

      // 산업 카테고리 정보 처리 (안전하게 처리)
      const industryTypes = (lead.industryTypes || []).map((i) => i.industryName).join(", ")

      return [
        lead.companyName || "",
        lead.websiteUrl || "",
        (lead.description || "").replace(/"/g, '""'), // 따옴표 이스케이프
        lead.leadStatus || "",
        lead.businessType || "",
        lead.country || "",
        lead.city || "",
        lead.foundedYear || "",
        lead.employeeCount || "",
        phones,
        emails,
        facebook,
        instagram,
        twitter,
        linkedin,
        products,
        businessSectors,
        productCategories,
        industryTypes,
        lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ko-KR") : "",
      ]
    })

    // CSV 내용 생성
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // BOM 추가 (Excel에서 한글 깨짐 방지)
    const csvWithBOM = `\uFEFF${csvContent}`

    // 파일명 생성
    const filename = `selected_leads_${new Date().toISOString().split("T")[0]}.csv`

    // Blob 생성 및 다운로드
    const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)

    return { success: true, filename }
  },
}

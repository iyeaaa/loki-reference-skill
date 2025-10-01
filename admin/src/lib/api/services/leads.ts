import { apiFetch } from "@/lib/api/client";
import type {
  BulkUpdateBusinessTypeRequest,
  BulkUpdateLeadStatusRequest,
  CreateLeadRequest,
  Lead,
  LeadsParams,
  UpdateLeadRequest,
} from "../types/lead";

export const leadsApi = {
  list: (params?: LeadsParams) => {
    const searchParams = new URLSearchParams();

    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;

    searchParams.append("limit", limit.toString());
    searchParams.append("offset", offset.toString());

    if (params?.search) searchParams.append("search", params.search);
    if (params?.leadStatus && params.leadStatus !== "all") {
      searchParams.append("leadStatus", params.leadStatus);
    }
    if (params?.businessType)
      searchParams.append("businessType", params.businessType);
    if (params?.country) searchParams.append("country", params.country);
    if (params?.city) searchParams.append("city", params.city);
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","));
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","));
    }
    if (params?.customerGroupId) {
      searchParams.append("customerGroupId", params.customerGroupId);
    }

    const query = searchParams.toString();
    return apiFetch<{
      data: Lead[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/v1/leads/search${query ? `?${query}` : ""}`).then((response) => ({
      leads: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }));
  },

  get: (leadId: string) => {
    return apiFetch<Lead>(`/api/v1/leads/${leadId}`);
  },

  create: (data: CreateLeadRequest) => {
    return apiFetch<Lead>("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: (leadId: string, data: UpdateLeadRequest) => {
    return apiFetch<Lead>(`/api/v1/leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: (leadId: string) => {
    return apiFetch(`/api/v1/leads/${leadId}`, {
      method: "DELETE",
    });
  },

  bulkUpdateStatus: (data: BulkUpdateLeadStatusRequest) => {
    return apiFetch<{ updatedCount: number }>(
      "/api/v1/admin/leads/bulk/status",
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  bulkUpdateBusinessType: (data: BulkUpdateBusinessTypeRequest) => {
    return apiFetch<{ updatedCount: number }>(
      "/api/v1/admin/leads/bulk/business-type",
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  bulkDelete: (leadIds: string[]) => {
    return apiFetch<{ deletedCount: number }>("/api/v1/admin/leads/bulk", {
      method: "DELETE",
      body: JSON.stringify({ leadIds }),
    });
  },

  getByWorkspace: (workspaceId: string, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    return apiFetch<{
      data: Lead[];
      total: number;
      limit: number;
      offset: number;
    }>(
      `/api/v1/leads/workspace/${workspaceId}?${searchParams.toString()}`
    ).then((response) => ({
      leads: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }));
  },

  // CSV 데이터로 리드 일괄 생성
  createFromCSV: (data: {
    workspaceId: string;
    leads: Array<{
      companyName: string;
      foundCompanyName?: string;
      businessType?: string;
      websiteUrl?: string;
      description?: string;
      employeeCount?: string;
      foundedYear?: number;
      country?: string;
      city?: string;
      state?: string;
      address?: string;
      leadSource?: string;
      leadStatus?: string;
      leadScore?: number;
      notes?: string;
      primaryEmail?: string;
      primaryPhone?: string;
      secondaryEmail?: string;
      secondaryPhone?: string;
    }>;
  }) => {
    return apiFetch<{ leads: Lead[] }>("/api/v1/leads/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

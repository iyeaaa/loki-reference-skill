import { apiFetch } from "@/lib/api/client";
import type {
  AddGroupMemberRequest,
  BulkAddMembersRequest,
  CreateCustomerGroupRequest,
  CustomerGroup,
  CustomerGroupMember,
  CustomerGroupsParams,
  UpdateCustomerGroupRequest,
} from "../types/customer-group";

export const customerGroupsApi = {
  list: (params?: CustomerGroupsParams) => {
    const searchParams = new URLSearchParams();

    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;

    searchParams.append("limit", limit.toString());
    searchParams.append("offset", offset.toString());

    if (params?.search) searchParams.append("search", params.search);
    if (params?.isDynamic !== undefined && params.isDynamic !== "all") {
      searchParams.append("isDynamic", params.isDynamic.toString());
    }
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","));
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","));
    }

    const query = searchParams.toString();
    return apiFetch<{
      data: CustomerGroup[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/v1/customer-groups/search${query ? `?${query}` : ""}`).then(
      (response) => ({
        customerGroups: response.data,
        total: response.total,
        page,
        limit,
        totalPages: Math.ceil(response.total / limit),
      })
    );
  },

  get: (groupId: string) => {
    return apiFetch<CustomerGroup>(`/api/v1/customer-groups/${groupId}`);
  },

  create: (data: CreateCustomerGroupRequest) => {
    return apiFetch<CustomerGroup>("/api/v1/customer-groups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: (groupId: string, data: UpdateCustomerGroupRequest) => {
    return apiFetch<CustomerGroup>(`/api/v1/customer-groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: (groupId: string) => {
    return apiFetch(`/api/v1/customer-groups/${groupId}`, {
      method: "DELETE",
    });
  },

  // Group members
  getMembers: (groupId: string, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    return apiFetch<{
      data: CustomerGroupMember[];
      total: number;
      limit: number;
      offset: number;
    }>(
      `/api/v1/customer-groups/${groupId}/members?${searchParams.toString()}`
    ).then((response) => ({
      members: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }));
  },

  addMember: (groupId: string, data: AddGroupMemberRequest) => {
    return apiFetch<CustomerGroupMember>(
      `/api/v1/customer-groups/${groupId}/members`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  removeMember: (groupId: string, leadId: string) => {
    return apiFetch(`/api/v1/customer-groups/${groupId}/members/${leadId}`, {
      method: "DELETE",
    });
  },

  bulkAddMembers: (data: BulkAddMembersRequest) => {
    return apiFetch<{ addedCount: number }>(
      `/api/v1/admin/customer-groups/${data.groupId}/members/bulk`,
      {
        method: "POST",
        body: JSON.stringify({
          leadIds: data.leadIds,
          addedBy: data.addedBy,
        }),
      }
    );
  },

  bulkRemoveMembers: (groupId: string, leadIds: string[]) => {
    return apiFetch<{ removedCount: number }>(
      `/api/v1/admin/customer-groups/${groupId}/members/bulk`,
      {
        method: "DELETE",
        body: JSON.stringify({ leadIds }),
      }
    );
  },

  bulkDelete: (groupIds: string[]) => {
    return apiFetch<{ deletedCount: number }>(
      "/api/v1/admin/customer-groups/bulk",
      {
        method: "DELETE",
        body: JSON.stringify({ groupIds }),
      }
    );
  },

  getByWorkspace: (workspaceId: string) => {
    return apiFetch<CustomerGroup[]>(
      `/api/v1/customer-groups/workspace/${workspaceId}`
    );
  },

  getLeadGroups: (leadId: string) => {
    return apiFetch<CustomerGroup[]>(
      `/api/v1/customer-groups/lead/${leadId}/groups`
    );
  },

  // 그룹에 리드 일괄 추가
  bulkAddMembers: (groupId: string, leadIds: string[]) => {
    return apiFetch<{ addedCount: number }>(
      `/api/v1/admin/customer-groups/${groupId}/members/bulk`,
      {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }
    );
  },
};

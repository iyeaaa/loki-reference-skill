import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { customerGroupsApi } from "../services/customer-groups";
import type {
  AddGroupMemberRequest,
  BulkAddMembersRequest,
  CreateCustomerGroupRequest,
  CustomerGroupsParams,
  UpdateCustomerGroupRequest,
} from "../types/customer-group";

// Query Keys
export const customerGroupKeys = {
  all: ["customerGroups"] as const,
  lists: () => [...customerGroupKeys.all, "list"] as const,
  list: (params?: CustomerGroupsParams) =>
    [...customerGroupKeys.lists(), params] as const,
  detail: (id: string) => [...customerGroupKeys.all, "detail", id] as const,
  members: (groupId: string) =>
    [...customerGroupKeys.all, "members", groupId] as const,
  membersList: (groupId: string, page?: number) =>
    [...customerGroupKeys.members(groupId), page] as const,
  workspace: (workspaceId: string) =>
    [...customerGroupKeys.all, "workspace", workspaceId] as const,
  leadGroups: (leadId: string) =>
    [...customerGroupKeys.all, "leadGroups", leadId] as const,
};

// Queries
export function useCustomerGroups(params?: CustomerGroupsParams) {
  return useQuery({
    queryKey: customerGroupKeys.list(params),
    queryFn: () => customerGroupsApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCustomerGroup(groupId: string, enabled = true) {
  return useQuery({
    queryKey: customerGroupKeys.detail(groupId),
    queryFn: () => customerGroupsApi.get(groupId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCustomerGroupMembers(
  groupId: string,
  page = 1,
  limit = 10,
  enabled = true
) {
  return useQuery({
    queryKey: customerGroupKeys.membersList(groupId, page),
    queryFn: () => customerGroupsApi.getMembers(groupId, page, limit),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCustomerGroupsByWorkspace(
  workspaceId: string,
  enabled = true
) {
  return useQuery({
    queryKey: customerGroupKeys.workspace(workspaceId),
    queryFn: () => customerGroupsApi.getByWorkspace(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLeadGroups(leadId: string, enabled = true) {
  return useQuery({
    queryKey: customerGroupKeys.leadGroups(leadId),
    queryFn: () => customerGroupsApi.getLeadGroups(leadId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Mutations
export function useCreateCustomerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomerGroupRequest) =>
      customerGroupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() });
      toast.success("고객 그룹이 생성되었습니다");
    },
    onError: (error: Error) => {
      toast.error(error.message || "고객 그룹 생성에 실패했습니다");
    },
  });
}

export function useUpdateCustomerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: UpdateCustomerGroupRequest;
    }) => customerGroupsApi.update(groupId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.detail(variables.groupId),
      });
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() });
      toast.success("고객 그룹 정보가 업데이트되었습니다");
    },
    onError: (error: Error) => {
      toast.error(error.message || "고객 그룹 업데이트에 실패했습니다");
    },
  });
}

export function useDeleteCustomerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => customerGroupsApi.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() });
      toast.success("고객 그룹이 삭제되었습니다");
    },
    onError: (error: Error) => {
      toast.error(error.message || "고객 그룹 삭제에 실패했습니다");
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: AddGroupMemberRequest;
    }) => customerGroupsApi.addMember(groupId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.members(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.detail(variables.groupId),
      });
      toast.success("그룹에 멤버가 추가되었습니다");
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 추가에 실패했습니다");
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, leadId }: { groupId: string; leadId: string }) =>
      customerGroupsApi.removeMember(groupId, leadId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.members(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.detail(variables.groupId),
      });
      toast.success("그룹에서 멤버가 제거되었습니다");
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 제거에 실패했습니다");
    },
  });
}

export function useBulkAddGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkAddMembersRequest) =>
      customerGroupsApi.bulkAddMembers(data.groupId, data.leadIds),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.members(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.detail(variables.groupId),
      });
      toast.success(`${response.addedCount || 0}명의 멤버가 추가되었습니다`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 추가에 실패했습니다");
    },
  });
}

export function useBulkRemoveGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      leadIds,
    }: {
      groupId: string;
      leadIds: string[];
    }) => customerGroupsApi.bulkRemoveMembers(groupId, leadIds),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.members(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: customerGroupKeys.detail(variables.groupId),
      });
      toast.success(`${response.removedCount || 0}명의 멤버가 제거되었습니다`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 제거에 실패했습니다");
    },
  });
}

export function useBulkDeleteCustomerGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupIds: string[]) => customerGroupsApi.bulkDelete(groupIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() });
      toast.success(
        `${response.deletedCount || 0}개의 고객 그룹이 삭제되었습니다`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "고객 그룹 삭제에 실패했습니다");
    },
  });
}

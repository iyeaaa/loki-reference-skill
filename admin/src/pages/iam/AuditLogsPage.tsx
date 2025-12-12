import { Eye, FileText, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataFilters, type FilterConfig, useFilters } from "@/components/ui/data-filters"
import { type Column, DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useIamAuditLogs } from "@/lib/api/hooks/iam"
import type { IamAuditLog, IamAuditLogsParams } from "@/lib/api/types/iam"
import { IAM_AUDIT_ACTION_LABELS, IAM_TARGET_TYPE_LABELS } from "@/lib/api/types/iam"
import { formatRelativeTime } from "@/lib/date-utils"

const filterConfigs: FilterConfig[] = [
  {
    type: "checkbox",
    key: "action",
    label: "액션",
    options: [
      { value: "policy_created", label: "정책 생성" },
      { value: "policy_updated", label: "정책 수정" },
      { value: "policy_deleted", label: "정책 삭제" },
      { value: "role_created", label: "역할 생성" },
      { value: "role_updated", label: "역할 수정" },
      { value: "role_deleted", label: "역할 삭제" },
      { value: "role_policy_attached", label: "역할 정책 연결" },
      { value: "role_policy_detached", label: "역할 정책 해제" },
      { value: "member_role_granted", label: "멤버 역할 부여" },
      { value: "member_role_revoked", label: "멤버 역할 해제" },
    ],
  },
  {
    type: "checkbox",
    key: "targetType",
    label: "대상 유형",
    options: [
      { value: "policy", label: "정책" },
      { value: "role", label: "역할" },
      { value: "member_role", label: "멤버 역할" },
      { value: "member_policy", label: "멤버 정책" },
      { value: "role_policy", label: "역할 정책" },
    ],
  },
]

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  policy_created: "default",
  policy_updated: "secondary",
  policy_deleted: "destructive",
  role_created: "default",
  role_updated: "secondary",
  role_deleted: "destructive",
  role_policy_attached: "default",
  role_policy_detached: "outline",
  member_role_granted: "default",
  member_role_revoked: "outline",
  member_policy_attached: "default",
  member_policy_detached: "outline",
}

export default function AuditLogsPage() {
  const { filterValues, currentPage, updateFilter, clearFilters, handlePageChange } = useFilters()

  const [viewingLog, setViewingLog] = useState<IamAuditLog | null>(null)

  // Build API params
  const params: IamAuditLogsParams = {
    page: currentPage,
    limit: 20,
    action:
      (filterValues.action as string[])?.length === 1
        ? (filterValues.action as string[])[0]
        : undefined,
    targetType:
      (filterValues.targetType as string[])?.length === 1
        ? (filterValues.targetType as string[])[0]
        : undefined,
  }

  const { data, isFetching, refetch } = useIamAuditLogs(params)

  const logs = data?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const columns: Column<IamAuditLog>[] = [
    {
      key: "action",
      header: "액션",
      width: "120px",
      render: (item) => (
        <Badge variant={ACTION_VARIANTS[item.action] || "secondary"} className="text-xs">
          {IAM_AUDIT_ACTION_LABELS[item.action] || item.action}
        </Badge>
      ),
    },
    {
      key: "targetType",
      header: "대상 유형",
      width: "80px",
      render: (item) => (
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {IAM_TARGET_TYPE_LABELS[item.targetType] || item.targetType}
        </span>
      ),
    },
    {
      key: "targetName",
      header: "대상명",
      minWidth: "140px",
      render: (item) => (
        <div className="max-w-[140px]">
          <div className="font-medium text-sm truncate" title={item.targetName || undefined}>
            {item.targetName || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "targetId",
      header: "대상 ID",
      width: "90px",
      render: (item) => (
        <span className="text-xs text-gray-400 font-mono" title={item.targetId}>
          {item.targetId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "user",
      header: "실행자",
      minWidth: "100px",
      render: (item) => (
        <div className="max-w-[100px]">
          <div className="text-sm truncate" title={item.user?.username}>
            {item.user?.username || "시스템"}
          </div>
        </div>
      ),
    },
    {
      key: "workspace",
      header: "워크스페이스",
      width: "100px",
      render: (item) => (
        <span
          className="text-xs text-gray-500 truncate block max-w-[100px]"
          title={item.workspace?.name}
        >
          {item.workspace?.name || "-"}
        </span>
      ),
    },
    {
      key: "ipAddress",
      header: "IP",
      width: "110px",
      render: (item) => (
        <span className="text-xs text-gray-500 font-mono">{item.ipAddress || "-"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "시간",
      width: "80px",
      render: (item) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatRelativeTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "50px",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewingLog(item)}
          className="h-7 w-7 p-0"
          title="상세 보기"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <DataFilters
        filters={filterConfigs}
        values={filterValues}
        onChange={updateFilter}
        onClear={clearFilters}
      />

      {/* Audit Logs Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg">감사 로그</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <DataTable
            data={logs}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            onPageChange={handlePageChange}
            emptyMessage="아직 기록된 로그가 없어요"
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">감사 로그 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {viewingLog && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">액션</span>
                    <p className="mt-1">
                      <Badge variant={ACTION_VARIANTS[viewingLog.action] || "secondary"}>
                        {IAM_AUDIT_ACTION_LABELS[viewingLog.action] || viewingLog.action}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">대상 유형</span>
                    <p className="mt-1 text-sm">
                      {IAM_TARGET_TYPE_LABELS[viewingLog.targetType] || viewingLog.targetType}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">대상명</span>
                    <p className="mt-1 font-medium">{viewingLog.targetName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">대상 ID</span>
                    <p className="mt-1 text-sm font-mono text-gray-600">{viewingLog.targetId}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">실행자</span>
                    <p className="mt-1 text-sm">{viewingLog.user?.username || "시스템"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">워크스페이스</span>
                    <p className="mt-1 text-sm">{viewingLog.workspace?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">IP 주소</span>
                    <p className="mt-1 text-sm font-mono">{viewingLog.ipAddress || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">시간</span>
                    <p className="mt-1 text-sm">
                      {new Date(viewingLog.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                {/* User Agent */}
                {viewingLog.userAgent && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">User Agent</span>
                    <p className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded break-all">
                      {viewingLog.userAgent}
                    </p>
                  </div>
                )}

                {/* Old Value */}
                {viewingLog.oldValue && Object.keys(viewingLog.oldValue).length > 0 && (
                  <div className="pt-4 border-t">
                    <span className="text-sm font-medium text-gray-500">변경 전</span>
                    <pre className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(viewingLog.oldValue, null, 2)}
                    </pre>
                  </div>
                )}

                {/* New Value */}
                {viewingLog.newValue && Object.keys(viewingLog.newValue).length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">변경 후</span>
                    <pre className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(viewingLog.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { Mail, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useDeleteEmailAccount,
  useEmailAccountsByWorkspace,
  useSetEmailAccountAsDefault,
} from "@/lib/api/hooks/email-accounts"
import { AddEmailAccountDialog } from "./AddEmailAccountDialog"

interface WorkspaceEmailAccountsSectionProps {
  workspaceId: string
  isEdit: boolean
}

export function WorkspaceEmailAccountsSection({
  workspaceId,
  isEdit,
}: WorkspaceEmailAccountsSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: emailAccounts = [], isLoading } = useEmailAccountsByWorkspace(workspaceId, isEdit)
  const deleteEmailAccount = useDeleteEmailAccount()
  const setAsDefault = useSetEmailAccountAsDefault()

  const handleSetAsDefault = (accountId: string, userId: string) => {
    setAsDefault.mutate({
      accountId,
      data: {
        userId,
        workspaceId,
      },
    })
  }

  const handleDelete = (accountId: string, emailAddress: string) => {
    if (!confirm(`${emailAddress} 이메일 계정을 삭제하시겠습니까?`)) return
    deleteEmailAccount.mutate(accountId)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "inactive":
        return "secondary"
      case "error":
        return "destructive"
      case "rate_limited":
        return "outline"
      case "suspended":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "활성"
      case "inactive":
        return "비활성"
      case "error":
        return "오류"
      case "rate_limited":
        return "전송제한"
      case "suspended":
        return "중단됨"
      default:
        return status
    }
  }

  if (!isEdit) {
    return (
      <Card className="p-4 bg-gray-50">
        <p className="text-sm text-gray-600">
          워크스페이스 생성 후 이메일 계정을 추가할 수 있습니다.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="text-lg font-semibold">이메일 계정 관리</h3>
        </div>
        <Button type="button" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          이메일 계정 추가
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-gray-600">로딩 중...</p>
        </Card>
      ) : emailAccounts.length === 0 ? (
        <Card className="p-4 bg-gray-50">
          <p className="text-sm text-gray-600">
            등록된 이메일 계정이 없습니다. 이메일 발송을 위해 계정을 추가해주세요.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사용자</TableHead>
                <TableHead>이메일 주소</TableHead>
                <TableHead>표시 이름</TableHead>
                <TableHead>인증 상태</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>기본 계정</TableHead>
                <TableHead>발송 수 (일/월)</TableHead>
                <TableHead className="w-[80px]">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.username}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{account.emailAddress}</span>
                  </TableCell>
                  <TableCell>{account.displayName || "-"}</TableCell>
                  <TableCell>
                    {account.isVerified ? (
                      <Badge variant="default">인증됨</Badge>
                    ) : (
                      <Badge variant="secondary">미인증</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(account.status)}>
                      {getStatusLabel(account.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {account.isDefault ? (
                      <Badge variant="default">기본</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetAsDefault(account.id, account.userId)}
                        className="h-6 px-2 text-xs"
                      >
                        기본으로 설정
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {account.dailySentCount || 0}
                      {account.dailyLimit && ` / ${account.dailyLimit}`} |{" "}
                      {account.monthlySentCount || 0}
                      {account.monthlyLimit && ` / ${account.monthlyLimit}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(account.id, account.emailAddress)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddEmailAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        workspaceId={workspaceId}
      />
    </div>
  )
}

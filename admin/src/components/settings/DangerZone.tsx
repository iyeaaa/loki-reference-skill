import { AlertTriangle, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type DangerZoneProps = {
  canDelete: boolean
  workspacesRequiringTransfer: Array<{ id: string; name: string; memberCount: number }>
  workspacesToBeDeleted: Array<{ id: string; name: string }>
  onDeleteAccount: () => void
  isDeleting: boolean
}

export function DangerZone({
  canDelete,
  workspacesRequiringTransfer,
  workspacesToBeDeleted,
  onDeleteAccount,
  isDeleting,
}: DangerZoneProps) {
  const { t } = useTranslation()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  return (
    <div className="mt-8 rounded-lg border border-red-200 bg-red-50/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-lg text-red-600">
          {t("settings.dangerZone.title", "위험 구역")}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900">
            {t("settings.dangerZone.deleteAccount", "계정 삭제")}
          </h4>
          <p className="mt-1 text-gray-600 text-sm">
            {t(
              "settings.dangerZone.deleteWarning",
              "계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
            )}
          </p>
        </div>

        {/* Workspaces requiring ownership transfer */}
        {workspacesRequiringTransfer.length > 0 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
            <p className="mb-2 font-medium text-sm text-yellow-800">
              {t(
                "settings.dangerZone.ownershipWarning",
                "계정을 삭제하기 전에 소유한 워크스페이스의 소유권을 이전해야 합니다.",
              )}
            </p>
            <ul className="list-inside list-disc text-sm text-yellow-700">
              {workspacesRequiringTransfer.map((ws) => (
                <li key={ws.id}>
                  {ws.name}{" "}
                  <span className="text-yellow-600">
                    ({ws.memberCount}
                    {t("settings.dangerZone.members", "명의 멤버")})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Workspaces that will be deleted */}
        {workspacesToBeDeleted.length > 0 && canDelete && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-4">
            <p className="mb-2 font-medium text-orange-800 text-sm">
              {t(
                "settings.dangerZone.workspaceDeletionWarning",
                "다음 워크스페이스도 함께 삭제됩니다:",
              )}
            </p>
            <ul className="list-inside list-disc text-orange-700 text-sm">
              {workspacesToBeDeleted.map((ws) => (
                <li key={ws.id}>{ws.name}</li>
              ))}
            </ul>
          </div>
        )}

        <Button
          className="gap-2"
          disabled={!canDelete || isDeleting}
          onClick={() => setShowConfirmDialog(true)}
          variant="destructive"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting
            ? t("settings.dangerZone.deleting", "삭제 중...")
            : t("settings.dangerZone.deleteButton", "계정 삭제")}
        </Button>
      </div>

      <ConfirmDialog
        cancelText={t("common.cancel", "취소")}
        confirmText={t("settings.dangerZone.confirmButton", "계정 삭제")}
        description={
          workspacesToBeDeleted.length > 0
            ? t(
                "settings.dangerZone.confirmDescriptionWithWorkspaces",
                "정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 계정과 함께 {{count}}개의 워크스페이스도 삭제됩니다.",
                { count: workspacesToBeDeleted.length },
              )
            : t(
                "settings.dangerZone.confirmDescription",
                "정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.",
              )
        }
        onConfirm={onDeleteAccount}
        onOpenChange={setShowConfirmDialog}
        open={showConfirmDialog}
        title={t("settings.dangerZone.confirmTitle", "계정 삭제")}
        variant="destructive"
      />
    </div>
  )
}

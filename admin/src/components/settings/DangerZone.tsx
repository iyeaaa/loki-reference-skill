import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Mail,
  Shield,
  Trash2,
  Users,
  UserX,
  Workflow,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DangerZoneProps = {
  canDelete: boolean
  workspacesRequiringTransfer: Array<{ id: string; name: string; memberCount: number }>
  workspacesToBeDeleted: Array<{ id: string; name: string }>
  onDeleteAccount: () => void
  isDeleting: boolean
}

const CONFIRMATION_TEXT = "삭제합니다"

export function DangerZone({
  canDelete,
  workspacesRequiringTransfer,
  workspacesToBeDeleted,
  onDeleteAccount,
  isDeleting,
}: DangerZoneProps) {
  const { t } = useTranslation()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState("")

  const isConfirmationValid = confirmationInput === CONFIRMATION_TEXT

  const handleConfirm = () => {
    if (isConfirmationValid) {
      onDeleteAccount()
      setShowConfirmDialog(false)
      setConfirmationInput("")
    }
  }

  const handleOpenChange = (open: boolean) => {
    setShowConfirmDialog(open)
    if (!open) {
      setConfirmationInput("")
    }
  }

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

      <AlertDialog onOpenChange={handleOpenChange} open={showConfirmDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("settings.dangerZone.confirmTitle", "계정 삭제 확인")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-gray-700">
                  {t(
                    "settings.dangerZone.confirmDescription",
                    "계정 삭제를 진행하면 다음과 같은 데이터가 순차적으로 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
                  )}
                </p>

                {/* 삭제 프로세스 설명 */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 font-medium text-gray-900 text-sm">
                    {t("settings.dangerZone.deletionProcess", "삭제 프로세스")}
                  </h4>

                  <div className="space-y-3">
                    {/* Phase 1 */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Mail className="h-4 w-4 text-gray-500" />
                          {t("settings.dangerZone.phase1Title", "이메일 연동 해제")}
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {t(
                            "settings.dangerZone.phase1Desc",
                            "Nylas 이메일 연동이 해제되고 모든 이메일 계정 연결이 끊어집니다.",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Phase 2 */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                        2
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Database className="h-4 w-4 text-gray-500" />
                          {t("settings.dangerZone.phase2Title", "워크스페이스 데이터 삭제")}
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {t(
                            "settings.dangerZone.phase2Desc",
                            "소유한 워크스페이스의 모든 데이터가 삭제됩니다: 리드, 시퀀스, 이메일, 고객 그룹, 웹셋, 템플릿 등",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Phase 3 */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                        3
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Users className="h-4 w-4 text-gray-500" />
                          {t("settings.dangerZone.phase3Title", "멤버십 정리")}
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {t(
                            "settings.dangerZone.phase3Desc",
                            "다른 워크스페이스의 멤버십, 역할 할당, 시퀀스 등록 정보가 삭제됩니다.",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Phase 4 */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                        4
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Shield className="h-4 w-4 text-gray-500" />
                          {t("settings.dangerZone.phase4Title", "참조 데이터 정리")}
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {t(
                            "settings.dangerZone.phase4Desc",
                            "다른 사용자가 생성한 데이터에서 생성자 정보가 익명화됩니다.",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Phase 5 */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                        5
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <UserX className="h-4 w-4 text-gray-500" />
                          {t("settings.dangerZone.phase5Title", "계정 완전 삭제")}
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {t(
                            "settings.dangerZone.phase5Desc",
                            "사용자 계정이 시스템에서 완전히 삭제됩니다.",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 삭제될 워크스페이스 목록 */}
                {workspacesToBeDeleted.length > 0 && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-center gap-2 font-medium text-orange-800 text-sm">
                      <Workflow className="h-4 w-4" />
                      {t(
                        "settings.dangerZone.workspacesDeleted",
                        "함께 삭제될 워크스페이스 ({{count}}개)",
                        { count: workspacesToBeDeleted.length },
                      )}
                    </div>
                    <ul className="mt-2 list-inside list-disc text-orange-700 text-sm">
                      {workspacesToBeDeleted.map((ws) => (
                        <li key={ws.id}>{ws.name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 백업 안내 */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 font-medium text-blue-800 text-sm">
                    <Database className="h-4 w-4" />
                    {t("settings.dangerZone.backupNotice", "데이터 백업 안내")}
                  </div>
                  <p className="mt-1 text-blue-700 text-xs">
                    {t(
                      "settings.dangerZone.backupNoticeDesc",
                      "서버 데이터는 매일 자동 백업되며, 배포 시마다 추가 백업이 생성됩니다. 계정 삭제 후에도 관리자 문의 시 일정 기간 내 복구가 가능할 수 있습니다.",
                    )}
                  </p>
                </div>

                {/* 확인 입력 */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm" htmlFor="confirmation-input">
                    {t(
                      "settings.dangerZone.confirmInputLabel",
                      '삭제를 진행하려면 아래에 "{{text}}"를 입력하세요.',
                      { text: CONFIRMATION_TEXT },
                    )}
                  </Label>
                  <Input
                    autoComplete="off"
                    className={
                      confirmationInput.length > 0
                        ? isConfirmationValid
                          ? "border-green-500 focus-visible:ring-green-500"
                          : "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }
                    id="confirmation-input"
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={CONFIRMATION_TEXT}
                    value={confirmationInput}
                  />
                  {confirmationInput.length > 0 && (
                    <div
                      className={`flex items-center gap-1 text-xs ${isConfirmationValid ? "text-green-600" : "text-red-600"}`}
                    >
                      {isConfirmationValid ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          {t("settings.dangerZone.confirmInputValid", "확인 완료")}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          {t("settings.dangerZone.confirmInputInvalid", "정확히 입력해주세요")}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!isConfirmationValid || isDeleting}
              onClick={handleConfirm}
            >
              {isDeleting ? (
                t("settings.dangerZone.deleting", "삭제 중...")
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("settings.dangerZone.confirmButton", "계정 영구 삭제")}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
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
import { cn } from "@/lib/utils"

type DangerZoneProps = {
  canDelete: boolean
  workspacesRequiringTransfer: Array<{ id: string; name: string; memberCount: number }>
  workspacesToBeDeleted: Array<{ id: string; name: string }>
  onDeleteAccount: () => void
  isDeleting: boolean
  userEmail?: string
  userName?: string
}

export function DangerZone({
  canDelete,
  workspacesRequiringTransfer,
  workspacesToBeDeleted,
  onDeleteAccount,
  isDeleting,
  userEmail,
  userName,
}: DangerZoneProps) {
  const { t } = useTranslation()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState("")
  const [copied, setCopied] = useState(false)

  // 확인 텍스트: 이메일이 있으면 이메일, 없으면 기본 텍스트
  const confirmationText = userEmail || "삭제합니다"

  const isConfirmationValid = confirmationInput === confirmationText

  const handleCopy = async () => {
    await navigator.clipboard.writeText(confirmationText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      setCopied(false)
    }
  }

  const deletionPhases = [
    {
      icon: Mail,
      title: t("settings.dangerZone.phase1Title", "이메일 연동 해제"),
      desc: t(
        "settings.dangerZone.phase1Desc",
        "Nylas 이메일 연동이 해제되고 모든 이메일 계정 연결이 끊어집니다.",
      ),
    },
    {
      icon: Database,
      title: t("settings.dangerZone.phase2Title", "워크스페이스 데이터 삭제"),
      desc: t(
        "settings.dangerZone.phase2Desc",
        "소유한 워크스페이스의 모든 데이터가 삭제됩니다: 리드, 시퀀스, 이메일, 고객 그룹, 웹셋, 템플릿 등",
      ),
    },
    {
      icon: Users,
      title: t("settings.dangerZone.phase3Title", "멤버십 정리"),
      desc: t(
        "settings.dangerZone.phase3Desc",
        "다른 워크스페이스의 멤버십, 역할 할당, 시퀀스 등록 정보가 삭제됩니다.",
      ),
    },
    {
      icon: Shield,
      title: t("settings.dangerZone.phase4Title", "참조 데이터 정리"),
      desc: t(
        "settings.dangerZone.phase4Desc",
        "다른 사용자가 생성한 데이터에서 생성자 정보가 익명화됩니다.",
      ),
    },
    {
      icon: UserX,
      title: t("settings.dangerZone.phase5Title", "계정 완전 삭제"),
      desc: t("settings.dangerZone.phase5Desc", "사용자 계정이 시스템에서 완전히 삭제됩니다."),
    },
  ]

  return (
    <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <h3 className="font-semibold text-destructive text-lg">
          {t("settings.dangerZone.title", "위험 구역")}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-foreground">
            {t("settings.dangerZone.deleteAccount", "계정 삭제")}
          </h4>
          <p className="mt-1 text-muted-foreground text-sm">
            {t(
              "settings.dangerZone.deleteWarning",
              "계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
            )}
          </p>
        </div>

        {/* Workspaces requiring ownership transfer */}
        {workspacesRequiringTransfer.length > 0 && (
          <div className="rounded-lg border border-yellow-300/50 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-950/30">
            <p className="mb-2 font-medium text-sm text-yellow-800 dark:text-yellow-200">
              {t(
                "settings.dangerZone.ownershipWarning",
                "계정을 삭제하기 전에 소유한 워크스페이스의 소유권을 이전해야 합니다.",
              )}
            </p>
            <ul className="list-inside list-disc text-sm text-yellow-700 dark:text-yellow-300">
              {workspacesRequiringTransfer.map((ws) => (
                <li key={ws.id}>
                  {ws.name}{" "}
                  <span className="text-yellow-600 dark:text-yellow-400">
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
          <div className="rounded-lg border border-orange-300/50 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-950/30">
            <p className="mb-2 font-medium text-orange-800 text-sm dark:text-orange-200">
              {t(
                "settings.dangerZone.workspaceDeletionWarning",
                "다음 워크스페이스도 함께 삭제됩니다:",
              )}
            </p>
            <ul className="list-inside list-disc text-orange-700 text-sm dark:text-orange-300">
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
        <AlertDialogContent className="gap-0 p-0 sm:max-w-3xl">
          {/* Header */}
          <AlertDialogHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-destructive">
                  {t("settings.dangerZone.confirmTitle", "계정 삭제 확인")}
                </AlertDialogTitle>
                {userName && (
                  <p className="mt-0.5 text-muted-foreground text-sm">
                    {userName}님의 계정을 삭제하려고 합니다
                  </p>
                )}
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription asChild>
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
              {/* Warning Message */}
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-foreground text-sm">
                  {t(
                    "settings.dangerZone.confirmDescription",
                    "계정 삭제를 진행하면 다음과 같은 데이터가 순차적으로 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
                  )}
                </p>
              </div>

              {/* Deletion Process */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-4 flex items-center gap-2 font-medium text-foreground text-sm">
                  <Workflow className="h-4 w-4" />
                  {t("settings.dangerZone.deletionProcess", "삭제 프로세스")}
                </h4>

                <div className="space-y-3">
                  {deletionPhases.map((phase, index) => (
                    <div className="flex items-start gap-3" key={index}>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 font-medium text-destructive text-xs">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
                          <phase.icon className="h-4 w-4 text-muted-foreground" />
                          {phase.title}
                        </div>
                        <p className="mt-0.5 text-muted-foreground text-xs">{phase.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workspaces to be deleted */}
              {workspacesToBeDeleted.length > 0 && (
                <div className="rounded-lg border border-orange-300/50 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-950/30">
                  <div className="flex items-center gap-2 font-medium text-orange-800 text-sm dark:text-orange-200">
                    <Workflow className="h-4 w-4" />
                    {t(
                      "settings.dangerZone.workspacesDeleted",
                      "함께 삭제될 워크스페이스 ({{count}}개)",
                      { count: workspacesToBeDeleted.length },
                    )}
                  </div>
                  <ul className="mt-2 list-inside list-disc text-orange-700 text-sm dark:text-orange-300">
                    {workspacesToBeDeleted.map((ws) => (
                      <li key={ws.id}>{ws.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Backup Notice */}
              <div className="rounded-lg border border-blue-300/50 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-950/30">
                <div className="flex items-center gap-2 font-medium text-blue-800 text-sm dark:text-blue-200">
                  <Database className="h-4 w-4" />
                  {t("settings.dangerZone.backupNotice", "데이터 백업 안내")}
                </div>
                <p className="mt-1 text-blue-700 text-xs dark:text-blue-300">
                  {t(
                    "settings.dangerZone.backupNoticeDesc",
                    "서버 데이터는 매일 자동 백업되며, 배포 시마다 추가 백업이 생성됩니다. 계정 삭제 후에도 관리자 문의 시 일정 기간 내 복구가 가능할 수 있습니다.",
                  )}
                </p>
              </div>

              {/* Confirmation Input Section */}
              <div className="rounded-lg border-2 border-destructive/30 border-dashed bg-destructive/5 p-4">
                <p className="mb-3 text-center text-foreground text-sm">
                  {userEmail
                    ? t(
                        "settings.dangerZone.confirmInputLabelEmail",
                        "삭제를 확인하려면 아래에 본인의 이메일 주소를 입력하세요",
                      )
                    : t(
                        "settings.dangerZone.confirmInputLabel",
                        '삭제를 진행하려면 아래에 "{{text}}"를 입력하세요.',
                        { text: confirmationText },
                      )}
                </p>

                {/* Confirmation text with copy button */}
                <div className="mb-3 flex items-center justify-center gap-2 rounded-lg border bg-background p-2">
                  <code className="flex-1 select-all text-center font-mono text-destructive text-sm">
                    {confirmationText}
                  </code>
                  <Button
                    className="h-8 w-8 shrink-0"
                    onClick={handleCopy}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                {/* Input field */}
                <Input
                  autoComplete="off"
                  className={cn(
                    "text-center font-mono transition-colors",
                    confirmationInput.length > 0 &&
                      (isConfirmationValid
                        ? "border-green-500 focus-visible:ring-green-500"
                        : "border-destructive focus-visible:ring-destructive"),
                  )}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={confirmationText}
                  value={confirmationInput}
                />

                {/* Validation feedback */}
                {confirmationInput.length > 0 && (
                  <div
                    className={cn(
                      "mt-2 flex items-center justify-center gap-1 text-xs",
                      isConfirmationValid ? "text-green-600" : "text-destructive",
                    )}
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

          {/* Footer */}
          <AlertDialogFooter className="border-t px-6 py-4">
            <AlertDialogCancel disabled={isDeleting}>
              {t("common.cancel", "취소")}
            </AlertDialogCancel>
            <Button
              className="gap-2"
              disabled={!isConfirmationValid || isDeleting}
              onClick={handleConfirm}
              variant="destructive"
            >
              {isDeleting ? (
                t("settings.dangerZone.deleting", "삭제 중...")
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
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

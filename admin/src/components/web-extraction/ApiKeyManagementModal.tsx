import { motion } from "framer-motion"
import { Copy, Gauge, Key, Plus, Sparkles, Trash2, TrendingUp, Zap } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"
import { formatDate } from "@/utils/web-extraction.utils"

type ApiKeyManagementModalProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  apiKeys: ApiKey[]
  activeApiKeysCount: number
  isProcessing: boolean
  onToggleActive: (key: ApiKey) => void
  onDeleteApiKey: (id: string) => void
  onAddApiKey: () => void
  isUpdating: boolean
  isDeleting: boolean
}

/**
 * API Key Management Modal Component
 */
export function ApiKeyManagementModal({
  isOpen,
  onOpenChange,
  apiKeys,
  activeApiKeysCount,
  isProcessing,
  onToggleActive,
  onDeleteApiKey,
  onAddApiKey,
  isUpdating,
  isDeleting,
}: ApiKeyManagementModalProps) {
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)

  const handleCopyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey)
      toast.success("API 키가 클립보드에 복사되었습니다")
    } catch (_error) {
      toast.error("복사에 실패했습니다")
    }
  }

  const handleDeleteClick = (key: ApiKey) => {
    setDeleteTarget(key)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return
    }
    await onDeleteApiKey(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <TooltipProvider>
      <Dialog
        onOpenChange={(open) => {
          if (!isProcessing) {
            onOpenChange(open)
          }
        }}
        open={isOpen}
      >
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>API 키 관리</DialogTitle>
            <DialogDescription>OpenAI API 키를 관리하여 처리 속도를 최적화하세요</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {/* Speed Boost Banner */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 shadow-lg"
              initial={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_50%)]" />
              </div>

              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    className="flex-shrink-0"
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                      <Zap className="h-8 w-8 text-white" fill="currentColor" />
                    </div>
                  </motion.div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h3 className="font-bold text-foreground text-lg">
                        API KEY 추가할수록{" "}
                        <motion.span
                          animate={{ scale: 1, rotate: 0 }}
                          className="inline-block text-primary"
                          initial={{ scale: 0, rotate: -180 }}
                          key={activeApiKeysCount}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 10,
                          }}
                        >
                          {activeApiKeysCount || 1}배
                        </motion.span>{" "}
                        빨라져요!
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <p className="text-foreground/90 text-sm">
                        <span className="font-semibold text-primary">
                          계정별로 구분된 API KEY가 필요해요.
                        </span>{" "}
                        API KEY 1개당 <span className="font-semibold text-primary">20개씩</span>{" "}
                        동시 처리 가능해요. 추가할수록 처리 속도가{" "}
                        <span className="font-bold text-primary">배수로 증가</span>해요!
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <motion.div
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2"
                          initial={{ opacity: 0, x: -20 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Gauge className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">
                            현재: <span className="text-primary">{activeApiKeysCount * 20}개</span>{" "}
                            동시 처리
                          </span>
                        </motion.div>

                        {activeApiKeysCount > 0 && (
                          <motion.div
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            transition={{ delay: 0.3, type: "spring" }}
                          >
                            <Sparkles className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-700 text-sm dark:text-green-400">
                              {activeApiKeysCount}배 속도 향상!
                            </span>
                          </motion.div>
                        )}
                      </div>

                      <motion.div
                        animate={{ opacity: 1 }}
                        className="mt-3 rounded-lg bg-muted/50 p-3"
                        initial={{ opacity: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <p className="mb-1 font-medium text-muted-foreground text-xs">💡 예시:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded bg-background px-2 py-1">
                            1개 = 20개 동시 처리
                          </span>
                          <span className="rounded bg-background px-2 py-1">
                            2개 = 40개 (2배 빠름)
                          </span>
                          <span className="rounded bg-background px-2 py-1">
                            5개 = 100개 (5배 빠름)
                          </span>
                          <span className="rounded bg-background px-2 py-1">
                            10개 = 200개 (10배 빠름)
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shine effect */}
              <motion.div
                animate={{ x: "200%" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: 2,
                  ease: "easeInOut",
                }}
              />
            </motion.div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">API 키 목록</CardTitle>
                    <CardDescription className="mt-1">
                      활성 키{" "}
                      <span className="font-semibold text-primary">{activeApiKeysCount}개</span> ·
                      동시 처리{" "}
                      <span className="font-semibold text-primary">
                        {activeApiKeysCount * 20}개
                      </span>{" "}
                      가능
                    </CardDescription>
                  </div>
                  <Button disabled={isProcessing} onClick={onAddApiKey} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    추가
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {apiKeys.length === 0 ? (
                  <div className="py-12 text-center">
                    <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="mb-1 font-medium text-base">등록된 API 키가 없습니다</p>
                    <p className="mb-4 text-muted-foreground text-sm">
                      서버의 환경 변수에 설정된 기본 키가 사용됩니다
                    </p>
                    <Button
                      disabled={isProcessing}
                      onClick={onAddApiKey}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />첫 API 키 추가하기
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead>API 키</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>사용 정보</TableHead>
                          <TableHead className="w-32 text-right">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key, index) => (
                          <TableRow className={key.isActive ? "" : "opacity-60"} key={key.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium">{key.name}</div>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="flex items-center gap-2">
                                <code className="break-all font-mono text-muted-foreground text-xs">
                                  {key.apiKey}
                                </code>
                                <div className="flex flex-shrink-0 items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        className="h-6 w-6"
                                        onClick={() => handleCopyApiKey(key.apiKey)}
                                        size="icon"
                                        variant="ghost"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>복사</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={key.isActive}
                                  disabled={isUpdating}
                                  onCheckedChange={() => onToggleActive(key)}
                                />
                                <Badge
                                  className="text-xs"
                                  variant={key.isActive ? "default" : "secondary"}
                                >
                                  {key.isActive ? "활성" : "비활성"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 text-muted-foreground text-xs">
                                <div>
                                  <span className="font-medium">마지막 사용:</span>{" "}
                                  {formatDate(key.lastUsedAt)}
                                </div>
                                <div>
                                  <span className="font-medium">사용 횟수:</span> {key.usageCount}회
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      className="h-8 w-8"
                                      disabled={isDeleting}
                                      onClick={() => handleDeleteClick(key)}
                                      size="icon"
                                      variant="ghost"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>삭제</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        confirmText={deleteTarget?.name || ""}
        description="이 작업은 되돌릴 수 없습니다. API 키가 영구적으로 삭제됩니다."
        isLoading={isDeleting}
        itemName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={!!deleteTarget}
        title="API 키 삭제"
      />
    </TooltipProvider>
  )
}

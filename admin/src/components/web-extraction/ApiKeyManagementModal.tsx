import { motion } from "framer-motion"
import { Copy, Gauge, Key, Plus, Sparkles, Trash2, TrendingUp, Zap } from "lucide-react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface ApiKeyManagementModalProps {
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
  const handleCopyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey)
      toast.success("API 키가 클립보드에 복사되었습니다")
    } catch (_error) {
      toast.error("복사에 실패했습니다")
    }
  }

  return (
    <TooltipProvider>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isProcessing) {
            onOpenChange(open)
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>API 키 관리</DialogTitle>
            <DialogDescription>OpenAI API 키를 관리하여 처리 속도를 최적화하세요</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Speed Boost Banner */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 shadow-lg"
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
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                    className="flex-shrink-0"
                  >
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                      <Zap className="h-8 w-8 text-white" fill="currentColor" />
                    </div>
                  </motion.div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-bold text-foreground">
                        API KEY 추가할수록{" "}
                        <motion.span
                          key={activeApiKeysCount}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 10,
                          }}
                          className="inline-block text-primary"
                        >
                          {activeApiKeysCount || 1}배
                        </motion.span>{" "}
                        빨라져요!
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-foreground/90">
                        <span className="font-semibold text-primary">
                          계정별로 구분된 API KEY가 필요해요.
                        </span>{" "}
                        API KEY 1개당 <span className="font-semibold text-primary">20개씩</span>{" "}
                        동시 처리 가능해요. 추가할수록 처리 속도가{" "}
                        <span className="font-bold text-primary">배수로 증가</span>해요!
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2"
                        >
                          <Gauge className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">
                            현재: <span className="text-primary">{activeApiKeysCount * 20}개</span>{" "}
                            동시 처리
                          </span>
                        </motion.div>

                        {activeApiKeysCount > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2"
                          >
                            <Sparkles className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                              {activeApiKeysCount}배 속도 향상!
                            </span>
                          </motion.div>
                        )}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="rounded-lg bg-muted/50 p-3 mt-3"
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-1">💡 예시:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-background">
                            1개 = 20개 동시 처리
                          </span>
                          <span className="px-2 py-1 rounded bg-background">
                            2개 = 40개 (2배 빠름)
                          </span>
                          <span className="px-2 py-1 rounded bg-background">
                            5개 = 100개 (5배 빠름)
                          </span>
                          <span className="px-2 py-1 rounded bg-background">
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
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
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
                  <Button onClick={onAddApiKey} size="sm" disabled={isProcessing}>
                    <Plus className="mr-2 h-4 w-4" />
                    추가
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {apiKeys.length === 0 ? (
                  <div className="text-center py-12">
                    <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="font-medium text-base mb-1">등록된 API 키가 없습니다</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      서버의 환경 변수에 설정된 기본 키가 사용됩니다
                    </p>
                    <Button
                      onClick={onAddApiKey}
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
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
                          <TableHead className="text-right w-32">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key, index) => {
                          return (
                            <TableRow key={key.id} className={key.isActive ? "" : "opacity-60"}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium">{key.name}</div>
                              </TableCell>
                              <TableCell className="max-w-md">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono text-muted-foreground break-all">
                                    {key.apiKey}
                                  </code>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleCopyApiKey(key.apiKey)}
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
                                    onCheckedChange={() => onToggleActive(key)}
                                    disabled={isUpdating}
                                  />
                                  <Badge
                                    variant={key.isActive ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {key.isActive ? "활성" : "비활성"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5 text-xs text-muted-foreground">
                                  <div>
                                    <span className="font-medium">마지막 사용:</span>{" "}
                                    {formatDate(key.lastUsedAt)}
                                  </div>
                                  <div>
                                    <span className="font-medium">사용 횟수:</span> {key.usageCount}
                                    회
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onDeleteApiKey(key.id)}
                                        disabled={isDeleting}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>삭제</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

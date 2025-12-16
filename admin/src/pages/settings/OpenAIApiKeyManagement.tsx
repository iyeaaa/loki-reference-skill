import { Key, Plus, Save, Trash2, X } from "lucide-react"
import { useId, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useCreateApiKey,
  useDeleteApiKey,
  useOpenAIApiKeys,
  useUpdateApiKey,
} from "@/lib/api/hooks/openai-api-keys"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"

export function OpenAIApiKeyManagement() {
  const keyNameId = useId()
  const apiKeyId = useId()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  const [formData, setFormData] = useState({
    name: "",
    apiKey: "",
  })

  // Use TanStack Query hooks
  const { data: apiKeys = [], isLoading } = useOpenAIApiKeys(workspaceId)
  const createMutation = useCreateApiKey()
  const updateMutation = useUpdateApiKey()
  const deleteMutation = useDeleteApiKey()

  const handleOpenDialog = (key?: ApiKey) => {
    if (key) {
      setEditingKey(key)
      setFormData({
        name: key.name,
        apiKey: "", // Don't show existing key when editing
      })
    } else {
      setEditingKey(null)
      setFormData({
        name: "",
        apiKey: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingKey(null)
    setFormData({
      name: "",
      apiKey: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(workspaceId && formData.name.trim())) {
      return
    }

    if (!(editingKey || formData.apiKey.trim())) {
      return
    }

    if (editingKey) {
      // Update existing key
      await updateMutation.mutateAsync({
        id: editingKey.id,
        data: {
          workspaceId,
          name: formData.name,
          ...(formData.apiKey.trim() && { apiKey: formData.apiKey }),
        },
      })
    } else {
      // Create new key
      await createMutation.mutateAsync({
        workspaceId,
        name: formData.name,
        apiKey: formData.apiKey,
      })
    }

    handleCloseDialog()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 API 키를 삭제하시겠습니까?")) {
      return
    }

    await deleteMutation.mutateAsync({ id, workspaceId })
  }

  const handleToggleActive = async (key: ApiKey) => {
    await updateMutation.mutateAsync({
      id: key.id,
      data: {
        workspaceId,
        isActive: !key.isActive,
      },
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return "사용 안함"
    }
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR")
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OpenAI API 키 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">로딩 중...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenAI API 키 관리
            </CardTitle>
            <CardDescription className="mt-2">
              웹 데이터 추출에 사용할 OpenAI API 키를 관리합니다. 여러 개의 키를 추가하면 순차적으로
              사용됩니다.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            API 키 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>등록된 API 키가 없습니다</p>
            <p className="mt-2 text-sm">
              API 키를 추가하지 않으면 서버의 환경 변수에 설정된 기본 키가 사용됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key, index) => (
              <div
                className={`rounded-lg border p-4 ${key.isActive ? "bg-background" : "bg-muted/50 opacity-60"}`}
                key={key.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-sm">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold">{key.name}</h3>
                      {key.isActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-800 text-xs dark:bg-gray-800 dark:text-gray-300">
                          비활성
                        </span>
                      )}
                    </div>

                    <div className="mb-2 flex items-center gap-2 font-mono text-muted-foreground text-sm">
                      <span>{key.apiKey}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 text-muted-foreground text-sm">
                      <div>
                        <span className="font-medium">마지막 사용:</span>{" "}
                        {formatDate(key.lastUsedAt)}
                      </div>
                      <div>
                        <span className="font-medium">사용 횟수:</span> {key.usageCount}회
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      disabled={updateMutation.isPending}
                      onClick={() => handleToggleActive(key)}
                      size="sm"
                      title={key.isActive ? "비활성화" : "활성화"}
                      variant="outline"
                    >
                      {key.isActive ? "비활성화" : "활성화"}
                    </Button>
                    <Button
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(key.id)}
                      size="icon"
                      title="삭제"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Alert>
          <Key className="h-4 w-4" />
          <AlertTitle>사용 방법</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              <li>여러 개의 API 키를 추가하면 순서대로 번갈아가며 사용됩니다 (Round-robin)</li>
              <li>비활성화된 키는 사용되지 않습니다</li>
              <li>모든 키가 비활성화되거나 없으면 서버의 기본 API 키가 사용됩니다</li>
              <li>
                OpenAI API 키는{" "}
                <a
                  className="underline"
                  href="https://platform.openai.com/api-keys"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  OpenAI 플랫폼
                </a>
                에서 발급받을 수 있습니다
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>

      <Dialog onOpenChange={handleCloseDialog} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKey ? "API 키 수정" : "API 키 추가"}</DialogTitle>
            <DialogDescription>
              {editingKey
                ? "API 키 정보를 수정합니다. API 키를 입력하지 않으면 기존 키가 유지됩니다."
                : "새로운 OpenAI API 키를 추가합니다."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor={keyNameId}>키 이름</Label>
              <Input
                id={keyNameId}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: Main Key, Backup Key 1"
                required={!editingKey}
                value={formData.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={apiKeyId}>API 키</Label>
              <Input
                id={apiKeyId}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
                required={!editingKey}
                type="password"
                value={formData.apiKey}
              />
              <p className="text-muted-foreground text-xs">
                {editingKey
                  ? "새 API 키를 입력하지 않으면 기존 키가 유지됩니다"
                  : "OpenAI 플랫폼에서 발급받은 API 키를 입력하세요"}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={handleCloseDialog} type="button" variant="outline">
                <X className="mr-2 h-4 w-4" />
                취소
              </Button>
              <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                <Save className="mr-2 h-4 w-4" />
                {editingKey ? "수정" : "추가"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default OpenAIApiKeyManagement

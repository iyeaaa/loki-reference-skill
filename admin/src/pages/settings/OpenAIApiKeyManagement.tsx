import { AlertCircle, Key, Plus, Save, Trash2, X } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useCreateApiKey,
  useDeleteApiKey,
  useOpenAIApiKeys,
  useUpdateApiKey,
} from "@/lib/api/hooks/openai-api-keys"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export function OpenAIApiKeyManagement() {
  const { t } = useTranslation("settings")
  const keyNameId = useId()
  const apiKeyId = useId()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)

  // useWorkspace 훅 사용 - localStorage 변경 시 자동 리렌더링
  const { selectedWorkspace } = useWorkspace()
  const workspaceId = selectedWorkspace?.id || ""
  const isAllWorkspaces = workspaceId === "all" || !workspaceId

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

  const handleDeleteClick = (key: ApiKey) => {
    setDeleteTarget(key)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return
    }
    await deleteMutation.mutateAsync({ id: deleteTarget.id, workspaceId })
    setDeleteTarget(null)
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
      return t("openaiApiKeys.neverUsed")
    }
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("openaiApiKeys.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("openaiApiKeys.loading")}</p>
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
              {t("openaiApiKeys.title")}
            </CardTitle>
            <CardDescription className="mt-2">{t("openaiApiKeys.description")}</CardDescription>
          </div>
          <Button disabled={isAllWorkspaces} onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t("openaiApiKeys.addKey")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAllWorkspaces ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("openaiApiKeys.selectWorkspaceTitle")}</AlertTitle>
            <AlertDescription>{t("openaiApiKeys.selectWorkspaceDescription")}</AlertDescription>
          </Alert>
        ) : apiKeys.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{t("openaiApiKeys.noKeys")}</p>
            <p className="mt-2 text-sm">{t("openaiApiKeys.noKeysDescription")}</p>
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
                          {t("openaiApiKeys.active")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-800 text-xs dark:bg-gray-800 dark:text-gray-300">
                          {t("openaiApiKeys.inactive")}
                        </span>
                      )}
                    </div>

                    <div className="mb-2 flex items-center gap-2 font-mono text-muted-foreground text-sm">
                      <span>{key.apiKey}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 text-muted-foreground text-sm">
                      <div>
                        <span className="font-medium">{t("openaiApiKeys.lastUsed")}:</span>{" "}
                        {formatDate(key.lastUsedAt)}
                      </div>
                      <div>
                        <span className="font-medium">{t("openaiApiKeys.usageCount")}:</span>{" "}
                        {key.usageCount}
                        {t("openaiApiKeys.times")}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      disabled={updateMutation.isPending}
                      onClick={() => handleToggleActive(key)}
                      size="sm"
                      title={
                        key.isActive ? t("openaiApiKeys.deactivate") : t("openaiApiKeys.activate")
                      }
                      variant="outline"
                    >
                      {key.isActive ? t("openaiApiKeys.deactivate") : t("openaiApiKeys.activate")}
                    </Button>
                    <Button
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDeleteClick(key)}
                      size="icon"
                      title={t("openaiApiKeys.delete")}
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
          <AlertTitle>{t("openaiApiKeys.howToUse")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              <li>{t("openaiApiKeys.howToUseRoundRobin")}</li>
              <li>{t("openaiApiKeys.howToUseDisabled")}</li>
              <li>{t("openaiApiKeys.howToUseDefault")}</li>
              <li>
                {t("openaiApiKeys.howToUseGetKey")}{" "}
                <a
                  className="underline"
                  href="https://platform.openai.com/api-keys"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t("openaiApiKeys.openaiPlatform")}
                </a>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>

      <Dialog onOpenChange={handleCloseDialog} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingKey ? t("openaiApiKeys.editKey") : t("openaiApiKeys.addKey")}
            </DialogTitle>
            <DialogDescription>
              {editingKey
                ? t("openaiApiKeys.editKeyDescription")
                : t("openaiApiKeys.addKeyDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor={keyNameId}>{t("openaiApiKeys.keyName")}</Label>
              <Input
                id={keyNameId}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("openaiApiKeys.keyNamePlaceholder")}
                required={!editingKey}
                value={formData.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={apiKeyId}>{t("openaiApiKeys.apiKey")}</Label>
              <Input
                id={apiKeyId}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
                required={!editingKey}
                type="password"
                value={formData.apiKey}
              />
              <p className="text-muted-foreground text-xs">
                {editingKey ? t("openaiApiKeys.editKeyHint") : t("openaiApiKeys.addKeyHint")}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={handleCloseDialog} type="button" variant="outline">
                <X className="mr-2 h-4 w-4" />
                {t("openaiApiKeys.cancel")}
              </Button>
              <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                <Save className="mr-2 h-4 w-4" />
                {editingKey ? t("openaiApiKeys.edit") : t("openaiApiKeys.add")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        confirmText={deleteTarget?.name || ""}
        description={t("openaiApiKeys.deleteDescription")}
        isLoading={deleteMutation.isPending}
        itemName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={!!deleteTarget}
        title={t("openaiApiKeys.deleteTitle")}
      />
    </Card>
  )
}

export default OpenAIApiKeyManagement

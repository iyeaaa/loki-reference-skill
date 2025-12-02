import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, Edit2, FileText, Mail, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { sequenceKeys, useSequence, useUpdateSequence } from "@/lib/api/hooks/sequences"
import type { SequenceStatus } from "@/lib/api/types/sequence"
import { cn } from "@/lib/utils"
import { CampaignOverview } from "./CampaignOverview"
import { SequenceEnrollmentsTable } from "./SequenceEnrollmentsTable"
import { SequenceForm } from "./SequenceForm"
import { SequenceStepsList } from "./SequenceStepList"

export default function SequenceEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const sequenceId = searchParams.get("id")
  const [selectedMenu, setSelectedMenu] = useState("overview")
  const [memo, setMemo] = useState("")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [editedDescription, setEditedDescription] = useState("")

  const { data: sequence, isLoading, error } = useSequence(sequenceId || "", !!sequenceId)
  const updateSequence = useUpdateSequence()

  useEffect(() => {
    if (!sequenceId) {
      toast.error(t("sequences.editPage.sequenceIdMissing"))
      navigate("/sequences")
    }
  }, [sequenceId, navigate, t])

  useEffect(() => {
    if (error) {
      toast.error(t("sequences.editPage.loadFailed"))
      navigate("/sequences")
    }
  }, [error, navigate, t])

  useEffect(() => {
    if (sequence) {
      setEditedName(sequence.name)
      setEditedDescription(sequence.description || "")
      setMemo(sequence.memo || "")

      // Set default tab based on sequence status
      const isDraftOrReady =
        sequence.status === "draft" ||
        sequence.status === "generating" ||
        sequence.status === "ready"
      const isActiveOrBeyond = ["active", "paused", "completed", "archived"].includes(
        sequence.status,
      )

      if (isDraftOrReady) {
        setSelectedMenu("customer-selection")
      } else if (isActiveOrBeyond) {
        setSelectedMenu("overview")
      }
    }
  }, [sequence])

  const handleUpdateSequence = async (sequenceData: unknown) => {
    if (!sequenceId) return

    updateSequence.mutate(
      {
        sequenceId,
        data: sequenceData as {
          name: string
          description?: string
          status: SequenceStatus
        },
      },
      {
        onSuccess: () => {
          toast.success(t("sequences.editPage.updated"))
        },
      },
    )
  }

  const handleBack = () => {
    navigate("/sequences")
  }

  const handleSaveTitleDescription = async () => {
    if (!sequenceId || !editedName.trim()) {
      toast.error(t("sequences.editPage.enterName"))
      return
    }

    updateSequence.mutate(
      {
        sequenceId,
        data: {
          name: editedName.trim(),
          description: editedDescription.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          // Query invalidation is handled by the hook
          queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(sequenceId) })
          setIsEditingTitle(false)
        },
      },
    )
  }

  const handleCancelTitleEdit = () => {
    if (sequence) {
      setEditedName(sequence.name)
      setEditedDescription(sequence.description || "")
    }
    setIsEditingTitle(false)
  }

  const handleSaveMemo = async () => {
    if (!sequenceId) return

    // Check if memo is empty
    if (!memo.trim()) {
      toast.error(t("sequences.editPage.memoEmpty"))
      return
    }

    updateSequence.mutate(
      {
        sequenceId,
        data: {
          memo: memo.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          // Query invalidation is handled by the hook
          queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(sequenceId) })
          toast.success(t("sequences.editPage.memoSaved"))
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">{t("sequences.editPage.loading")}</div>
      </div>
    )
  }

  if (!sequence) {
    return null
  }

  const isDraftOrReady =
    sequence.status === "draft" || sequence.status === "generating" || sequence.status === "ready"
  const isActiveOrBeyond = ["active", "paused", "completed", "archived"].includes(sequence.status)

  // Menu items based on status
  const menuItems = isDraftOrReady
    ? [
        { id: "customer-selection", label: t("sequences.editPage.customerGroupMenu"), icon: Users },
        { id: "scenario", label: t("sequences.editPage.scenarioMenu"), icon: Mail },
        { id: "memo", label: t("sequences.editPage.memoMenu"), icon: FileText },
      ]
    : [
        { id: "overview", label: t("sequences.editPage.overviewMenu"), icon: FileText },
        { id: "scenario", label: t("sequences.editPage.scenarioMenu"), icon: Mail },
        { id: "enrollment", label: t("sequences.editPage.enrollmentMenu"), icon: Users },
        { id: "memo", label: t("sequences.editPage.memoMenu"), icon: FileText },
      ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("sequences.editPage.back")}
          </Button>
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={t("sequences.editPage.campaignName")}
                    className="text-2xl font-bold h-auto py-1"
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveTitleDescription}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelTitleEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder={t("sequences.editPage.campaignDescPlaceholder")}
                  className="text-sm"
                />
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{sequence.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {sequence.description || t("sequences.editPage.campaignDetail")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingTitle(true)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  {t("sequences.editPage.edit")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Menu */}
        <div className="w-64 border-r bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedMenu(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      selectedMenu === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Draft/Ready Status Content */}
            {isDraftOrReady && (
              <>
                {selectedMenu === "customer-selection" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.customerGroupMenu")}
                    </h2>
                    <SequenceForm
                      sequence={sequence}
                      isEdit={true}
                      onSave={handleUpdateSequence}
                      onCancel={handleBack}
                      stepsCount={sequence.stepsCount || 0}
                    />
                  </Card>
                )}

                {selectedMenu === "scenario" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.scenarioMenu")}
                    </h2>
                    <SequenceStepsList sequenceId={sequence.id} isEdit={true} />
                  </div>
                )}

                {selectedMenu === "memo" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.memoMenu")}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("sequences.editPage.memoNote")}
                    </p>
                    <Textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder={t("sequences.editPage.memoPlaceholder")}
                      rows={10}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button onClick={handleSaveMemo} disabled={updateSequence.isPending}>
                        {updateSequence.isPending
                          ? t("sequences.editPage.saving")
                          : t("sequences.editPage.save")}
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* Active/Beyond Status Content */}
            {isActiveOrBeyond && (
              <>
                {selectedMenu === "overview" && (
                  <div>
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        {t("sequences.editPage.readOnlyNotice")}
                      </p>
                    </div>
                    <CampaignOverview sequenceId={sequence.id} />
                  </div>
                )}

                {selectedMenu === "scenario" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.scenarioMenu")}
                    </h2>
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        ℹ️{" "}
                        {t(
                          "sequences.editPage.partialEditNotice",
                          "발송되지 않은 이메일만 수정할 수 있습니다. 이미 발송된 이메일은 읽기 전용입니다.",
                        )}
                      </p>
                    </div>
                    <SequenceStepsList sequenceId={sequence.id} isEdit={true} readOnly={true} />
                  </div>
                )}

                {selectedMenu === "enrollment" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.enrollmentMenu")}
                    </h2>
                    <SequenceEnrollmentsTable sequenceId={sequence.id} />
                  </div>
                )}

                {selectedMenu === "memo" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      {t("sequences.editPage.memoMenu")}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("sequences.editPage.memoNote")}
                    </p>
                    <Textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder={t("sequences.editPage.memoPlaceholder")}
                      rows={10}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button onClick={handleSaveMemo} disabled={updateSequence.isPending}>
                        {updateSequence.isPending
                          ? t("sequences.editPage.saving")
                          : t("sequences.editPage.save")}
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

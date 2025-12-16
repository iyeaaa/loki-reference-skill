import { Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CreateIamPolicyRequest, IamPolicy, PolicyEffect } from "@/lib/api/types/iam"
import { COMMON_ACTIONS, COMMON_RESOURCES, POLICY_EFFECT_LABELS } from "@/lib/api/types/iam"

type PolicyFormProps = {
  policy?: IamPolicy
  onSave: (data: CreateIamPolicyRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

type StatementFormData = {
  sid: string
  effect: PolicyEffect
  resources: string[]
  actions: string[]
  priority: number
}

export function PolicyForm({ policy, onSave, onCancel, isLoading }: PolicyFormProps) {
  const formId = useId()
  const [name, setName] = useState(policy?.name || "")
  const [description, setDescription] = useState(policy?.description || "")
  const [isActive, setIsActive] = useState(policy?.isActive ?? true)
  const [statements, setStatements] = useState<StatementFormData[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      description: description || undefined,
      isActive,
      statements: statements.map((s) => ({
        sid: s.sid || undefined,
        effect: s.effect,
        resources: s.resources,
        actions: s.actions,
        priority: s.priority,
      })),
    })
  }

  const addStatement = () => {
    setStatements([
      ...statements,
      {
        sid: "",
        effect: "allow",
        resources: [],
        actions: [],
        priority: 0,
      },
    ])
  }

  const removeStatement = (index: number) => {
    setStatements(statements.filter((_, i) => i !== index))
  }

  const updateStatement = (index: number, updates: Partial<StatementFormData>) => {
    setStatements(statements.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const toggleResource = (stmtIndex: number, resource: string) => {
    const stmt = statements[stmtIndex]
    const resources = stmt.resources.includes(resource)
      ? stmt.resources.filter((r) => r !== resource)
      : [...stmt.resources, resource]
    updateStatement(stmtIndex, { resources })
  }

  const toggleAction = (stmtIndex: number, action: string) => {
    const stmt = statements[stmtIndex]
    const actions = stmt.actions.includes(action)
      ? stmt.actions.filter((a) => a !== action)
      : [...stmt.actions, action]
    updateStatement(stmtIndex, { actions })
  }

  return (
    <form className="space-y-6 py-4" onSubmit={handleSubmit}>
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>정책명 *</Label>
        <Input
          id={`${formId}-name`}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: LeadFullAccess"
          required
          value={name}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>설명</Label>
        <Textarea
          id={`${formId}-description`}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="정책에 대한 설명을 입력하세요..."
          rows={2}
          value={description}
        />
      </div>

      {/* Is Active */}
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={isActive}
          id={`${formId}-isActive`}
          onCheckedChange={(checked) => setIsActive(checked as boolean)}
        />
        <Label className="cursor-pointer" htmlFor={`${formId}-isActive`}>
          활성 상태
        </Label>
      </div>

      {/* Statements */}
      {!policy && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label>정책 명세</Label>
            <Button onClick={addStatement} size="sm" type="button" variant="outline">
              <Plus className="mr-1 h-4 w-4" />
              명세 추가
            </Button>
          </div>

          {statements.length === 0 ? (
            <p className="text-gray-500 text-sm">
              정책 명세를 추가하여 허용/거부 규칙을 정의하세요.
            </p>
          ) : (
            <div className="space-y-4">
              {statements.map((stmt, index) => (
                <div
                  className="space-y-4 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
                  key={index}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">명세 #{index + 1}</span>
                    <Button
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeStatement(index)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* SID */}
                    <div className="space-y-2">
                      <Label>식별자 (SID)</Label>
                      <Input
                        onChange={(e) => updateStatement(index, { sid: e.target.value })}
                        placeholder="예: AllowLeadRead"
                        value={stmt.sid}
                      />
                    </div>

                    {/* Effect */}
                    <div className="space-y-2">
                      <Label>효과 *</Label>
                      <Select
                        onValueChange={(value) =>
                          updateStatement(index, { effect: value as PolicyEffect })
                        }
                        value={stmt.effect}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(POLICY_EFFECT_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="space-y-2">
                    <Label>리소스 *</Label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_RESOURCES.map((resource) => (
                        <label
                          className={`inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs ${
                            stmt.resources.includes(resource.value)
                              ? "border-blue-300 bg-blue-100 text-blue-800"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          key={resource.value}
                        >
                          <input
                            checked={stmt.resources.includes(resource.value)}
                            className="sr-only"
                            onChange={() => toggleResource(index, resource.value)}
                            type="checkbox"
                          />
                          {resource.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Label>액션 *</Label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_ACTIONS.map((action) => (
                        <label
                          className={`inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs ${
                            stmt.actions.includes(action.value)
                              ? "border-green-300 bg-green-100 text-green-800"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          key={action.value}
                        >
                          <input
                            checked={stmt.actions.includes(action.value)}
                            className="sr-only"
                            onChange={() => toggleAction(index, action.value)}
                            type="checkbox"
                          />
                          {action.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label>우선순위</Label>
                    <Input
                      className="w-24"
                      min={0}
                      onChange={(e) =>
                        updateStatement(index, {
                          priority: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                      type="number"
                      value={stmt.priority}
                    />
                    <p className="text-gray-500 text-xs">높을수록 먼저 평가됩니다.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button disabled={isLoading || !name.trim()} type="submit">
          {isLoading ? "저장 중..." : policy ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  )
}

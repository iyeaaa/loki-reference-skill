import { Edit, Trash2 } from "lucide-react"
import { type FC, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type CommentNodeData = {
  comment?: string
  onDelete?: () => void
  onUpdate?: (data: { comment: string }) => void
}

type CommentNodeProps = {
  data: CommentNodeData
}

export const CommentNode: FC<CommentNodeProps> = ({ data }) => {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [comment, setComment] = useState(data.comment || "")
  const commentId = useId()

  // data가 변경되면 로컬 state 업데이트
  useEffect(() => {
    setComment(data.comment || "")
  }, [data.comment])

  const handleSave = () => {
    data.onUpdate?.({ comment })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setComment(data.comment || "")
    setIsEditing(false)
  }

  return (
    <div className="group min-w-[200px] max-w-[350px] rounded border-2 border-yellow-400 bg-yellow-50 shadow-md">
      {isEditing ? (
        <div className="space-y-2 p-3">
          <Textarea
            autoFocus
            className="resize-none border-yellow-300 bg-white text-sm focus:border-yellow-500"
            id={commentId}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("sequences.designer.commentNode.placeholder")}
            rows={4}
            value={comment}
          />
          <div className="flex gap-2">
            <Button
              className="h-7 flex-1 text-xs"
              onClick={handleCancel}
              size="sm"
              variant="outline"
            >
              {t("sequences.designer.commentNode.cancel")}
            </Button>
            <Button className="h-7 flex-1 text-xs" onClick={handleSave} size="sm">
              {t("sequences.designer.commentNode.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-2">
          {comment ? (
            <button
              className="min-h-[60px] flex-1 whitespace-pre-wrap rounded border border-yellow-200 bg-white p-2 text-left text-gray-700 text-xs hover:bg-yellow-50"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              {comment}
            </button>
          ) : (
            <button
              className="min-h-[60px] flex-1 rounded border border-yellow-300 border-dashed bg-white p-2 text-left text-gray-400 text-xs italic hover:bg-yellow-50"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              {t("sequences.designer.commentNode.writeMemo")}
            </button>
          )}

          {/* 버튼들 - hover 시에만 표시 */}
          <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              className="h-6 w-6 p-0 hover:bg-yellow-200"
              onClick={() => setIsEditing(true)}
              size="sm"
              title={t("sequences.designer.commentNode.edit")}
              variant="ghost"
            >
              <Edit className="h-3 w-3 text-yellow-700" />
            </Button>
            <Button
              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={() => data.onDelete?.()}
              size="sm"
              title={t("sequences.designer.commentNode.delete")}
              variant="ghost"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

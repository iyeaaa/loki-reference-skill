import { Edit, Trash2 } from "lucide-react"
import { type FC, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface CommentNodeData {
  comment?: string
  onDelete?: () => void
  onUpdate?: (data: { comment: string }) => void
}

interface CommentNodeProps {
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
    <div className="bg-yellow-50 rounded border-2 border-yellow-400 shadow-md min-w-[200px] max-w-[350px] group">
      {isEditing ? (
        <div className="p-3 space-y-2">
          <Textarea
            id={commentId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("sequences.designer.commentNode.placeholder")}
            rows={4}
            className="text-sm bg-white border-yellow-300 focus:border-yellow-500 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex-1 h-7 text-xs"
            >
              {t("sequences.designer.commentNode.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} className="flex-1 h-7 text-xs">
              {t("sequences.designer.commentNode.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-2 flex items-start gap-2">
          {comment ? (
            <button
              type="button"
              className="flex-1 text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border border-yellow-200 hover:bg-yellow-50 text-left min-h-[60px]"
              onClick={() => setIsEditing(true)}
            >
              {comment}
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 text-xs text-gray-400 italic bg-white p-2 rounded border border-dashed border-yellow-300 hover:bg-yellow-50 text-left min-h-[60px]"
              onClick={() => setIsEditing(true)}
            >
              {t("sequences.designer.commentNode.writeMemo")}
            </button>
          )}

          {/* 버튼들 - hover 시에만 표시 */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 p-0 hover:bg-yellow-200"
              title={t("sequences.designer.commentNode.edit")}
            >
              <Edit className="h-3 w-3 text-yellow-700" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => data.onDelete?.()}
              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
              title={t("sequences.designer.commentNode.delete")}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

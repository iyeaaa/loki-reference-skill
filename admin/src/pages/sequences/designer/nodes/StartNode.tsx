import { Handle, Position } from "@xyflow/react"
import { Plus } from "lucide-react"
import { type FC, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type StartNodeProps = {
  data: {
    onAddNode?: (type: string) => void
  }
}

export const StartNode: FC<StartNodeProps> = ({ data }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const handleAddNode = (type: string) => {
    data.onAddNode?.(type)
    setIsOpen(false)
  }

  return (
    <div className="min-w-[200px] rounded-lg border-2 border-green-700 bg-gradient-to-r from-green-500 to-green-600 shadow-lg">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white p-2">
            <div className="h-3 w-3 rounded-full bg-green-600" />
          </div>
          <span className="font-semibold text-lg text-white">
            {t("sequences.designer.startNode.start")}
          </span>
        </div>
        <p className="mt-2 text-green-50 text-sm">
          {t("sequences.designer.startNode.description")}
        </p>
      </div>

      <div className="border-green-700 border-t bg-green-600/30 p-3">
        <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
          <DropdownMenuTrigger asChild>
            <Button className="w-full text-white hover:bg-green-700/50" size="sm" variant="ghost">
              <Plus className="mr-2 h-4 w-4" />
              {t("sequences.designer.startNode.addNode")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleAddNode("emailDraft")}>
              {t("sequences.designer.startNode.addEmailDraft")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Handle
        className="h-3 w-3 border-2 border-white bg-green-600"
        position={Position.Bottom}
        type="source"
      />
    </div>
  )
}

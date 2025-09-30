import { Plus } from "lucide-react";
import { type FC, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StartNodeProps {
  data: {
    onAddNode?: (type: string) => void;
  };
}

export const StartNode: FC<StartNodeProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddNode = (type: string) => {
    data.onAddNode?.(type);
    setIsOpen(false);
  };

  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg border-2 border-green-700 min-w-[200px]">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-full p-2">
            <div className="w-3 h-3 bg-green-600 rounded-full" />
          </div>
          <span className="text-white font-semibold text-lg">시작</span>
        </div>
        <p className="text-green-50 text-sm mt-2">워크플로우 시작점</p>
      </div>

      <div className="border-t border-green-700 p-3 bg-green-600/30">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-white hover:bg-green-700/50"
            >
              <Plus className="h-4 w-4 mr-2" />
              노드 추가
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleAddNode("emailDraft")}>
              이메일 초안 추가
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-600 border-2 border-white"
      />
    </div>
  );
};

import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { createWorkspaceAtom, selectedWorkspaceIdAtom, workspacesAtom } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function WorkspaceListPage() {
  const navigate = useNavigate();
  const [workspaces] = useAtom(workspacesAtom);
  const [, setSelected] = useAtom(selectedWorkspaceIdAtom);
  const [, createWs] = useAtom(createWorkspaceAtom);
  const [name, setName] = useState("");

  const createAndOpen = () => {
    createWs(name);
    setName("");
    navigate("/email-sequence/workspace");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="워크스페이스 이름"
          className="border rounded px-2 py-1"
        />
        <Button onClick={createAndOpen}>새 워크스페이스</Button>
      </div>

      <div className="border rounded">
        {workspaces.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">워크스페이스가 없습니다. 새로 생성해보세요.</div>
        ) : (
          <ul className="divide-y">
            {workspaces.map((ws) => (
              <li key={ws.id} className="p-3 flex items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(ws.createdAt).toLocaleString()}</div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(ws.id);
                    navigate("/email-sequence/workspace");
                  }}
                >
                  열기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}



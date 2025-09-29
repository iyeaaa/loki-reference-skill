import ReactFlowApp from "@/components/react-flow-app";
import { useAtom } from "jotai";
import { selectedWorkspaceIdAtom, workspacesAtom } from "@/lib/workspace";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WorkspaceFlowPage() {
  const navigate = useNavigate();
  const [selected] = useAtom(selectedWorkspaceIdAtom);
  const [workspaces] = useAtom(workspacesAtom);

  useEffect(() => {
    if (!selected || !workspaces.find((w) => w.id === selected)) {
      navigate("/email-sequence");
    }
  }, [selected, workspaces, navigate]);

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <ReactFlowApp />
    </div>
  );
}



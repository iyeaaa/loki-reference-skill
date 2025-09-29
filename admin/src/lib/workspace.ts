import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Node, Edge } from "@xyflow/react";

export type Workspace = {
  id: string;
  name: string;
  createdAt: number;
};

export type FlowState = {
  nodes: Node[];
  edges: Edge[];
};

export const workspacesAtom = atomWithStorage<Workspace[]>("ws_list", []);
export const selectedWorkspaceIdAtom = atomWithStorage<string | null>(
  "ws_selected",
  null,
);
export const flowStateByWorkspaceAtom = atomWithStorage<
  Record<string, FlowState>
>("ws_flows", {});

const createInitialFlowState = (): FlowState => ({
  nodes: [
    {
      id: `buyer-import-1`,
      type: "buyerImport",
      position: { x: 280, y: 120 },
      data: {},
    },
  ],
  edges: [],
});

export const currentFlowStateAtom = atom(
  (get) => {
    const wsId = get(selectedWorkspaceIdAtom);
    const map = get(flowStateByWorkspaceAtom);
    if (!wsId) return createInitialFlowState();
    return map[wsId] ?? createInitialFlowState();
  },
  (get, set, next: FlowState | ((prev: FlowState) => FlowState)) => {
    const wsId = get(selectedWorkspaceIdAtom);
    if (!wsId) return;
    const map = get(flowStateByWorkspaceAtom);
    const prev = map[wsId] ?? createInitialFlowState();
    const value = typeof next === "function" ? (next as (p: FlowState) => FlowState)(prev) : next;
    set(flowStateByWorkspaceAtom, { ...map, [wsId]: value });
  },
);

export const createWorkspaceAtom = atom(null, (get, set, name: string) => {
  const id = `ws-${Date.now()}`;
  const ws: Workspace = { id, name: name.trim() || "새 워크스페이스", createdAt: Date.now() };
  const list = get(workspacesAtom);
  set(workspacesAtom, [...list, ws]);
  // initialize flow entry lazily when first opened; no write here
  set(selectedWorkspaceIdAtom, id);
});



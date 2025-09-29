export type SequencerNodeType = "buyerImport" | "emailDraft" | "sendNode" | "branchNode"

export const NODE_TYPE_COLORS: Record<SequencerNodeType, { borderClass: string; miniMap: string }> =
  {
    buyerImport: { borderClass: "border-blue-500", miniMap: "#3b82f6" },
    emailDraft: { borderClass: "border-amber-500", miniMap: "#f59e0b" },
    sendNode: { borderClass: "border-emerald-500", miniMap: "#10b981" },
    branchNode: { borderClass: "border-violet-500", miniMap: "#8b5cf6" },
  }

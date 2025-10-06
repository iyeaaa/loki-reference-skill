import { useState } from "react"

// TODO: Implement workspace selection context
// For now, returns a simple state-based workspace selector
export function useWorkspace() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ id: string; name: string } | null>(
    null,
  )

  return {
    selectedWorkspace,
    setSelectedWorkspace,
  }
}

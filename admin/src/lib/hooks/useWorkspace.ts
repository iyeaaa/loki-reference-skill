import { useEffect, useState } from "react"

export type SelectedWorkspace = {
  id: string
  name: string
}

// Custom event name for workspace changes (same tab)
export const WORKSPACE_CHANGE_EVENT = "workspaceChange"

// Helper to dispatch workspace change event (call this when changing workspace)
export function dispatchWorkspaceChange() {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGE_EVENT))
}

// Workspace selection hook that reads from localStorage
export function useWorkspace() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<SelectedWorkspace | null>(() => {
    const storedId = localStorage.getItem("selectedWorkspace")
    const storedName = localStorage.getItem("selectedWorkspaceName")

    if (storedId) {
      return {
        id: storedId,
        name: storedName || (storedId === "all" ? "전체" : "Unknown Workspace"),
      }
    }
    return null
  })

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const storedId = localStorage.getItem("selectedWorkspace")
      const storedName = localStorage.getItem("selectedWorkspaceName")

      if (storedId) {
        setSelectedWorkspace({
          id: storedId,
          name: storedName || (storedId === "all" ? "전체" : "Unknown Workspace"),
        })
      } else {
        setSelectedWorkspace(null)
      }
    }

    // storage 이벤트 리스너 (다른 탭에서 변경 감지)
    window.addEventListener("storage", handleStorageChange)

    // custom 이벤트 리스너 (같은 탭에서 변경 감지 - 폴링 대체)
    window.addEventListener(WORKSPACE_CHANGE_EVENT, handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, handleStorageChange)
    }
  }, [])

  return {
    selectedWorkspace,
    setSelectedWorkspace,
  }
}

import { useEffect, useState } from "react"

export interface SelectedWorkspace {
  id: string
  name: string
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

    // storage 이벤트 리스너 추가 (다른 탭에서 변경 감지)
    window.addEventListener("storage", handleStorageChange)

    // 같은 탭에서의 변경 감지를 위한 interval
    const intervalId = setInterval(() => {
      const currentId = localStorage.getItem("selectedWorkspace")
      if (currentId !== selectedWorkspace?.id) {
        handleStorageChange()
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(intervalId)
    }
  }, [selectedWorkspace?.id])

  return {
    selectedWorkspace,
    setSelectedWorkspace,
  }
}

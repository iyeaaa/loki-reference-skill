import React, { useCallback, useEffect, useState } from "react"
import type { ExtractionProgress, ExtractionResult } from "@/lib/api/types/web-extraction"

/**
 * Custom hook for managing web extraction data and localStorage
 */
export function useWebExtractionData(progress: ExtractionProgress | null, jobId: string | null) {
  // Initialize data from localStorage
  const [data, setData] = useState<ExtractionResult[]>(() => {
    try {
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        const parsedData = JSON.parse(storedData) as unknown
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          return parsedData as ExtractionResult[]
        }
      }
    } catch (error) {
      console.error("Failed to load initial data from storage:", error)
    }
    return []
  })

  // Initialize completed progress from localStorage
  const [completedProgress, setCompletedProgress] = useState<ExtractionProgress | null>(() => {
    try {
      const saved = localStorage.getItem("webExtractionProgress")
      if (saved) {
        const parsed = JSON.parse(saved) as ExtractionProgress
        if (parsed?.status === "completed") {
          return parsed
        }
      }
    } catch (error) {
      console.error("Failed to load saved progress:", error)
    }
    return null
  })

  // Initialize total time saved from localStorage
  const [totalTimeSaved] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("webExtractionTotalTimeSaved")
      return saved ? Number.parseFloat(saved) : 0
    } catch {
      return 0
    }
  })

  // Save completed progress to localStorage
  useEffect(() => {
    if (progress?.status === "completed") {
      try {
        const progressToSave = JSON.parse(JSON.stringify(progress))
        localStorage.setItem("webExtractionProgress", JSON.stringify(progressToSave))
        setCompletedProgress(progressToSave)
        console.log("[WebExtraction] Completed progress saved:", progressToSave)
      } catch (error) {
        console.error("Failed to save progress:", error)
      }
    }
  }, [progress?.status, progress])

  // Load completed progress from localStorage if needed
  useEffect(() => {
    if (!completedProgress && !progress) {
      try {
        const saved = localStorage.getItem("webExtractionProgress")
        if (saved) {
          const parsed = JSON.parse(saved) as ExtractionProgress
          if (parsed?.status === "completed") {
            setCompletedProgress(parsed)
            console.log("[WebExtraction] Loaded completed progress from storage")
          }
        }
      } catch (error) {
        console.error("Failed to load completed progress:", error)
      }
    }
  }, [progress, completedProgress])

  // Determine which progress to display
  const displayProgress = React.useMemo(() => {
    if (progress) return progress
    if (completedProgress) return completedProgress

    try {
      const saved = localStorage.getItem("webExtractionProgress")
      if (saved) {
        const parsed = JSON.parse(saved) as ExtractionProgress
        if (parsed?.status === "completed") {
          return parsed
        }
      }
    } catch (error) {
      console.error("Failed to read completed progress from storage:", error)
    }

    return null
  }, [progress, completedProgress])

  // Update results in storage (for real-time updates)
  const updateResultsInStorage = useCallback((latestResult: unknown) => {
    try {
      const storedData = localStorage.getItem("exaWebSetTestData")
      let results: ExtractionResult[] = []

      if (storedData) {
        const parsed = JSON.parse(storedData)
        results = Array.isArray(parsed) ? parsed : []
      }

      const result = latestResult as ExtractionResult
      if (result && typeof result === "object" && "website_url" in result) {
        const existingIndex = results.findIndex((r) => r.website_url === result.website_url)

        if (existingIndex >= 0) {
          results[existingIndex] = result
        } else {
          results.push(result)
        }

        localStorage.setItem("exaWebSetTestData", JSON.stringify(results))
        setData([...results])
        window.dispatchEvent(new Event("exaWebSetDataUpdated"))
      }
    } catch (error) {
      console.error("Failed to update results in storage:", error)
    }
  }, [])

  // Save full results to storage (on completion)
  const saveResultsToStorage = useCallback(async (completedJobId: string) => {
    try {
      const { webExtractionApi } = await import("@/lib/api/services/web-extraction")
      const results = (await webExtractionApi.getResults(completedJobId)) as unknown

      const validResults = Array.isArray(results) ? results : []

      if (validResults.length > 0) {
        localStorage.setItem("exaWebSetTestData", JSON.stringify(validResults))
        setData(validResults as ExtractionResult[])
        window.dispatchEvent(new Event("storage"))
        window.dispatchEvent(new Event("exaWebSetDataUpdated"))
      } else {
        const storedData = localStorage.getItem("exaWebSetTestData")
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData) as unknown
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              setData(parsedData as ExtractionResult[])
            }
          } catch (parseError) {
            console.error("Failed to parse stored data:", parseError)
          }
        }
      }
    } catch (error) {
      console.error("Failed to save results to storage:", error)
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as unknown
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setData(parsedData as ExtractionResult[])
          }
        } catch (parseError) {
          console.error("Failed to parse stored data:", parseError)
        }
      }
    }
  }, [])

  // Load data from storage on mount and listen for changes
  useEffect(() => {
    const loadDataFromStorage = () => {
      try {
        const storedData = localStorage.getItem("exaWebSetTestData")
        if (storedData) {
          const parsedData = JSON.parse(storedData) as unknown
          if (Array.isArray(parsedData)) {
            setData(parsedData as ExtractionResult[])
          } else {
            setData([])
            localStorage.removeItem("exaWebSetTestData")
          }
        }
      } catch (error) {
        console.error("Failed to load data from storage:", error)
        setData([])
      }
    }

    loadDataFromStorage()

    const handleStorageChange = () => loadDataFromStorage()
    const handleCustomStorage = () => loadDataFromStorage()

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("exaWebSetDataUpdated", handleCustomStorage)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("exaWebSetDataUpdated", handleCustomStorage)
    }
  }, [])

  // Handle real-time result updates
  useEffect(() => {
    if (progress?.latestResult) {
      updateResultsInStorage(progress.latestResult)
    }
  }, [progress?.latestResult, updateResultsInStorage])

  // Handle completion
  useEffect(() => {
    if (progress?.status === "completed" && jobId) {
      saveResultsToStorage(jobId).catch((error) => {
        console.error("Error saving results:", error)
      })
    }
  }, [progress?.status, jobId, saveResultsToStorage])

  // Load data after completion if needed
  useEffect(() => {
    if (progress?.status === "completed" && (!data || data.length === 0)) {
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as unknown
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setData(parsedData as ExtractionResult[])
          }
        } catch (error) {
          console.error("Failed to load data after completion:", error)
        }
      }
    }
  }, [progress?.status, data])

  // Clear saved progress (for new upload)
  const clearSavedProgress = useCallback(() => {
    try {
      localStorage.removeItem("webExtractionProgress")
      setCompletedProgress(null)
    } catch (error) {
      console.error("Failed to clear saved progress:", error)
    }
  }, [])

  // Clear all data
  const clearAllData = useCallback(() => {
    try {
      localStorage.removeItem("exaWebSetTestData")
      setData([])
      window.dispatchEvent(new Event("storage"))
      window.dispatchEvent(new Event("exaWebSetDataUpdated"))
    } catch (error) {
      console.error("Failed to clear data:", error)
      throw error
    }
  }, [])

  return {
    data,
    displayProgress,
    completedProgress,
    totalTimeSaved,
    clearSavedProgress,
    clearAllData,
    setCompletedProgress,
  }
}
